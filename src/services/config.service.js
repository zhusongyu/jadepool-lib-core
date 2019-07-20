const _ = require('lodash')
const { promisify } = require('util')
const BaseService = require('./core')
const consts = require('../consts')
const NBError = require('../NBError')
const jadepool = require('../jadepool')
const redis = require('../utils/redis')
const configLoader = require('../utils/config/loader')

const logger = require('@jadepool/logger').of('Service', 'Config')

const DEFAULT_PORT = 7380
const REDIS_HOST_KEY = 'JADEPOOL_SERVICE:CONFIG:HOST'
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
    if (!chainCfg) return null
    chainCfg.key = chainKey
    return chainCfg
  }
  async loadCoinCfg (chainKey, tokenNameOrAssetIdOrContract) {
    const hgetAsync = promisify(this.redisClient.HGET).bind(this.redisClient)
    const getAsync = promisify(this.redisClient.GET).bind(this.redisClient)
    
    const aliasKey = REDIS_CFG_CACHE_PREFIX + `CHAINS:${chainKey}:ALIAS`
    let coinName = await hgetAsync(aliasKey, tokenNameOrAssetIdOrContract)
    coinName = coinName || tokenNameOrAssetIdOrContract
    
    const idRedisKey = REDIS_CFG_CACHE_PREFIX + `ID:chain@root:${key}`
    let parentId = await getAsync(idRedisKey)
    if (!parentId) {
      const chainCfg = await this.loadConfig('chain', chainKey)
      if (chainCfg) parentId = chainCfg.id
    }
    if (!parentId) return null
    const tokenCfg = await this.loadConfig('tokens', coinName, parentId)
    if (!tokenCfg) return null
    tokenCfg.name = coinName
    return tokenCfg
  }
  async loadAllChainNames (includeDisabled = false) {
    return this.loadConfigKeys('chain', undefined, includeDisabled)
  }
  async loadAllCoinNames (chainKey, includeDisabled = false) {
    const idRedisKey = REDIS_CFG_CACHE_PREFIX + `ID:chain@root:${chainKey}`
    const getAsync = promisify(this.redisClient.GET).bind(this.redisClient)

    let parentId = await getAsync(idRedisKey)
    if (!parentId) {
      const chainCfg = await this.loadConfig('chain', chainKey)
      if (chainCfg) parentId = chainCfg.id
    }
    if (!parentId) return null
    return this.loadConfigKeys('tokens', parentId, includeDisabled)
  }
  // 通用方法
  async loadConfigKeys (path, parent = undefined, includeDisabled = true) {
    const pathId = path + `@${parent || 'root'}`
    const redisKey = REDIS_CFG_CACHE_PREFIX + `KEYS:${pathId}:${includeDisabled ? 'ALL' : 'ENABLED'}`

    const smemberAsync = promisify(this.redisClient.SMEMBERS).bind(this.redisClient)
    return smemberAsync(redisKey)
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
  // 写入型方法无默认实现
  setAutoSaveWhenLoad (flag) {
    throw new NBError(20205, `invalid method: setAutoSaveWhenLoad`)
  }
  setAliasConfigPath (cfgPath, key, aliasPath) {
    throw new NBError(20205, `invalid method: setAliasConfigPath`)
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
    await super.initialize(opts)
    // check required
    let rpcServer = jadepool.getService(consts.SERVICE_NAMES.JSONRPC_SERVER)
    if (!rpcServer) {
      const host = jadepool.env.host || '127.0.0.1'
      const port = DEFAULT_PORT
      rpcServer = await jadepool.registerService(consts.SERVICE_NAMES.JSONRPC_SERVER, { host, port })
    }
    await this.redisClient.sadd(REDIS_HOST_KEY, `${rpcServer.host}:${rpcServer.port}`)
    
    // 代理函数
    const allMethodDescs = Object.getOwnPropertyDescriptors(RedisConfigService.prototype)
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
    const rpcServer = jadepool.getService(consts.SERVICE_NAMES.JSONRPC_SERVER)
    await this.redisClient.srem(REDIS_HOST_KEY, `${rpcServer.host}:${rpcServer.port}`)
    // 移除方法
    const allMethodDescs = Object.getOwnPropertyDescriptors(RedisConfigService.prototype)
    for (const methodKey in allMethodDescs) {
      if (methodKey === 'constructor' || methodKey === 'initialize' || methodKey === 'onDestroy') continue
      rpcServer.removeAcceptableMethod(methodKey)
    }
    // 退出rpcServer注册
    await super.onDestroy(signal)
  }
  // 便捷查询方法
  async loadChainCfg (chainKey) {
    let cfg = await super.loadChainCfg(chainKey)
    if (cfg) return cfg
    cfg = await this._loadConfig('chain', chainKey)
    if (!cfg) return null
    cfg.key = chainKey
    return cfg
  }
  async loadCoinCfg (chainKey, tokenNameOrAssetIdOrContract) {
    let cfg = await super.loadCoinCfg(chainKey, tokenNameOrAssetIdOrContract)
    if (cfg) return cfg
    // 拉取chain信息
    const chainCfg = await this.loadChainCfg(chainKey)
    if (!chainCfg) return null
    const coinName = tokenNameOrAssetIdOrContract
    // 此时读取时只能通过tokenName获取
    cfg = await this._loadConfig('tokens', coinName, chainCfg.id)
    if (!cfg) return null
    // 设置别名缓存
    let msetParams = []
    const coinCfg = cfg.coin || {}
    for (let key in coinCfg) {
      if (key === 'TokenName' ||
        key === 'Contract' ||
        key === 'contract' ||
        key === 'assetId' ||
        key === 'address') {
        msetParams.push(coinCfg[key], coinName)
      }
    }
    if (msetParams.length > 0) {
      const aliasKey = REDIS_CFG_CACHE_PREFIX + `CHAINS:${chainKey}:ALIAS`
      const msetAsync = promisify(this.redisClient.MSET).bind(this.redisClient)
      await msetAsync(aliasKey, msetParams)
    }
    // 设置tokenName
    cfg.name = coinName
    return cfg
  }
  async loadAllChainNames (includeDisabled = false) {
    let results = await super.loadAllChainNames(includeDisabled)
    if (results && results.length > 0) return results
    return this._loadConfigKeys('chain', undefined, includeDisabled)
  }
  async loadAllCoinNames (chainKey, includeDisabled = false) {
    let results = await super.loadAllCoinNames(chainKey, includeDisabled)
    if (results && results.length > 0) return results
    // 拉取chain信息
    const chainCfg = await this.loadChainCfg(chainKey)
    if (!chainCfg) return null
    return this._loadConfigKeys('tokens', chainCfg.id, includeDisabled, true)
  }
  // 通用方法
  async loadConfigKeys (path, parent = undefined, includeDisabled = true) {
    let results = await super.loadConfigKeys(path, parent, includeDisabled)
    if (results && results.length > 0) return results
    return this._loadConfigKeys(path, parent, includeDisabled)
  }
  async loadConfig (path, key, parent = undefined) {
    let result = await super.loadConfig(path, key, parent)
    if (result) return result
    return this._loadConfig(path, key, parent)
  }
  async _loadConfig (path, key, parent = undefined) {
    // 进行读取并写入redis
    const dat = await configLoader.loadConfig(path, key, parent)
    const jsonCfg = dat.toMerged()
    jsonCfg.id = String(dat._id)
    await this._setDataToRedis(path, key, parent, jsonCfg.id, jsonCfg)
    return jsonCfg
  }
  /**
   * 设置缓存数据到redis
   */
  async _setDataToRedis (path, key, parent, id, jsonData) {
    const pathId = path + `@${parent || 'root'}`
    const idRedisKey = REDIS_CFG_CACHE_PREFIX + `ID:${pathId}:${key}`
    const dataRedisKey = REDIS_CFG_CACHE_PREFIX + `DATA:${pathId}:${key}`
    // 存入redis
    const multi = this.redisClient.multi()
    multi.set(idRedisKey, id)
    multi.set(dataRedisKey, JSON.stringify(jsonData), 'EX', REDIS_CFG_CACHE_EXPIRE)
    return new Promise((resolve) => multi.exec(resolve))
  }
  async _loadConfigKeys (path, parent, includeDisabled, ignoreEmpty = false) {
    let keys = await configLoader.loadConfigKeys(path, parent, includeDisabled)
    if (ignoreEmpty) keys = keys.filter(key => key !== '' && key !== '_')
    // 进行读取并写入redis
    const pathId = path + `@${parent || 'root'}`
    const redisKey = REDIS_CFG_CACHE_PREFIX + `KEYS:${pathId}:${includeDisabled ? 'ALL' : 'ENABLED'}`

    const saddAsync = promisify(this.redisClient.SADD).bind(this.redisClient)
    await saddAsync(redisKey, keys)
    return keys
  }
  // 写入类方法
  setAutoSaveWhenLoad (value) {
    return configLoader.setAutoSaveWhenLoad(value)
  }
  setAliasConfigPath (cfgPath, key, aliasPath) {
    return configLoader.setAliasConfigPath(...arguments)
  }
  async deleteConfig (path, key, parent = undefined) {
    return configLoader.deleteConfig(path, key, parent)
  }
  async saveConfig (path, key, modJson, disabled = undefined, parent = undefined) {
    const dat = await configLoader.saveConfig(path, key, modJson, disabled, parent)
    const pathId = path + `@${parent || 'root'}`
    // 移除keys缓存
    if (disabled !== undefined) {
      const delAsync = promisify(this.redisClient.DEL).bind(this.redisClient)
      const key1 = REDIS_CFG_CACHE_PREFIX + `KEYS:${pathId}:ALL`
      const key2 = REDIS_CFG_CACHE_PREFIX + `KEYS:${pathId}:ENABLED`
      await delAsync(key1, key2)
    }
    // 写入DB，更新Redis内的部分状态
    const jsonCfg = dat.toMerged()
    jsonCfg.id = String(dat._id)
    await this._setDataToRedis(path, key, parent, jsonCfg.id, jsonCfg)
    return jsonCfg
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
    await super.initialize(opts)
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
