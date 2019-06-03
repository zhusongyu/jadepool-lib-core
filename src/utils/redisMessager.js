const { promisify } = require('util')
const redis = require('redis')

const logger = require('@jadepool/logger').of('RedisMessager')

class RedisMessager {
  /**
   * @param {redis.RedisClient} redisClient
   * @param {String} streamKey
   * @param {String} groupName
   */
  constructor (redisClient, streamKey, groupName) {
    if (!(redisClient instanceof redis.RedisClient)) {
      throw new Error('first parameter should be redis.RedisClient')
    }
    if (typeof streamKey !== 'string' || typeof groupName !== 'string') {
      throw new Error('need streamKey and groupName')
    }
    this._redisClient = redisClient
    this._streamKey = streamKey
    this._group = groupName
  }
  /**
   * 添加消息
   * @param {Object[]} msgs
   * @param {Object} opts
   * @param {Number} [opts.maxLen=10000]
   */
  async addMessages (msgs, opts = {}) {
    if (typeof msgs.length !== 'number') return []
    const xaddAsync = promisify(this._redisClient.xadd).bind(this._redisClient)
    const maxLen = opts.maxLen || 10000
    // 添加message
    msgs = msgs.filter(m => typeof m === 'object')
    const ids = []
    for (let i = 0; i < msgs.length; i++) {
      const data = msgs[i]
      const record = []
      for (const key in data) {
        if (!data.hasOwnProperty(key)) continue
        record.push(key, data[key])
      }
      ids.push(await xaddAsync(this._streamKey, 'MAXLEN', '~', maxLen, '*', ...record))
    }
    logger.tag(this._streamKey).log(`stream.added=${msgs.length}`)

    const xinfoAsync = promisify(this._redisClient.xinfo).bind(this._redisClient)
    const xgroupAsync = promisify(this._redisClient.xgroup).bind(this._redisClient)
    // create consumer group
    const groups = (await xinfoAsync('GROUPS', this._streamKey)) || []
    const theGroup = groups.find(group => group[1] === this._group)
    if (!theGroup) {
      await xgroupAsync('CREATE', this._streamKey, this._group, '$', 'MKSTREAM')
      logger.tag(this._streamKey).log(`stream.group=${this._group}`)
    }
    return ids
  }
  /**
   * 处理Message
   * @param {Object} opts
   * @param {Number} [opts.count=1] 获取数量
   * @param {Number} [opts.block=1000] 阻塞等待
   * @param {Number} [opts.idleTime=3*60*1000] idle等待，默认3min
   */
  async consumeMessages (consumerName, opts = {}) {
    const xlenAsync = promisify(this._redisClient.xlen).bind(this._redisClient)
    const xreadgroupAsync = promisify(this._redisClient.XREADGROUP).bind(this._redisClient)
    const xpendingAsync = promisify(this._redisClient.xpending).bind(this._redisClient)
    const xclaimAsync = promisify(this._redisClient.XCLAIM).bind(this._redisClient)

    // 确保Key可用
    if ((await xlenAsync(this._streamKey)) === 0) return []

    const count = opts.count || 1
    const block = opts.block || 1000

    let msgs = []
    let msgData
    try {
      // 试试拿新的
      msgData = await xreadgroupAsync('GROUP', this._group, consumerName, 'COUNT', count, 'BLOCK', block, 'STREAMS', this._streamKey, '>')
    } catch (err) {}
    if (!msgData) {
      // 试试拿老的
      try {
        msgData = await xreadgroupAsync('GROUP', this._group, consumerName, 'COUNT', count, 'STREAMS', this._streamKey, '0')
      } catch (err) {}
    }
    // 新数据设置
    if (msgData && msgData.length > 0) {
      msgs = msgData[0][1] // 该streamKey的msgs列表
    }
    if (msgs.length === 0) {
      const idleTime = opts.idleTime || 3 * 60 * 1000
      const pendings = (await xpendingAsync(this._streamKey, this._group, '-', '+', 10)) || []
      const idleEnoughItems = pendings.filter(pending => pending[1] !== consumerName && pending[2] > idleTime)
      const idleIds = idleEnoughItems.map(pending => pending[0])
      if (idleIds.length > 0) {
        // 尝试claim无人处理的msg
        msgs = await xclaimAsync(this._streamKey, this._group, consumerName, idleTime, ...idleIds)
      }
    }
    const results = []
    for (let i = 0; i < msgs.length; i++) {
      const [ msgId, dataArr ] = msgs[i]
      const data = {}
      for (let i = 0; i < dataArr.length; i += 2) {
        data[dataArr[i]] = dataArr[i + 1]
      }
      results.push({ id: msgId, data })
      logger.tag(this._streamKey, 'New Found').log(`id=${msgId},data=${JSON.stringify(data)},consumer=${consumerName}`)
    }
    return results
  }
  /**
   * 完成Message
   * @param {String[]} msgIds
   */
  async ackMessages (msgIds) {
    if (typeof msgIds === 'string') msgIds = [ msgIds ]
    const xackAsync = promisify(this._redisClient.XACK).bind(this._redisClient)
    const ids = await xackAsync(this._streamKey, this._group, ...msgIds)
    logger.tag(this._streamKey, 'Msg Handled').log(`msg.id=${msgIds}`)
    return ids
  }
}

module.exports = RedisMessager
