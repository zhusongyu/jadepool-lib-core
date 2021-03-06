const _ = require('lodash')
const { promisify } = require('util')
const BaseService = require('./core')
const consts = require('../consts')
const NBError = require('../NBError')
const jadepool = require('../jadepool')
const redis = require('../utils/redis')
const rpcHelper = require('../utils/rpcHelper')
const configLoader = require('../utils/config/loader')

const logger = require('@jadepool/logger').of('Service', 'Config')

const DEFAULT_PORT = 7380
const REDIS_CFG_CACHE_EXPIRE = 15 * 60 // 15 min
const REDIS_CFG_CACHE_PREFIX = 'JADEPOOL_SERVICE:CONFIG:CACHE:'
const CHAIN_ALIAS_FIELDS = [
  'CoreType',
  'Chain'
]
const TOKEN_ALIAS_FIELDS = [
  'TokenName',
  'Contract',
  'contract',
  'assetId',
  'address'
]

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
    this.redisClient = redis.fetchClient(redisClientKey)
    await new Promise(resolve => this.redisClient.once('state_change', resolve))
  }
  // 便捷查询方法
  async loadChainCfg (keyOrNameOrCoreType) {
    const hgetAsync = promisify(this.redisClient.HGET).bind(this.redisClient)

    const aliasKey = REDIS_CFG_CACHE_PREFIX + `CHAINS_ALIAS`
    let chainKey = await hgetAsync(aliasKey, keyOrNameOrCoreType)
    chainKey = chainKey || keyOrNameOrCoreType

    const chainCfg = await RedisConfigService.prototype.loadConfig.apply(this, ['chain', chainKey])
    if (!chainCfg) return null
    // alias check
    if (chainKey !== keyOrNameOrCoreType &&
      !_.find(CHAIN_ALIAS_FIELDS, field => chainCfg[field] === keyOrNameOrCoreType)) {
      return null
    }
    chainCfg.key = chainKey
    return chainCfg
  }
  async loadCoinCfg (chainKey, tokenNameOrAssetIdOrContract) {
    const hgetAsync = promisify(this.redisClient.HGET).bind(this.redisClient)
    const getAsync = promisify(this.redisClient.GET).bind(this.redisClient)

    const aliasKey = REDIS_CFG_CACHE_PREFIX + `CHAINS:${chainKey}:ALIAS`
    let coinName = await hgetAsync(aliasKey, tokenNameOrAssetIdOrContract)
    coinName = coinName || tokenNameOrAssetIdOrContract

    const idRedisKey = REDIS_CFG_CACHE_PREFIX + `ID:chain@root:${coinName}`
    let parentId = await getAsync(idRedisKey)
    if (!parentId) {
      const chainCfg = await RedisConfigService.prototype.loadConfig.apply(this, ['chain', chainKey])
      if (chainCfg) parentId = chainCfg.id
    }
    if (!parentId) return null
    const tokenCfg = await RedisConfigService.prototype.loadConfig.apply(this, ['tokens', coinName, parentId])
    if (!tokenCfg) return null
    // alias check
    if (coinName !== tokenNameOrAssetIdOrContract &&
      !_.find(TOKEN_ALIAS_FIELDS, field => _.get(tokenCfg, `coin.${field}`) === tokenNameOrAssetIdOrContract)) {
      return null
    }
    tokenCfg.name = coinName
    return tokenCfg
  }
  async loadAllChainNames (includeDisabled = false) {
    return RedisConfigService.prototype.loadConfigKeys.apply(this, ['chain', undefined, includeDisabled])
  }
  async loadAllCoinNames (chainKey, includeDisabled = false) {
    const idRedisKey = REDIS_CFG_CACHE_PREFIX + `ID:chain@root:${chainKey}`
    const getAsync = promisify(this.redisClient.GET).bind(this.redisClient)

    let parentId = await getAsync(idRedisKey)
    if (!parentId) {
      const chainCfg = await RedisConfigService.prototype.loadConfig.apply(this, ['chain', chainKey])
      if (chainCfg) parentId = chainCfg.id
    }
    if (!parentId) return null
    return RedisConfigService.prototype.loadConfigKeys.apply(this, ['tokens', parentId, includeDisabled])
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
  async setAutoSaveWhenLoad (flag) {
    throw new NBError(20205, `invalid method: setAutoSaveWhenLoad`)
  }
  async setAliasConfigPath (cfgPath, key, aliasPath) {
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
   * @param {Number} opts.port
   */
  async initialize (opts) {
    await super.initialize(opts)
    // check required
    const rpcServer = await jadepool.ensureService(consts.SERVICE_NAMES.JSONRPC_SERVER, {
      // 可能被app service替换，此为默认值
      host: jadepool.env.host || '127.0.0.1',
      port: opts.port || DEFAULT_PORT,
      // 内部签名以timestamp为私钥参数
      authWithTimestamp: true
    })
    // Add to consul service
    const url = `ws://${rpcServer.host}:${rpcServer.port}`
    await jadepool.consulSrv.registerService(consts.SERVICE_NAMES.CONFIG, rpcServer.port, {
      host: rpcServer.host,
      url,
      service: 'config.service',
      processKey: jadepool.env.processKey
    })

    // 代理函数
    const allMethodDescs = Object.getOwnPropertyDescriptors(RedisConfigService.prototype)
    for (const methodKey in allMethodDescs) {
      if (methodKey === 'constructor' || methodKey === 'initialize' || methodKey === 'onDestroy') continue
      let handler
      if (methodKey.startsWith('load')) {
        handler = async (params, ws) => this['_' + methodKey].apply(this, _.values(params))
      } else {
        handler = async (params, ws) => this[methodKey].apply(this, _.values(params))
      }
      rpcServer.addAcceptableMethod(methodKey, handler)
    }
    logger.tag('Inited').log(`mode=host,url=${url}`)
  }
  /**
   * 该Service的优雅退出函数
   * @param signal 退出信号
   */
  async onDestroy (signal) {
    // Remove from consul service
    const rpcServer = jadepool.getService(consts.SERVICE_NAMES.JSONRPC_SERVER)
    // 移除方法
    const allMethodDescs = Object.getOwnPropertyDescriptors(RedisConfigService.prototype)
    for (const methodKey in allMethodDescs) {
      if (methodKey === 'constructor' || methodKey === 'initialize' || methodKey === 'onDestroy') continue
      rpcServer.removeAcceptableMethod(methodKey)
    }
  }
  // 便捷查询方法
  async loadChainCfg (chainKey) {
    if (!this._forceLoadFromDB) {
      let cfg = await super.loadChainCfg(chainKey)
      if (cfg) return cfg
    }
    return this._loadChainCfg(chainKey)
  }
  async loadCoinCfg (chainKey, tokenNameOrAssetIdOrContract) {
    if (!this._forceLoadFromDB) {
      let cfg = await super.loadCoinCfg(chainKey, tokenNameOrAssetIdOrContract)
      if (cfg) return cfg
    }
    return this._loadCoinCfg(chainKey, tokenNameOrAssetIdOrContract)
  }
  async loadAllChainNames (includeDisabled = false) {
    if (!this._forceLoadFromDB) {
      let results = await super.loadAllChainNames(includeDisabled)
      if (results && results.length > 0) return results
    }
    return this._loadAllChainNames(includeDisabled)
  }
  async loadAllCoinNames (chainKey, includeDisabled = false) {
    if (!this._forceLoadFromDB) {
      let results = await super.loadAllCoinNames(chainKey, includeDisabled)
      if (results && results.length > 0) return results
    }
    return this._loadAllCoinNames(chainKey, includeDisabled)
  }
  async loadConfigKeys (path, parent = undefined, includeDisabled = true) {
    if (!this._forceLoadFromDB) {
      let results = await super.loadConfigKeys(path, parent, includeDisabled)
      if (results && results.length > 0) return results
    }
    return this._loadConfigKeys(path, parent, includeDisabled)
  }
  async loadConfig (path, key, parent = undefined) {
    if (!this._forceLoadFromDB) {
      let result = await super.loadConfig(path, key, parent)
      if (result) return result
    }
    return this._loadConfig(path, key, parent)
  }
  // 私有方法
  async _loadChainCfg (chainKey) {
    let cfg = await this._loadConfig('chain', chainKey)
    if (!cfg) return null
    // 设置别名缓存
    const msetParams = []
    if (cfg.Chain !== chainKey) msetParams.push(cfg.Chain, chainKey)
    if (cfg.CoreType !== chainKey) msetParams.push(cfg.CoreType, chainKey)
    if (msetParams.length > 0) {
      const aliasKey = REDIS_CFG_CACHE_PREFIX + `CHAINS_ALIAS`
      const hmsetAsync = promisify(this.redisClient.HMSET).bind(this.redisClient)
      await hmsetAsync(aliasKey, msetParams)
    }
    cfg.key = chainKey
    return cfg
  }
  async _loadCoinCfg (chainKey, coinName) {
    // 拉取chain信息
    const chainCfg = await this.loadChainCfg(chainKey)
    if (!chainCfg) return null
    // 此时读取时只能通过tokenName获取
    let cfg = await this._loadConfig('tokens', coinName, chainCfg.id)
    if (!cfg) return null
    // 设置别名缓存
    let msetParams = []
    const coinCfg = cfg.coin || {}
    for (let key in coinCfg) {
      if (!coinCfg[key]) continue
      if (_.includes(TOKEN_ALIAS_FIELDS, key)) {
        msetParams.push(coinCfg[key], coinName)
      }
    }
    if (msetParams.length > 0) {
      const aliasKey = REDIS_CFG_CACHE_PREFIX + `CHAINS:${chainKey}:ALIAS`
      const hmsetAsync = promisify(this.redisClient.HMSET).bind(this.redisClient)
      await hmsetAsync(aliasKey, msetParams)
    }
    // 设置tokenName
    cfg.name = coinName
    return cfg
  }
  async _loadAllChainNames (includeDisabled = false) {
    return this._loadConfigKeys('chain', undefined, includeDisabled)
  }
  async _loadAllCoinNames (chainKey, includeDisabled = false) {
    // 拉取chain信息
    const chainCfg = await this.loadChainCfg(chainKey)
    if (!chainCfg) return null
    return this._loadConfigKeys('tokens', chainCfg.id, includeDisabled, true)
  }
  async _loadConfigKeys (path, parent, includeDisabled, ignoreEmpty = false) {
    let keys = await configLoader.loadConfigKeys(path, parent, includeDisabled)
    if (ignoreEmpty) keys = keys.filter(key => key !== '' && key !== '_')
    if (keys.length > 0) {
      // 进行读取并写入redis
      const pathId = path + `@${parent || 'root'}`
      const redisKey = REDIS_CFG_CACHE_PREFIX + `KEYS:${pathId}:${includeDisabled ? 'ALL' : 'ENABLED'}`
      const saddAsync = promisify(this.redisClient.SADD).bind(this.redisClient)
      await saddAsync(redisKey, keys)
    }
    return keys
  }
  async _loadConfig (path, key, parent = undefined) {
    // 进行读取并写入redis
    const dat = await configLoader.loadConfig(path, key, parent)
    if (!dat) {
      logger.tag('failed-to-load-config').warn(`path=${path},key=${key},path=${parent}`)
      return null
    }
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
  // 写入类方法
  async setAutoSaveWhenLoad (value) {
    this._forceLoadFromDB = value
    return configLoader.setAutoSaveWhenLoad(value)
  }
  async setAliasConfigPath (cfgPath, key, aliasPath) {
    return configLoader.setAliasConfigPath(...arguments)
  }
  async deleteConfig (path, key, parent = undefined) {
    const isSuccess = await configLoader.deleteConfig(path, key, parent)
    // 移除Redis缓存
    if (isSuccess) {
      const delAsync = promisify(this.redisClient.DEL).bind(this.redisClient)
      const pathId = path + `@${parent || 'root'}`
      const idRedisKey = REDIS_CFG_CACHE_PREFIX + `ID:${pathId}:${key}`
      const dataRedisKey = REDIS_CFG_CACHE_PREFIX + `DATA:${pathId}:${key}`
      const key1 = REDIS_CFG_CACHE_PREFIX + `KEYS:${pathId}:ALL`
      const key2 = REDIS_CFG_CACHE_PREFIX + `KEYS:${pathId}:ENABLED`
      await delAsync(idRedisKey, dataRedisKey, key1, key2)
    }
    return isSuccess
  }
  async saveConfig (path, key, modJson, disabled = undefined, parent = undefined) {
    const dat = await configLoader.saveConfig(path, key, modJson, disabled, parent)
    if (!dat) {
      logger.tag('failed-to-save-config').warn(`path=${path},key=${key},path=${parent}`)
      return null
    }
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
    // 确保存在config service
    await jadepool.consulSrv.waitForService(consts.SERVICE_NAMES.CONFIG)
    logger.tag('Inited').log(`mode=client,host=${this._currentHost}`)
  }
  async _tryConnectHost () {
    if (!this._currentHost) {
      // load from consul service
      const serviceData = await jadepool.consulSrv.getServiceData(consts.SERVICE_NAMES.CONFIG)
      logger.tag('TryConnect').log(`host=${serviceData.host},port=${serviceData.port},meta=${JSON.stringify(serviceData.meta)}`)
      this._currentHost = `ws://${serviceData.host}:${serviceData.port}`
    }
    const isConnected = await rpcHelper.isRPCConnected(this._currentHost)
    if (!isConnected) {
      await rpcHelper.joinRPCServer(this._currentHost)
    }
  }
  async _request (method, params, throwWithoutConnection = false) {
    if (!this._currentHost || !(await rpcHelper.isRPCConnected(this._currentHost))) {
      await this._tryConnectHost()
    }
    // 再次检查是否连接
    const isConnected = await rpcHelper.isRPCConnected(this._currentHost)
    if (!isConnected) {
      if (throwWithoutConnection) {
        throw new NBError(21004, `service: config`)
      }
      return null
    }
    return rpcHelper.requestRPC(this._currentHost, method, params, { ignoreConnection: true })
  }
  // 便捷查询方法
  async loadChainCfg (chainKey) {
    let cfg = await super.loadChainCfg(chainKey)
    if (cfg) return cfg
    return this._request('loadChainCfg', arguments)
  }
  async loadCoinCfg (chainKey, tokenNameOrAssetIdOrContract) {
    let cfg = await super.loadCoinCfg(chainKey, tokenNameOrAssetIdOrContract)
    if (cfg) return cfg
    return this._request('loadCoinCfg', arguments)
  }
  async loadAllChainNames (includeDisabled = false) {
    let results = await super.loadAllChainNames(includeDisabled)
    if (results && results.length > 0) return results
    return this._request('loadAllChainNames', arguments)
  }
  async loadAllCoinNames (chainKey, includeDisabled = false) {
    let results = await super.loadAllCoinNames(chainKey, includeDisabled)
    if (results && results.length > 0) return results
    return this._request('loadAllCoinNames', arguments)
  }
  async loadConfigKeys (path, parent = undefined, includeDisabled = true) {
    let results = await super.loadConfigKeys(path, parent, includeDisabled)
    if (results && results.length > 0) return results
    return this._request('loadConfigKeys', arguments)
  }
  async loadConfig (path, key, parent = undefined) {
    let result = await super.loadConfig(path, key, parent)
    if (result) return result
    return this._request('loadConfig', arguments)
  }
  // 写入型方法无默认实现
  async setAutoSaveWhenLoad (flag) {
    return this._request('setAutoSaveWhenLoad', arguments, true)
  }
  async setAliasConfigPath (cfgPath, key, aliasPath) {
    return this._request('setAliasConfigPath', arguments, true)
  }
  async saveConfig (path, key, modJson, disabled = false, parent = undefined) {
    return this._request('saveConfig', arguments, true)
  }
  async deleteConfig (path, key, parent = undefined) {
    return this._request('deleteConfig', arguments, true)
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
        value: serviceAgent[methodKey].bind(serviceAgent),
        enumerable: false,
        writable: true,
        configurable: true
      })
    }
    // 设置agent
    this._serviceAgent = serviceAgent
  }
  async onDestroy (signal) {
    if (this._serviceAgent && this._serviceAgent.onDestroy) {
      await this._serviceAgent.onDestroy(signal)
    }
    delete this._serviceAgent
  }
}

module.exports = Service
