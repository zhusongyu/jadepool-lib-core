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
    const chainCfg = await this.loadConfig('chain', chainKey)
    chainCfg.key = chainKey
    return chainCfg
  }
  async loadCoinCfg (chainKey, tokenNameOrAssetIdOrContract) {
    const baseKey = REDIS_CFG_CACHE_PREFIX + `CHAINS:${chainKey}:`
    const hgetAsync = promisify(this.redisClient.HGET).bind(this.redisClient)
    const getAsync = promisify(this.redisClient.GET).bind(this.redisClient)

    let coinName = await hgetAsync(baseKey + 'ALIAS', tokenNameOrAssetIdOrContract)
    coinName = coinName || tokenNameOrAssetIdOrContract
    
    let parentId = await getAsync(baseKey + 'ID')
    if (!parentId) {
      const chainCfg = await this.loadConfig('chain', chainKey)
      if (chainCfg) parentId = chainCfg.id
    }
    if (!parentId) return null
    const tokenCfg = await this.loadConfig('tokens', coinName, parentId)
    tokenCfg.name = coinName
    return tokenCfg
  }
  async loadAllChainNames (includeDisabled = false) {
    return this.loadConfigKeys('chain', undefined, includeDisabled)
  }
  async loadAllCoinNames (chainKey, includeDisabled = false) {
    const baseKey = REDIS_CFG_CACHE_PREFIX + `CHAINS:${chainKey}:ID`
    const getAsync = promisify(this.redisClient.GET).bind(this.redisClient)

    let parentId = await getAsync(baseKey)
    if (!parentId) {
      const chainCfg = await this.loadConfig('chain', chainKey)
      if (chainCfg) parentId = chainCfg.id
    }
    if (!parentId) return null
    return this.loadConfigKeys('tokens', parentId, includeDisabled)
  }
  // 通用方法
  setAutoSaveWhenLoad (flag) {
    throw new NBError(20205, `invalid method: setAutoSaveWhenLoad`)
  }
  setAliasConfigPath (cfgPath, key, aliasPath) {
    throw new NBError(20205, `invalid method: setAliasConfigPath`)
  }
  async loadConfigKeys (path, parent = undefined, includeDisabled = true) {
    const pathId = path + `@${parent || 'root'}`
    const baseKey = REDIS_CFG_CACHE_PREFIX + `KEYS:${pathId}:`
    const redisKeys = [ baseKey + 'ENABLED' ]
    if (includeDisabled) redisKeys.push(baseKey + 'DISABLED')

    const sunionAsync = promisify(this.redisClient.SUNION).bind(this.redisClient)
    return sunionAsync(redisKeys)
  }
  async loadConfig (path, key, parent = undefined) {
    const pathId = path + `@${parent || 'root'}`
    const redisKey = REDIS_CFG_CACHE_PREFIX + `DATA:${pathId}:${key}`
    const getAsync = promisify(this.redisClient.GET).bind(this.redisClient)

    const resultStr = await getAsync(redisKey)
    if (!resultStr) return null
    try {
      return JSON.parse(resultStr)
    } catch (err) {
      return null
    }
  }
  async saveConfig (path, key, modJson, disabled = false, parent = undefined) {
    throw new NBError(20205, `invalid method: saveConfig`)
  }
  async deleteConfig (path, key, parent = undefined) {
    throw new NBError(20205, `invalid method: deleteConfig`)
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
    
    // 代理函数
    const allMethodDescs = Object.getOwnPropertyDescriptors(HostConfigService.prototype)
    for (const methodKey in allMethodDescs) {
      if (methodKey === 'constructor' || methodKey === 'initialize' || methodKey === 'onDestroy') continue
      rpcServer.addAcceptableMethod(methodKey, async (params, ws) => this[methodKey].apply(this, _.values(params)))
    }
  }
  /**
   * 该Service的优雅退出函数
   * @param signal 退出信号
   */
  async onDestroy (signal) {
    // 退出rpcServer注册
    await super.onDestroy(signal)
    let rpcServer = jadepool.getService(consts.SERVICE_NAMES.JSONRPC_SERVER)
    // 移除方法
    const allMethodDescs = Object.getOwnPropertyDescriptors(HostConfigService.prototype)
    for (const methodKey in allMethodDescs) {
      if (methodKey === 'constructor' || methodKey === 'initialize' || methodKey === 'onDestroy') continue
      rpcServer.removeAcceptableMethod(methodKey)
    }
  }
  // 便捷查询方法
  async loadChainCfg (chainKey) {
    let chainCfg = await super.loadChainCfg(chainKey)
    if (chainCfg) return chainCfg
    // 本地读取
  }
  async loadCoinCfg (chainKey, tokenNameOrAssetIdOrContract) {
    // TODO
  }
  async loadAllChainNames (includeDisabled = false) {
    // TODO
  }
  // 通用方法
  setAutoSaveWhenLoad (flag) {
    // TODO
  }
  setAliasConfigPath (cfgPath, key, aliasPath) {
    // TODO
  }
  async loadConfigKeys (path, parent = undefined) {
    // TODO
  }
  async loadConfig (path, key, parent = undefined) {
    // TODO
  }
  async saveConfig (path, key, modJson, disabled = false, parent = undefined) {
    // TODO
  }
  async deleteConfig (path, key, parent = undefined) {
    // TODO
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
