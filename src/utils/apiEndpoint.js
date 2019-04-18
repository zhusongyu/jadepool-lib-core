const _ = require('lodash')
const axios = require('axios').default
const jadepool = require('../jadepool')
const NBError = require('../NBError')
const { fetchChainCfg } = require('./config')

const logger = require('@jadepool/logger').of('Ledger', 'Utils')

class ApiEndpoint {
  /**
   * @param {string[]} endpoints API URL
   * @param {object} opts
   * @param {number} [opts.timeout=10000] 请求的过期时间
   */
  constructor (endpoints, opts = {}) {
    this.updateEndPoints(endpoints)
    this._timeout = opts.timeout || 10000
    this._current = 0
    this._connected = false
  }
  /**
   * Accessors
   */
  get connected () { return this._connected }
  get endpointUrl () { return this._endpoints[this._current] }
  /**
   * 更新API节点
   * @param {string[]} endpoints API URL
   */
  updateEndPoints (endpoints) {
    if (!endpoints || endpoints.length === 0) {
      throw new NBError(10001, `missing rpcUrls`)
    }
    this._endpoints = endpoints
  }
  /**
   * 使用下一个endpoint
   */
  nextEndpoint () {
    this._current = (this._current + 1) % this._endpoints.length
  }
  /**
   * 发起请求
   * @param {'get'|'post'} method 方法名
   * @param {string} uri api uri
   * @param {object} data 请求参数
   */
  async request (method, uri, data) {
    const endIdx = this._current
    let result
    do {
      const baseURL = this.endpointUrl
      try {
        result = await axios({
          baseURL,
          timeout: this._timeout,
          method,
          url: uri,
          params: method === 'get' ? data : undefined,
          data: method !== 'get' ? data : undefined
        })
      } catch (err) {
        if (err.response && err.response.data) {
          result = {
            data: {
              status: err.response.status,
              error: err.response.data
            }
          }
        } else {
          logger.tag(`Request-failed`, uri).warn(`baseUrl=${baseURL},msg=${err && err.message}`)
        }
      }
      if (result === undefined) {
        this.nextEndpoint()
      }
    } while (result === undefined && this._current !== endIdx)
    // 确保result存在
    if (result === undefined) {
      this._connected = false
      throw new NBError(10001, `failed to request`)
    } else {
      this._connected = true
    }
    return result.data
  }

  async get (uri, params) { return this.request('get', uri, params) }
  async post (uri, body) { return this.request('post', uri, body) }
}

/** @type {Map<string, ApiEndpoint>} */
let apiEndpointMap = new Map()

module.exports = {
  /**
   * 设置断线
   * @param {string} key the key of apiEndpint
   */
  isConnected (key) {
    const ep = apiEndpointMap.get(key)
    return ep ? ep.connected : false
  },
  /**
   * 获取一个apiEndpoint实例
   * @param {string} key
   * @param {string[]} endpoints API URL
   * @param {object} opts
   * @param {number} [opts.timeout=10000] 请求的过期时间
   */
  createApiEndpoint (key, endpoints, opts) {
    let api = apiEndpointMap.get(key)
    if (!api) {
      api = new ApiEndpoint(endpoints, opts)
      apiEndpointMap.set(key, api)
    }
    return api
  },
  /**
   * 根据ChainKey获取ApiEndpoint实例
   * @param {string} chainKey 区块链Key
   * @param {string} nodeKey 节点Key
   */
  async getChainNodeEndpoint (chainKey, nodeKey) {
    let key = chainKey + (nodeKey || '')
    let api = apiEndpointMap.get(key)
    if (!api) {
      const chainCfg = fetchChainCfg(chainKey)
      if (!chainCfg) throw new NBError(10001, `failed to find chainKey: ${chainKey}`)
      const nodeCfg = _.find(chainCfg.node, { name: (nodeKey || chainKey) })
      if (!nodeCfg) throw new NBError(10001, `failed to find nodeCfg: ${nodeKey || chainKey}`)
      let endpointData = jadepool.env.isProd ? nodeCfg.MainNet : nodeCfg.TestNet
      if (!endpointData) throw new NBError(10001, `failed to find nodeData: ${nodeKey || chainKey}`)
      let endpoints = []
      if (_.isString(endpointData)) {
        endpoints.push(endpointData)
      } else if (_.isArray(endpointData) && _.isString(endpointData[0])) {
        endpoints = endpointData
      } else if (_.isObject(endpointData) && endpointData.url) {
        endpoints.push(endpointData.url)
      } else {
        throw new NBError(10001, `failed too find endpoint url`)
      }
      api = new ApiEndpoint(endpoints)
      apiEndpointMap.set(key, api)
    }
    return api
  }
}
