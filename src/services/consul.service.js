const axios = require('axios').default
const BaseService = require('./core')
const consts = require('../consts')
const NBError = require('../NBError')
const jadepool = require('../jadepool')

const logger = require('@jadepool/logger').of('Service', 'Consul Discovery')

class Service extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.CONSUL, services)
    /** @type {Map<string, { name: string, id: string, interval: * }>} */
    this._registeredServices = new Map()
  }

  /**
   * 初始化
   * @param {Object} opts
   * @param {String} opts.url 获取配置
   */
  async initialize (opts) {
    // 设置properties
    Object.defineProperties(this, {
      // 设置consul url
      baseURL: {
        value: opts.url || jadepool.env.defaultConsul,
        writable: false,
        enumerable: true
      }
    })

    // 检测consul状态
    const ok = await this._get(`/v1/status/leader`)
    if (!ok) {
      throw new NBError(50001, `failed to find consul`)
    }
  }

  /**
   * 该Service的优雅退出函数
   * @param signal 退出信号
   */
  async onDestroy (signal) {
    for (const iter of this._registeredServices) {
      await this.deregisterService(iter[0])
    }
  }

  /**
   * 向consul注册某个名字+端口
   * @param {String} serviceName
   * @param {Number} port
   */
  async registerService (serviceName, port, meta = {}) {
    const serviceId = `${serviceName}-${jadepool.env.processKey}`
    const checkId = `check-${serviceId}`
    const result = await this._put(`/v1/agent/service/register`, {
      Name: serviceName,
      ID: serviceId,
      Port: port,
      Meta: meta,
      Check: {
        Name: `service:${serviceName}`,
        ID: checkId,
        TTL: '15s'
      }
    })
    if (!result) return false

    // 设置 ttl 为 5s 一次
    const interval = setInterval(async () => {
      const result = await this._put(`/v1/agent/check/pass/${checkId}`, {
        note: `${serviceName} alive and reachable. (ttl by consul.service)`
      })
      if (!result) {
        logger.warn(`failed-to-ttl-${serviceName}`)
      }
    }, 5000)
    // 添加到_registeredServices
    this._registeredServices.set(serviceName, {
      name: serviceName,
      id: serviceId,
      interval
    })
    // Registered
    logger.tag('Registered').log(`service=${serviceName},port=${port}`)
    return true
  }

  /**
   * 向consul
   * @param {String} serviceName
   */
  async deregisterService (serviceName) {
    const data = this._registeredServices.get(serviceName)
    if (!data) {
      logger.warn(`service(${serviceName}) not registered`)
      return false
    }
    // remove iterval
    if (data.interval !== undefined) {
      clearInterval(data.interval)
    }
    // remove deregister
    const result = await this._put(`/v1/agent/service/deregister/${data.id}`)
    if (!result) return false

    logger.tag('Deregistered').log(`service=${serviceName}`)
    return true
  }

  /**
   * 获取一个服务的地址和端口
   * @param {string} serviceName
   * @returns {{host: string, port: number, meta: object}}
   */
  async getServiceData (serviceName) {
    const results = await this._get(`/v1/health/service/${serviceName}?passing=true`)
    if (!results || results.length === 0) {
      throw new NBError(50001, `failed to find service(${serviceName})`)
    }
    const pickOne = results[Math.floor((Math.random() * results.length))]
    if (!pickOne || !pickOne.Service || !pickOne.Service.Port) {
      throw new NBError(50001, `failed to get service data: ${JSON.stringify(pickOne)}`)
    }
    return {
      host: pickOne.Service.Address || '127.0.0.1',
      port: pickOne.Service.Port,
      meta: pickOne.Service.Meta || {}
    }
  }

  /**
   * 查询
   */
  async _get (uri, query) {
    try {
      const res = await axios.get(uri, { baseURL: this.baseURL, params: query, proxy: false })
      return res.data
    } catch (err) {
      const info = err.response ? JSON.stringify(err.response.data) : null
      logger.error(info, err)
    }
    return null
  }

  /**
   * 设置
   */
  async _put (uri, data) {
    try {
      const res = await axios.put(uri, data, { baseURL: this.baseURL, proxy: false })
      return res.data
    } catch (err) {
      const info = err.response ? JSON.stringify(err.response.data) : null
      logger.error(info, err)
    }
    return null
  }
}

module.exports = Service
