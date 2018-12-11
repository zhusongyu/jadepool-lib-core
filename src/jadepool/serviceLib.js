const logger = require('@jadepool/logger').of('Service')

const serivcesKey = Symbol('servicesKey')
/**
 * 服务库实例
 */
class ServiceLib {
  constructor () {
    this[serivcesKey] = new Map()
  }
  /**
   * @param {typeof BaseService} ServiceClass
   * @param {Object} opts 传入的初始化参数
   * @returns {BaseService}
   */
  async register (ServiceClass, opts) {
    const serv = new ServiceClass(this)
    this[serivcesKey].set(serv.name, serv)
    // 设置参数
    Object.defineProperty(this, serv.name, {
      enumerable: true,
      get: () => {
        return this[serivcesKey].get(serv.name)
      }
    })
    // 执行初始化
    await serv.initialize(opts || {})
    logger.tag('Attached').log(`name=${serv.name}`)
    // 设置registerTime
    ServiceLib.lastRegisterTime = Date.now()
    return serv
  }

  /**
   * @param {String} name
   * @returns {<BaseService>}
   */
  get (name) {
    if (this[serivcesKey].has(name)) {
      return this[serivcesKey].get(name)
    } else {
      return null
    }
  }
}
ServiceLib.lastRegisterTime = 0

module.exports = ServiceLib
