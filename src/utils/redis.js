const _ = require('lodash')
const url = require('url')
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
      opts = _.isString(cfg) ? { url: cfg } : _.clone(cfg)
    }
    // dev环境中，若无法获得地址则使用默认数据
    if (_.isEmpty(opts) && !jp.env.isProd) {
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
      const redisOpts = _.assign({}, redisLib.getOpts(name), defaultOpts)
      client = redis.createClient(redisOpts)
      const redisUrlData = redisOpts.url ? new url.URL(redisOpts.url) : redisOpts
      const logStr = `name=${name},host=${redisUrlData.host},db=${redisUrlData.db || redisUrlData.pathname || 0}`
      client.on('error', function (err) {
        if (err.code === 'CONNECTION_BROKEN') {
          // 无法重连时
          if (clientMap.has(name)) {
            clientMap.delete(name)
            client.quit()
          }
          logger.tag('Broken').warn(logStr)
        } else if (err.code === 'NR_CLOSED') {
          // 连接断开时
          logger.tag('Closed').warn(logStr)
        } else if (err instanceof redis.AbortError) {
          logger.tag('Abort').error(logStr, err)
        }
        client.emit('state_change', { event: 'error', code: err.code })
      }).on('ready', function () {
        logger.tag('Ready').log(logStr)
        client.emit('state_change', { event: 'ready', ok: true })
      }).on('reconnecting', function () {
        logger.tag('Reconnecting').log(logStr)
        client.emit('state_change', { event: 'reconnecting' })
      })
      clientMap.set(name, client)
    }
    return client
  }
}

module.exports = redisLib
