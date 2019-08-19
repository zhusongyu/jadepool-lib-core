const BaseService = require('./core')
const consts = require('../consts')
const jadepool = require('../jadepool')
const rpcHelper = require('../utils/rpcHelper')

const logger = require('@jadepool/logger').of('Service', 'Internal RPC')

const DEFAULT_PORT = 7380

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
    // find service
    const rpcServer = await jadepool.ensureService(consts.SERVICE_NAMES.JSONRPC_SERVER, {
      // 可能被app service替换，此为默认值
      host: jadepool.env.host || '127.0.0.1',
      port: this.port,
      // 内部签名以timestamp为私钥参数
      authWithTimestamp: true
    })

    // register to consul
    const serviceName = `rpc-${this.namespace}`
    const url = `ws://${rpcServer.host}:${rpcServer.port}`
    await jadepool.consulSrv.registerService(serviceName, rpcServer.port, {
      host: rpcServer.host,
      url,
      service: 'internalrpc.service',
      processKey: jadepool.env.processKey
    })

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
      const serviceName = `rpc-${namespace}`
      const serviceData = await jadepool.consulSrv.getServiceData(serviceName)
      rpcUrl = serviceData.meta.url || `ws://${serviceData.host}:${serviceData.port}`
      // 设置缓存
      this.cachedNspMap.set(namespace, rpcUrl)
    }
    return rpcHelper.requestRPC(rpcUrl, method, params)
  }
}

module.exports = Service
