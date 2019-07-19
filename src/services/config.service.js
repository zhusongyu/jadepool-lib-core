const _ = require('lodash')
const { promisify } = require('util')
const BaseService = require('./core')
const consts = require('../consts')
const NBError = require('../NBError')
const jadepool = require('../jadepool')
const redis = require('../utils/redis')

const logger = require('@jadepool/logger').of('Service', 'Config')

const DEFAULT_PORT = 7380
const REDIS_HOST_KEY = 'JADEPOOL_SERVICE:CONFIG:HOST'
const REDIS_HOST_COUNTER_KEY = 'JADEPOOL_SERVICE:CONFIG:HOST_COUNTER'
const REDIS_CFG_CACHE_EXPIRE = 15 * 60 // 15 min
const REDIS_CFG_CACHE_PREFIX = 'JADEPOOL_SERVICE:CONFIG:CACHE:'

/**
 * 基类
 */
class ConfigService extends BaseService {
  constructor (services) {
    super(consts.SERVICE_NAMES.CONFIG, services)
  }
}

/**
 * 读取redis中的配置数据
 */
class RedisConfigService extends ConfigService {
  /**
   * 初始化
   * @param {Object} opts
   * @param {Boolean} opts.isHost 是否为host型config服务，host型服务负责从DB读取并缓存到redis中
   */
  async initialize (opts) {
    const redisClientKey = 'ConfigRedisClient'
    // 确保redis配置正常, 若无法获取该方法将throw error
    await redis.getOpts(redisClientKey)
    this.redisClient = redis.fetchClient(redisClientKey)
  }
  /**
   * 该Service的优雅退出函数
   * @param signal 退出信号
   */
  async onDestroy (signal) {
    this.redisClient.end()
  }
  // 便捷查询方法
  async loadChainCfg (chainKey) {
    const redisKey = REDIS_CFG_CACHE_PREFIX + `CHAINS:${chainKey}:MAIN`
    const getAsync = promisify(this.redisClient.GET).bind(this.redisClient)

    const resultStr = await getAsync(redisKey)
    if (!resultStr) return null
    try {
      return JSON.parse(resultStr)
    } catch (err) {
      return null
    }
  }
  async loadCoinCfg (chainKey, tokenNameOrAssetIdOrContract) {
    const aliasKey = REDIS_CFG_CACHE_PREFIX + `CHAINS:${chainKey}:ALIAS`
    const hgetAsync = promisify(this.redisClient.HGET).bind(this.redisClient)
    const getAsync = promisify(this.redisClient.GET).bind(this.redisClient)

    let coinName = await hgetAsync(aliasKey, tokenNameOrAssetIdOrContract)
    coinName = coinName || tokenNameOrAssetIdOrContract

    const redisKey = REDIS_CFG_CACHE_PREFIX + `CHAINS:${chainKey}:TOKENS:${coinName}`
    const resultStr = await getAsync(redisKey)
    if (!resultStr) return null
    try {
      return JSON.parse(resultStr)
    } catch (err) {
      return null
    }
  }
  async loadAllChainNames (includeDisabled = false) {
    const redisKeys = [ REDIS_CFG_CACHE_PREFIX + `CHAINS_ENABLED` ]
    if (includeDisabled) redisKeys.push(REDIS_CFG_CACHE_PREFIX + `CHAINS_DISABLED`)
    const sunionAsync = promisify(this.redisClient.SUNION).bind(this.redisClient)
    return sunionAsync(redisKeys)
  }
  async loadAllCoinNames (chainKey, includeDisabled = false) {
    const baseKey = REDIS_CFG_CACHE_PREFIX + `CHAINS:${chainKey}:`
    const redisKeys = [ baseKey + 'ENABLED' ]
    if (includeDisabled) redisKeys.push(baseKey + 'DISABLED')

    const sunionAsync = promisify(this.redisClient.SUNION).bind(this.redisClient)
    return sunionAsync(redisKeys)
  }
  // 通用方法
  setAutoSaveWhenLoad (flag) {
    throw new NBError(20205, `invalid method: setAutoSaveWhenLoad`)
  }
  setAliasConfigPath (cfgPath, key, aliasPath) {
    throw new NBError(20205, `invalid method: setAliasConfigPath`)
  }
  async loadConfigKeys (path, parent = undefined) {

  }
  async loadGeneralCfg (path, key, parent = undefined) {

  }
  async saveGeneralCfg (path, key, modJson, disabled = false, parent = undefined) {
    throw new NBError(20205, `invalid method: saveGeneralCfg`)
  }
  async deleteGeneralCfg (path, key, parent = undefined) {
    throw new NBError(20205, `invalid method: deleteGeneralCfg`)
  }
}

/**
 * host模式：负责对db的读写、缓存到redis、为client提供服务
 */
class HostConfigService extends RedisConfigService {
  /**
   * 初始化
   * @param {Object} opts
   */
  async initialize (opts) {
    // check required
    let rpcServer = jadepool.getService(consts.SERVICE_NAMES.JSONRPC_SERVER)
    if (!rpcServer) {
      const host = jadepool.env.host || '127.0.0.1'
      const incrAsync = promisify(this.redisClient.INCR).bind(this.redisClient)
      const port = parseInt(await incrAsync(REDIS_HOST_COUNTER_KEY)) + DEFAULT_PORT
      rpcServer = await jadepool.registerService(consts.SERVICE_NAMES.JSONRPC_SERVER, { host, port })
    }
    // 添加自定义方法
    rpcServer.addAcceptableMethod('')
  }
  /**
   * 该Service的优雅退出函数
   * @param signal 退出信号
   */
  async onDestroy (signal) {
    // TODO 退出rpcServer注册
    return super.onDestroy(signal)
  }
}

/**
 * client模式：请求host服务
 */
class ClientConfigService extends RedisConfigService {
  /**
   * 初始化
   * @param {Object} opts
   */
  async initialize (opts) {
    // TODO
  }
}

/**
 * 导出函数
 */
class Service extends ConfigService {
  /**
   * 初始化
   * @param {Object} opts
   * @param {Boolean} opts.isHost 是否为host型config服务，host型服务负责从DB读取并缓存到redis中
   */
  async initialize (opts) {
    /**
     * @type {BaseService}
     */
    let serviceAgent
    // 根据不同模式进行初始化
    if (opts.isHost) {
      serviceAgent = new HostConfigService(this.services)
    } else {
      serviceAgent = new ClientConfigService(this.services)
    }
    await serviceAgent.initialize(opts)

    // 代理函数
    const allMethodDescs = Object.getOwnPropertyDescriptors(RedisConfigService.prototype)
    for (const methodKey in allMethodDescs) {
      if (methodKey === 'constructor' || methodKey === 'initialize') continue
      Object.defineProperty(this, methodKey, {
        value: serviceAgent[funcKey].bind(serviceAgent),
        enumerable: false,
        writable: true,
        configurable: true
      })
    }
  }
}

module.exports = Service
