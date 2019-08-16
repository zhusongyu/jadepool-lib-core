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
    /** @type {string[]} */
    this._registeredServices = []
  }

  /**
   * 初始化
   * @param {Object} opts
   * @param {String} opts.url 获取配置
   */
  async initialize (opts) {
    if (typeof opts.name !== 'string') throw new NBError(10002, `missing name`)
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
   * 向consul注册某个名字+端口
   * @param {String} serviceName
   * @param {Number} port
   */
  async registerService (serviceName, port, meta = {}) {
    const serviceId = `${serviceName}-${jadepool.env.processKey}`
    await this._put()
    // TODO
    logger.tag('Registered').log(`service=${serviceName},port=${port}`)
  }

  /**
   * 获取一个服务的地址和端口
   * @param {string} serviceName
   * @returns {{host: string, port: number}}
   */
  async getService (serviceName) {
    // TODO
  }

  /**
   * 执行周期请求计划
   */
  async _ttl (serviceName) {
    // TODO
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
