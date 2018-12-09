/**
 * Service基类
 */
class BaseService {
  /**
   * @param {String} name 服务名
   * @param {ServiceLib} services 服务库实例
   */
  constructor (name, services) {
    if (services === undefined) {
      throw new Error(`[${name}] Missing Services`)
    }
    Object.defineProperties(this, {
      '_name': { value: name },
      '_services': { value: services }
    })
  }
  /**
   * @returns {String}
   */
  get name () { return this._name }
  /**
   * @returns {ServiceLib}
   */
  get services () { return this._services }

  async initialize () {
    // 需要被override实现
    throw new Error(`[${this.name}] method[initialize] need to be overrided`)
  }
}

module.exports = BaseService // Service基类
