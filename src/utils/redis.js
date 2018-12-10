const _ = require('lodash')
const redis = require('redis')
const jp = require('../jadepool')
const consts = require('../consts')

const logger = require('@jadepool/logger').of('Redis')

/**
 * @type {Map<string, redis.RedisClient>}
 */
const clientMap = new Map()
const defaultOpts = {
  retry_strategy: function (options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      // End reconnecting on a specific error and flush all commands with
      // a individual error
      return new Error('The server refused the connection')
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      // End reconnecting after a specific timeout and flush all commands
      // with a individual error
      return new Error('Retry time exhausted')
    }
    if (options.attempt > 10) {
      // End reconnecting with built in error
      return undefined
    }
    // reconnect after
    return Math.min(options.attempt * 100, 3000)
  }
}

// 导出方法
const redisLib = {
  /**
   * 初始化默认数据库连接
   */
  initialize: async () => {
    // 尝试性获取client
    redisLib.fetchClient()
  },
  /**
   * 获取redis配置
   * @param {string} name
   */
  getOpts (name = consts.DEFAULT_KEY) {
    let opts = {}
    if (_.isString(jp.config.redis)) {
      opts.url = jp.config.redis
    } else if (_.isObject(jp.config.redis)) {
      const cfg = (jp.config.redis[name] || jp.config.redis[consts.DEFAULT_KEY]) || jp.config.redis
      opts = _.clone(cfg)
    }
    // dev环境中，若无法获得地址则使用默认数据
    const nodeEnv = process.env.NODE_ENV
    if (_.isEmpty(opts) && nodeEnv !== 'production') {
      opts.url = `redis://${jp.env.defaultRedis}`
    }
    if (_.isEmpty(opts)) {
      throw new Error(`Missing redis options`)
    }
    return opts
  },
  /**
   * 获取redis实例
   * @param {string} name
   */
  fetchClient (name = consts.DEFAULT_KEY) {
    let client = clientMap.get(name)
    if (!client) {
      client = redis.createClient(_.assign({}, redisLib.getOpts(name), defaultOpts))
      client.on('error', function (err) {
        if (err.code === 'CONNECTION_BROKEN') {
          // 无法重连时
          if (clientMap.has(name)) {
            clientMap.delete(name)
            client.quit()
          }
          logger.tag('Broken').warn(`name=${name}`)
        } else if (err.code === 'NR_CLOSED') {
          // 连接断开时
          logger.tag('Closed').warn(`name=${name}`)
        } else if (err instanceof redis.AbortError) {
          logger.tag('Abort').error(`name=${name}`, err)
        }
      }).on('ready', function () {
        logger.tag('Ready').log(`name=${name}`)
      }).on('reconnecting', function () {
        logger.tag('Reconnecting').log(`name=${name}`)
      })
      clientMap.set(name, client)
    }
    return client
  }
}

module.exports = redisLib
