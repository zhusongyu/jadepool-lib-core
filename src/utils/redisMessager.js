const { promisify } = require('util')
const _ = require('lodash')
const redis = require('redis')

const logger = require('@jadepool/logger').of('RedisMessager')

class RedisMessager {
  /**
   * @param {redis.RedisClient} redisClient
   * @param {String} streamKey
   * @param {String} groupName
   */
  constructor (redisClient, streamKey, groupName = undefined) {
    if (!(redisClient instanceof redis.RedisClient)) {
      throw new Error('first parameter should be redis.RedisClient')
    }
    if (typeof streamKey !== 'string') {
      throw new Error('need streamKey and groupName')
    }
    this._redisClient = redisClient
    this._streamKey = streamKey
    this._defaultGroup = groupName
  }
  /**
   * 确保Group存在
   * @param {String} groupName
   */
  async ensureGroup (groupName) {
    groupName = groupName || this._defaultGroup
    if (typeof groupName !== 'string') {
      throw new Error('require group Name')
    }
    const xinfoAsync = promisify(this._redisClient.xinfo).bind(this._redisClient)
    const xgroupAsync = promisify(this._redisClient.xgroup).bind(this._redisClient)
    // check and create consumer group
    let theGroup
    try {
      const groups = (await xinfoAsync('GROUPS', this._streamKey)) || []
      theGroup = groups.find(group => group[1] === groupName)
    } catch (err) {}
    if (!theGroup) {
      try {
        await xgroupAsync('CREATE', this._streamKey, groupName, '$', 'MKSTREAM')
        logger.tag(this._streamKey, 'Create Group').log(`group=${groupName}`)
      } catch (err) {
        logger.tag(this._streamKey).warn(`failed-to-create-group. error(${err.message})`)
      }
    }
  }
  /**
   * 添加消息
   * @param {Object[]} msgs
   * @param {Object} opts
   * @param {Number} [opts.maxLen=10000]
   */
  addMessagesMulti (msgs, opts = {}) {
    const multi = this._redisClient.multi()
    const maxLen = opts.maxLen || 10000
    // 添加message
    msgs = msgs.filter(m => typeof m === 'object')
    for (let i = 0; i < msgs.length; i++) {
      const data = msgs[i]
      const record = []
      for (const key in data) {
        if (!data.hasOwnProperty(key)) continue
        record.push(key, data[key])
      }
      multi.xadd(this._streamKey, 'MAXLEN', '~', maxLen, '*', ...record)
    }
    return multi
  }
  /**
   * 添加消息
   * @param {Object[]} msgs
   * @param {Object} opts
   * @param {Number} [opts.maxLen=10000]
   */
  async addMessages (msgs, opts = {}) {
    if (typeof msgs.length !== 'number') return []
    const multi = this.addMessagesMulti(msgs, opts)
    return new Promise((resolve, reject) => { multi.exec(resolve) })
  }
  /**
   * 处理Message
   * @param {Object} opts
   * @param {String} [opts.group=undefined] 默认使用初始化时的defaultGroup
   * @param {Number} [opts.count=1] 获取数量
   * @param {Number} [opts.block=0] 阻塞等待，秒
   * @param {Number} [opts.idleTime=3*60*1000] idle等待，默认3min
   */
  async consumeMessages (consumerName, opts = {}) {
    const xlenAsync = promisify(this._redisClient.xlen).bind(this._redisClient)
    const xreadgroupAsync = promisify(this._redisClient.XREADGROUP).bind(this._redisClient)
    const xpendingAsync = promisify(this._redisClient.xpending).bind(this._redisClient)
    const xclaimAsync = promisify(this._redisClient.XCLAIM).bind(this._redisClient)

    // 确保Key可用
    if ((await xlenAsync(this._streamKey)) === 0) return []
    // 确保Group可用
    const groupName = opts.group || this._defaultGroup
    if (typeof groupName !== 'string') return []

    const count = opts.count || 1

    let reqBasic = ['GROUP', groupName, consumerName, 'COUNT', count]
    let msgs = []
    let msgData
    try {
      const reqArgs = [ reqBasic ]
      if (opts.block) {
        reqArgs.push(['BLOCK', opts.block])
      }
      reqArgs.push(['STREAMS', this._streamKey, '>'])
      // 试试拿新的
      msgData = await xreadgroupAsync(_.flatten(reqArgs))
    } catch (err) {
      logger.tag(this._streamKey).warn(`failed-to-xreadgroup '>'. error(${err.message})`)
    }
    if (!msgData) {
      // 试试拿老的
      try {
        msgData = await xreadgroupAsync(reqBasic.concat(['STREAMS', this._streamKey, '0']))
      } catch (err) {
        logger.tag(this._streamKey).warn(`failed-to-xreadgroup. error(${err.message})`)
      }
    }
    // 新数据设置
    if (msgData && msgData.length > 0) {
      const theMsgs = msgData[0][1] // 该streamKey的msgs列表
      if (_.isArray(theMsgs) && _.isArray(theMsgs[0]) && theMsgs[0].length === 2) {
        msgs = theMsgs
      } else {
        msgs = []
      }
    }
    if (msgs.length === 0) {
      const idleTime = opts.idleTime || 3 * 60 * 1000
      const pendings = (await xpendingAsync(this._streamKey, groupName, '-', '+', 10)) || []
      const idleEnoughItems = pendings.filter(pending => pending[1] !== consumerName && pending[2] > idleTime)
      const idleIds = idleEnoughItems.map(pending => pending[0])
      if (idleIds.length > 0) {
        // 尝试claim无人处理的msg
        let theMsgs
        try {
          theMsgs = await xclaimAsync(this._streamKey, groupName, consumerName, idleTime, ...idleIds)
        } catch (err) {
          logger.tag(this._streamKey).warn(`failed-to-xclaim. error(${err.message})`)
        }
        if (_.isArray(theMsgs) && _.isArray(theMsgs[0]) && theMsgs[0].length === 2) {
          msgs = theMsgs
        } else {
          msgs = []
        }
      }
    }
    const results = []
    for (let i = 0; i < msgs.length; i++) {
      const [ msgId, dataArr ] = msgs[i]
      const data = {}
      if (_.isArray(dataArr)) {
        for (let i = 0; i < dataArr.length; i += 2) {
          data[dataArr[i]] = dataArr[i + 1]
        }
      }
      results.push({ id: msgId, data })
      logger.tag(this._streamKey, 'Msg Found').debug(`group=${groupName},id=${msgId},data=${JSON.stringify(data)},consumer=${consumerName}`)
    }
    return results
  }
  /**
   * 完成Message
   * @param {String[]} msgIds
   * @param {String|undefined} groupName 默认使用初始化时的defaultGroup
   */
  ackMessagesMulti (msgIds, groupName = undefined) {
    const multi = this._redisClient.multi()
    if (typeof msgIds === 'string') msgIds = [ msgIds ]
    groupName = groupName || this._defaultGroup
    if (typeof groupName !== 'string') return multi
    multi.xack(this._streamKey, groupName, ...msgIds)
    logger.tag(this._streamKey, 'Msg Handled').debug(`group=${groupName},ids=${msgIds}`)
    return multi
  }
  /**
   * 完成Message
   * @param {String[]} msgIds
   * @param {String|undefined} groupName 默认使用初始化时的defaultGroup
   */
  async ackMessages (msgIds, groupName = undefined) {
    const multi = this.addMessagesMulti(msgIds, groupName)
    const ids = await new Promise((resolve, reject) => { multi.exec(resolve) })
    return ids
  }
}

module.exports = RedisMessager
