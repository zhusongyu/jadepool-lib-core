const _ = require('lodash')
const { promisify } = require('util')

const BaseService = require('./core')
const jadepool = require('../jadepool')
const consts = require('../consts')
const { assert, RedisMessager } = require('../utils')

const logger = require('@jadepool/logger').of('Service', 'Message Queue')

class Service extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.MSG_QUEUE, services)
  }

  /**
   * 初始化
   * @param {Object} opts
   */
  async initialize (opts) {
    /**
     * @type {Map<string, {messager: RedisMessager, groups: Set<string>, idPool: number[]}>}
     */
    this.instances = new Map()
  }

  /**
   * 该Service的优雅退出函数
   * @param signal 退出信号
   */
  async onDestroy (signal) {
    let multi
    // 删除全部 group 中的 consumers
    this.instances.forEach((ins, key) => {
      ins.groups.forEach(groupName => {
        if (!_.isString(groupName)) return
        ins.idPool.forEach(consumerId => {
          const consumerName = consumerId + '@' + jadepool.env.processKey
          multi = ins.messager.removeConsumerMulti(consumerName, groupName, multi)
        })
      })
    })
    if (multi !== undefined) {
      try {
        new Promise((resolve, reject) => { multi.exec(resolve) })
      } catch (err) {
        logger.warn(err.message)
      }
    } // end if
  }

  /**
   * 获取 redis messagers
   * @param {string} streamKey
   * @param {string} defaultGroup
   */
  getMQInstance (streamKey, defaultGroup) {
    let ins = this.instances.get(streamKey)
    if (!ins) {
      ins = {
        messager: new RedisMessager(streamKey, defaultGroup),
        groups: new Set(),
        idPool: _.range(10)
      }
      if (defaultGroup) ins.groups.add(defaultGroup)
      this.instances.set(streamKey, ins)
    }
    // 添加 group
    ins.groups.add(defaultGroup)
    return ins
  }

  /**
   * 塞入消息队列
   * @param {string} msgKey
   * @param {object[]} msgs
   * @param {object} opts
   * @param {string} [opts.group=undefined] ensure group
   * @param {boolean} [opts.attachGroup=false] attach group to uid
   */
  async addMessages (msgKey, msgs, opts = {}) {
    assert(_.isString(msgKey), `parameter: msgKey`)
    assert(_.isArray(msgs), `parameter: msgs`)

    // 将消息塞入redis 消息队列
    const streamKey = msgKey + '_STREAM'
    const setKey = msgKey + '_UNIQUE_IDS'

    // init group names
    let groupNames = []
    if (typeof opts.group === 'string') {
      groupNames = opts.group.split(',')
      if (opts.attachGroup) {
        msgs = _.flatMap(msgs, msg => {
          if (!msg.uid) return msg
          return groupNames.map(groupName => Object.assign({}, msg, { uid: msg.uid + '@' + groupName }))
        })
      }
    }
    // 获取此处使用mgr
    const redisMgr = this.getMQInstance(streamKey).messager

    // uid 检测
    const uniqueIds = _.map(msgs, msg => msg.uid).filter(msg => !!msg)
    let pickedMsgs = msgs
    if (uniqueIds.length > 0) {
      const pick = []
      const isMemberAsync = promisify(redisMgr.redisClient.SISMEMBER).bind(redisMgr.redisClient)
      for (let i = 0; i < uniqueIds.length; i++) {
        const id = uniqueIds[i]
        if (await isMemberAsync(setKey, String(id))) continue
        pick.push(id)
      }
      pickedMsgs = _.filter(msgs, msg => _.includes(pick, msg.uid))
    }
    logger.tag(msgKey).log(`checking.amt=${msgs.length},picked.amt=${pickedMsgs.length}`)

    // 添加可添加的 msgs
    if (pickedMsgs.length > 0) {
      // 确保group存在
      if (groupNames.length > 0) {
        for (let i = 0; i < groupNames.length; i++) {
          await redisMgr.ensureGroup(groupNames[i])
        }
      }
      // 推送消息
      const multi = redisMgr.addMessagesMulti(pickedMsgs, opts)
      // 存在uid
      if (uniqueIds.length > 0) {
        multi.sadd(setKey, ...pickedMsgs.map(msg => String(msg.uid)))
      }
      await new Promise(resolve => multi.exec(resolve))
    } // end if
  }

  /**
   * 消费消息队列
   * @param {string} msgKey
   * @param {string} group
   * @param {String|Function} method
   * @param {object} opts
   * @param {string} [opts.namespace=undefined] 当 method 为 string 时有用
   * @param {boolean} [opts.attachGroup=false] 仅对 uid 分组提取有用
   * @param {number} [opts.sameInterval=undefined] 同名 msg 处理的间隔
   * @param {number} [opts.msgCount=1] 一批获取多少个
   * @param {number} [opts.msgIdleTime=undefined] 每次获取的等待时间
   * @param {Function} [opts.onSucceed=undefined] 成功后执行的代码
   * @param {Function} [opts.onFailure=undefined] 失败后执行的代码
   */
  async consumeMessages (msgKey, group, method, opts = {}) {
    assert(typeof msgKey === 'string', `parameter: msgKey`)
    assert(typeof group === 'string', `parameter: group`)
    assert(typeof method === 'string' || typeof method === 'function', `parameter: method`)
  
    // 从redis获取需要执行的消息
    const streamKey = msgKey + '_STREAM'
    const setKey = msgKey + '_UNIQUE_IDS'
    const cacheKeyPrefix = msgKey + '_CACHE_KEYS:'

    const ins = this.getMQInstance(streamKey, group)
    const redisMgr = ins.messager
    // 提取一个 consumerId
    const pickId = ins.idPool.length > 0 ? ins.idPool.shift() : ins.idPool.length
    const consumerName = pickId + '@' + jadepool.env.processKey
    // 消费 messages
    const msgs = await redisMgr.consumeMessages(consumerName, {
      group: group,
      count: opts.msgCount || 1,
      idleTime: opts.msgIdleTime
    })
    // 归还 consumerId
    ins.idPool.push(pickId)
    // 检测是否存在 msgs
    if (!msgs || msgs.length === 0) return
  
    const getAsync = promisify(redisMgr.redisClient.GET).bind(redisMgr.redisClient)
  
    // 批量处理msgs
    await Promise.all(msgs.map(async msg => {
      const uid = msg.data && msg.data.uid
      // sameInterval 存在时，必须上一个循环已过期，方可进行下一轮
      if (typeof opts.sameInterval === 'number') {
        const val = await getAsync(cacheKeyPrefix + uid)
        if (val) return
      }
      let result
      let noNeedRemoveUid = false
      try {
        if (opts.attachGroup && typeof uid === 'string' && uid.indexOf(`@${group}`) === -1) {
          // 仅处理uid中带有相同group的
          result = true
          noNeedRemoveUid = true
        } else if (typeof method === 'function') {
          result = await method(msg.data)
        } else if (typeof method === 'string') {
          result = await jadepool.invokeMethod(method, opts.namespace, msg.data)
        }
      } catch (err) {
        result = false
      }
      // 设置完成
      if (result) {
        const multi = redisMgr.ackMessagesMulti([ msg.id ])
        if (typeof uid === 'string' && !noNeedRemoveUid) {
          // 若存在uid，则移出unique队列
          multi.srem(setKey, uid)
          // 若存在sameInterval，则设置一个sameid标记位
          if (typeof opts.sameInterval === 'number') {
            multi.set(cacheKeyPrefix + uid, 'HOLDING', 'EX', opts.sameInterval)
            logger.tag(uid, 'Next').log(`interval=${opts.sameInterval}s`)
          }
        } // end uid exists
        await new Promise(resolve => multi.exec(resolve))
        // hook
        if (typeof opts.onSucceed === 'function') {
          try {
            await opts.onSucceed(result, msg.data)
          } catch (err) {
            logger.warn(err.message)
          }
        } // 完成onSuccess
      } else if (typeof opts.onFailure === 'function') {
        // 失败回调
        try {
          await opts.onFailure(msg.data)
        } catch (err) {
          logger.warn(err.message)
        }
      } // end if
      return result
    }))
  }
}

module.exports = Service
