const { promisify } = require('util')
const BaseService = require('./core')
const consts = require('../consts')
const NBError = require('../NBError')
const jadepool = require('../jadepool')
const redis = require('../utils/redis')
const rpcHelper = require('../utils/rpcHelper')

const logger = require('@jadepool/logger').of('Service', 'Internal RPC')

const REDIS_HOST_PREFIX = 'JADEPOOL_SERVICE:INTERNAL_RPC:HOST:'

/**
 * 导出函数
 */
class Service extends BaseService {
  /**
   * 初始化
   * @param {Object} opts
   * @param {String} [opts.namespace=undefined]
   * @param {Number} [opts.port=50000]
   */
  async initialize (opts) {
    this.namespace = opts.namespace || consts.DEFAULT_KEY
    this.port = opts.port || 50000
    /** @type {Map<string, string>} */
    this.cachedNspMap = new Map()

    const redisClientKey = 'InternalRPC'
    // 确保redis配置正常, 若无法获取该方法将throw error
    await redis.getOpts(redisClientKey)
    this.redisClient = redis.fetchClient(redisClientKey)
  }
  /**
   * 该Service的优雅退出函数
   * @param signal 退出信号
   */
  async onDestroy (signal) {
    // end client
    for (const rpcUrl of this.cachedNspMap.values) {
      const rpcClient = jadepool.getService(consts.SERVICE_NAMES.JSONRPC)
      await rpcClient.closeRPCServer(rpcUrl)
    }
    // end server
    const rpcServer = jadepool.getService(consts.SERVICE_NAMES.JSONRPC_SERVER)
    if (rpcServer && this.redisClient.connected) {
      const redisHostKey = REDIS_HOST_PREFIX + this.namespace
      await this.redisClient.srem(redisHostKey, `${rpcServer.host}:${rpcServer.port}`)
    }
  }
  /**
   * 确保redis连接
   */
  _ensureRedisConnected () {
    if (!this.redisClient.connected) {
      logger.warn(`redisClient is not connected`)
      throw new NBError(50000)
    }
  }
  /**
   * 注册本服务的方法
   * @param {String} methodName
   * @param {Function} [func=undefined]
   */
  async registerRPCMethod (methodName, methodFunc = undefined) {
    return this.registerRPCMethods([{ method: methodName, func: methodFunc }])
  }
  /**
   * 注册大量服务
   * @param {string[]|{method:string, func?:Function}[]} methods
   */
  async registerRPCMethods (methods) {
    this._ensureRedisConnected()

    // find service
    let rpcServer = jadepool.getService(consts.SERVICE_NAMES.JSONRPC_SERVER)
    if (!rpcServer) {
      const host = jadepool.env.host || '127.0.0.1'
      rpcServer = await jadepool.registerService(consts.SERVICE_NAMES.JSONRPC_SERVER, { host, port: this.port })
    }

    const redisHostKey = REDIS_HOST_PREFIX + this.namespace
    const saddAsync = promisify(this.redisClient.sadd).bind(this.redisClient)
    await saddAsync(redisHostKey, `ws://${rpcServer.host}:${rpcServer.port}`)

    // 注册method到jsonrpc service
    for (let item of methods) {
      let methodName
      let methodFunc
      if (typeof item === 'string') {
        methodName = item
      } else if (typeof item === 'object' && typeof item.method === 'string') {
        methodName = item.method
        methodFunc = item.func
      } else {
        continue
      }
      rpcServer.addAcceptableMethod(methodName, methodFunc)
      logger.tag('Registered').info(`namespace=${this.namespace},method=${methodName}`)
    }
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
      this._ensureRedisConnected()
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
