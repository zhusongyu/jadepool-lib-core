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
      const name = iter[0]
      await this.deregisterService(name)
    }
  }

  /**
   * 向consul注册某个名字+端口
   * @param {String} serviceName
   * @param {Number} port
   */
  async registerService (serviceName, port, meta = {}, ttlCheckMethod) {
    const serviceId = `${serviceName}@${jadepool.env.rpcNamespace}.${process.pid}`
    const selfHost = jadepool.env.host !== '127.0.0.1' ? jadepool.env.host : ''
    const result = await this._put(`/v1/agent/service/register`, {
      Name: serviceName,
      ID: serviceId,
      Address: selfHost,
      Port: port,
      Meta: meta,
      Check: {
        Name: `service:${serviceName}`,
        TTL: '10s',
        Notes: `${serviceName} for Jadepool. (ttl by consul.service)`
      }
    })
    if (!result) return false

    // 设置 ttl 为 3s 一次
    const INTERNAL_MS = 3000
    const interval = setInterval(async () => {
      const checkId = `service:${serviceId}`
      // set start time
      let startAt = Date.now()
      // try ttl test
      let ttlResult = false
      let note
      switch (typeof ttlCheckMethod) {
        case 'string':
          try {
            ttlResult = await jadepool.invokeMethod(ttlCheckMethod)
          } catch (err) {
            ttlResult = false
            note = err && err.message
          }
          break
        case 'function':
          try {
            ttlResult = await ttlCheckMethod()
          } catch (err) {
            ttlResult = false
            note = err && err.message
          }
          break
        default:
          ttlResult = true
          break
      }
      switch (typeof ttlResult) {
        case 'undefined':
          ttlResult = true
        case 'boolean':
          note = note || 'OK'
          break
        default:
          note = note || JSON.stringify(ttlResult)
          ttlResult = true
          break
      }
      const isTooLongTime = (Date.now() - startAt) > 60000 // 1min is warning
      let checkResult = !ttlResult ? 'fail' : (isTooLongTime ? 'warn' : 'pass')
      // send ttl result
      const result = await this._put(`/v1/agent/check/${checkResult}/${checkId}`, { note })
      if (!result) {
        logger.tag('TTL').warn(`failed-to-ttl-${serviceName}`)
      }
    }, INTERNAL_MS)
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

    logger.tag('Deregistered').log(`service=${serviceName},result=${JSON.stringify(result)}`)
    return true
  }

  /**
   * 等待到服务发现未知
   * @param {string} serviceName
   * @param {Number} [timeout=undefined] 等待超时时间（s）, 默认10分钟
   */
  async waitForService (serviceName, timeout = 600) {
    const maxAmt = Math.ceil(timeout / 2)
    for (let i = 0; i < maxAmt; i++) {
      const results = await this._get(`/v1/health/service/${serviceName}?passing=true`)
      if (results.length > 0) {
        return results
      } else if (i < maxAmt) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        logger.tag('Searching').log(`srv=${serviceName},retries=${i}`)
      }
    }
    return false
  }

  /**
   * 获取一个服务的地址和端口
   * @param {string} serviceName
   * @param {Boolean} waitForService 等待服务发现
   * @returns {{host: string, port: number, meta: object}}
   */
  async getServiceData (serviceName, waitForService = false) {
    const results = await this.waitForService(serviceName, !waitForService ? 1 : 60)
    if (!results || results.length === 0) {
      throw new NBError(50001, `failed to find service(${serviceName})`)
    }
    const pickOne = results[Math.floor((Math.random() * results.length))]
    if (!pickOne || !pickOne.Service || !pickOne.Service.Port) {
      throw new NBError(50001, `failed to get service data: ${JSON.stringify(pickOne)}`)
    }
    return {
      host: pickOne.Service.Address || pickOne.Node.Address || '127.0.0.1',
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
    let result
    let res
    try {
      res = await axios.put(uri, data, { baseURL: this.baseURL, proxy: false })
    } catch (err) {
      const info = err.response ? JSON.stringify(err.response.data) : null
      logger.error(info, err)
      return null
    }
    if (res && res.data) {
      result = res.data
    } else if (res && res.status >= 200 && res.status < 400) {
      result = true
    } else {
      result = false
    }
    return result
  }
}

module.exports = Service
