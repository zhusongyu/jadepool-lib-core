const { promisify } = require('util')
const BaseService = require('./core')
const consts = require('../consts')
const NBError = require('../NBError')
const jadepool = require('../jadepool')
const redis = require('../utils/redis')
const rpcHelper = require('../utils/rpcHelper')

const logger = require('@jadepool/logger').of('Service', 'Internal RPC')

const DEFAULT_PORT = 7380
const REDIS_HOST_PREFIX = 'JADEPOOL_SERVICE:INTERNAL_RPC:HOST:'

/**
 * 导出函数
 */
class Service extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.INTERNAL_RPC, services)
  }

  /**
   * 初始化
   * @param {Object} opts
   * @param {String} [opts.namespace=undefined]
   * @param {Number} [opts.port=7380]
   */
  async initialize (opts) {
    this.namespace = opts.namespace || consts.DEFAULT_KEY
    this.port = opts.port || DEFAULT_PORT
    /** @type {Map<string, string>} */
    this.cachedNspMap = new Map()
  }
  /**
   * 该Service的优雅退出函数
   * @param signal 退出信号
   */
  async onDestroy (signal) {
    // end client
    this.cachedNspMap.clear()
    // end server
    const rpcServer = jadepool.getService(consts.SERVICE_NAMES.JSONRPC_SERVER)
    if (rpcServer && this.redisClient && this.redisClient.connected) {
      const redisHostKey = REDIS_HOST_PREFIX + this.namespace
      const url = this._getHostUrl(rpcServer.host, rpcServer.port)
      await this.redisClient.srem(redisHostKey, url)
    }
  }
  /**
   * 构建url
   */
  _getHostUrl (host, port) { return `ws://${host}:${port}` }
  /**
   * 确保redis连接
   */
  async _ensureRedisConnected () {
    const redisClientKey = 'InternalRPC'
    // 确保redis配置正常, 若无法获取该方法将throw error
    this.redisClient = redis.fetchClient(redisClientKey)

    if (!this.redisClient.connected) {
      const result = await new Promise(resolve => this.redisClient.once('state_change', resolve))
      if (!result.ok) {
        logger.warn(`redisClient is not connected`)
        throw new NBError(50000)
      }
    }
  }
  /**
   * 注册本服务的方法
   * @param {String} methodName
   * @param {Function} [func=undefined]
   */
  async registerRPCMethod (methodName, methodFunc = undefined) {
    return this.registerRPCMethods([{ method: methodName, func: methodFunc, encryptResult: false }])
  }
  /**
   * 注册大量服务
   * @param {string[]|{name:string, func?:Function, encryptResult?: boolean}[]} methods
   */
  async registerRPCMethods (methods) {
    await this._ensureRedisConnected()

    // find service
    let rpcServer = jadepool.getService(consts.SERVICE_NAMES.JSONRPC_SERVER)
    if (!rpcServer) {
      rpcServer = await jadepool.registerService(consts.SERVICE_NAMES.JSONRPC_SERVER, {
        // 可能被app service替换，此为默认值
        host: jadepool.env.host || '127.0.0.1',
        port: this.port,
        // 内部签名以timestamp为私钥参数
        authWithTimestamp: true
      })
    }

    const redisHostKey = REDIS_HOST_PREFIX + this.namespace
    const saddAsync = promisify(this.redisClient.sadd).bind(this.redisClient)

    const url = this._getHostUrl(rpcServer.host, rpcServer.port)
    await saddAsync(redisHostKey, url)

    // 注册method到jsonrpc service
    for (let item of methods) {
      let methodName
      let methodFunc
      let encryptResult
      if (typeof item === 'string') {
        methodName = item
      } else if (typeof item === 'object' && typeof item.name === 'string') {
        methodName = item.name
        methodFunc = item.func
        encryptResult = item.encryptResult
      } else {
        continue
      }
      rpcServer.addAcceptableMethod(methodName, methodFunc, encryptResult)
      logger.tag('Registered').log(`namespace=${this.namespace},method=${methodName}`)
    }
    logger.tag('Attach To').log(`url=${url},methods.amount=${methods.length}`)
  }
  /**
   * 调用rpc方法
   * @param {String} namespace
   * @param {String} method
   * @param {any} params
   */
  async invokeRPCMethod (namespace, method, params) {
    // 本地调用
    if (namespace === this.namespace) {
      return jadepool.invokeMethod(method, namespace, params)
    }
    // 远程调用
    let rpcUrl = this.cachedNspMap.get(namespace)
    if (!rpcUrl || !(await rpcHelper.isRPCConnected(rpcUrl))) {
      await this._ensureRedisConnected()
      const srandmemberAysnc = promisify(this.redisClient.srandmember).bind(this.redisClient)
      rpcUrl = await srandmemberAysnc(REDIS_HOST_PREFIX + namespace)
      if (!rpcUrl) throw new NBError(10001, `missing rpc url for namespace: ${namespace}`)
      // 设置缓存
      this.cachedNspMap.set(namespace, rpcUrl)
    }
    return rpcHelper.requestRPC(rpcUrl, method, params)
  }
}

module.exports = Service
