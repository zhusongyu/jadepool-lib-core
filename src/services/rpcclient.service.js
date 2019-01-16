const _ = require('lodash')
const uuid = require('uuid')
const { URL } = require('url')
const WebSocket = require('ws')
const axios = require('axios')
const EventEmitter = require('events').EventEmitter
const BaseService = require('./core')
const jp = require('../jadepool')
const consts = require('../consts')
const NBError = require('../NBError')

const logger = require('@jadepool/logger').of('Service', 'RPC Client')

/**
 * 基于ws的通用jsonrpc发送和接收服务
 * 1.支持保持对多个地址服务调用jsonrpc
 * 2.支持将本地methods包装为jsonrpc服务，暴露给连接对象
 */
class Service extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.JSONRPC, services)
    /**
     * WebSocket客户端
     * @type {Map<string, WebSocket>}
     */
    this.clients = new Map()
    /**
     * 调用请求的Map
     * @type {Map<string, EventEmitter>}
     */
    this.requests = new Map()
  }

  async initialize (opts) {
    let methods = []
    if (opts.acceptMethods) {
      if (typeof opts.acceptMethods === 'string') {
        methods = opts.acceptMethods.split(',')
      } else if (Array.isArray(opts.acceptMethods)) {
        methods = opts.acceptMethods
      }
    }
    /**
     * 可接受的方法调用
     * @type {String[]}
     */
    this.acceptMethods = methods
  }

  async onDestroy () {
    this.clients.forEach(socket => {
      socket.removeAllListeners()
      socket.terminate()
    })
  }

  /**
   * 创建JSONRpc服务
   * @param {String} url rpc连接地址
   * @param {object} opts 参数
   * @param {boolean} [opts.noAuth=false] 是否需要验证
   */
  async joinRPCServer (url, opts = {}) {
    const urlObj = new URL(url)
    if (urlObj.protocol !== 'ws:' && urlObj.protocol !== 'wss:') {
      throw new NBError(10001, `joinRPCServer should be ws url instead of ${url}`)
    }
    let ws = this.clients.get(url)
    if (ws) {
      switch (ws.readyState) {
        case WebSocket.CONNECTING: return
        case WebSocket.CLOSED: break
        default:
          ws.removeAllListeners()
          ws.terminate()
          logger.tag('Terminate').log(`readyState=${ws.readyState},jsonrpc=${url}`)
          break
      }
    }

    // Step 1. 构建认证query的签名
    let headers = {}
    if (!opts.noAuth) {
      const timestamp = Date.now()
      const processKey = consts.PROCESS.TYPES.ROUTER + '-' + jp.env.server
      const key = encodeURI(`${processKey}_${Math.floor(Math.random() * 1e8)}_${timestamp}`)
      let sig
      try {
        const cryptoUtils = require('../utils/crypto')
        sig = await cryptoUtils.signInternal(key, timestamp)
      } catch (err) {
        throw new NBError(10001, `failed to sign internal`)
      }
      headers['Authorization'] = [key, sig.timestamp, sig.signature].join(',')
    }

    // Step.1 创建WebSocket
    ws = new WebSocket(url, { headers })
    this.clients.set(url, ws)
    logger.tag('Create RPC').log(`url=${url}`)

    // Step.2 监听连接事件
    await new Promise((resolve, reject) => {
      // 连接处理
      ws.once('error', (err) => {
        logger.error(`url=${url}`, err)
        reject(err instanceof Error ? err : new Error(err))
      })
      ws.once('unexpected-response', (req, res) => {
        logger.warn(`url=${url},code=${res.statusCode},statusMsg=${res.statusMessage}`)
        reject(new NBError(res.statusCode, res.statusMessage))
      })
      ws.once('open', () => {
        logger.tag('Connected').log(`url=${url}`)
        resolve()
      })
    })
    ws.removeAllListeners()
    // 正常处理
    ws.on('close', (code, reason) => {
      logger.tag('Closed').log(`url=${url},reason=${reason},code=${code}`)
    })
    ws.on('message', data => {
      this._handleRPCMessage(ws, data.valueOf())
    })
  }
  /**
   * 关闭JSONRpc服务
   * @param {String} url rpc连接地址
   */
  async closeRPCServer (url) {
    let ws = this.clients.get(url)
    if (ws) {
      if (ws.readyState !== ws.CLOSING && ws.readyState !== ws.CLOSED) {
        ws.close()
      }
      this.clients.delete(url)
    }
  }

  /**
   * 请求RPC地址
   * @param {String} url RPC的url
   * @param {String} methodName 方法名
   * @param {Array} args 参数数组
   * @param {object?} opts 请求参数
   */
  async requestJSONRPC (url, methodName, args, opts = {}) {
    const urlObj = new URL(url)
    let requestFunc
    if (urlObj.protocol === 'ws:' || urlObj.protocol === 'wss:') {
      requestFunc = this._requestWsRPC
    } else if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
      requestFunc = this._requestHttpRPC
    }
    if (!requestFunc) {
      throw new NBError(10001, `requestJSONRPC should be ws or http url instead of ${url}`)
    }
    const reqData = {
      id: uuid.v1(),
      method: methodName,
      params: args,
      jsonrpc: '2.0'
    }
    logger.tag(`Request:${methodName}`).log(`id=${reqData.id}`)
    return requestFunc.call(this, url, methodName, reqData, opts)
  }

  /**
   * 请求http的RPC调用
   * @param {String} url RPC的url
   * @param {String} methodName 方法名
   * @param {object} reqData
   * @param {string} reqData.id
   * @param {object} opts 请求参数
   * @param {boolean} [opts.noAuth=false] 是否需要验证
   */
  async _requestHttpRPC (url, methodName, reqData, opts = {}) {
    opts = _.defaults(opts, {
      appid: 'jadepool',
      lang: 'zh-cn',
      hash: 'sha256',
      sort: 'key',
      encode: 'hex',
      withoutTimestamp: true
    })
    let data = Object.assign({}, reqData)
    if (!opts.noAuth) {
      let sig
      try {
        const cryptoUtils = require('../utils/crypto')
        sig = await cryptoUtils.signInternal(reqData, undefined, opts)
      } catch (err) {
        throw new NBError(10001, `failed to sign internal`)
      }
      data.extra = Object.assign({ sig: sig.signature }, opts)
    }
    let resdata
    try {
      const res = await axios({
        method: 'POST',
        url: url,
        data,
        proxy: false
      })
      resdata = res.data
    } catch (err) {
      throw new NBError(err.code || 21004, err.message)
    }
    if (resdata.jsonrpc !== '2.0') {
      throw new NBError(21010, `response jsonrpc should be 2.0`)
    }
    if (resdata.id !== reqData.id) {
      throw new NBError(21011, `response id miss-match. (required:${reqData.id} not ${resdata.id})`)
    }
    if (resdata.error) {
      throw new NBError(resdata.error.code, resdata.error.message)
    }
    return resdata.result
  }
  /**
   * 请求Ws的RPC调用
   * @param {String} url RPC的url
   * @param {String} methodName 方法名
   * @param {object} reqData
   * @param {string} reqData.id
   * @param {object} opts 请求参数
   */
  async _requestWsRPC (url, methodName, reqData, opts) {
    const ws = this.clients.get(url)
    if (!ws || ws.readyState !== ws.OPEN) {
      throw new NBError(21004, `method=${methodName}`)
    }
    const emitter = new EventEmitter()
    this.requests.set(reqData.id, emitter)
    const cleanup = () => {
      // 移除Emitter依赖
      emitter.removeAllListeners()
      this.requests.delete(reqData.id)
    }
    // 发起并等待请求
    return new Promise((resolve, reject) => {
      // 30秒超时定义
      const timeoutMs = 30 * 1000
      const timeout = setTimeout(() => reject(new NBError(21005, `id=${reqData.id},method=${methodName}`)), timeoutMs)
      // 发起请求
      ws.send(JSON.stringify(reqData), err => {
        if (err) {
          clearTimeout(timeout)
          reject(err instanceof Error ? err : new Error(err))
        }
      })
      // 监听回调
      emitter.once('response', data => {
        clearTimeout(timeout)
        resolve(data)
      })
      emitter.once('error', data => {
        clearTimeout(timeout)
        reject(data)
      }) // reject将自动throw error
    }).then(result => {
      cleanup()
      return result
    }).catch(err => {
      cleanup()
      return Promise.reject(err)
    })
  }

  /**
   * 消息处理函数
   * @param {WebSocket} ws 处理用的websocket客户端
   * @param {String} data 明确为string类型, 即JSONRpc的传输对象
   */
  async _handleRPCMessage (ws, data) {
    let jsonData
    try {
      jsonData = JSON.parse(data)
    } catch (err) {
      return
    }
    if (jsonData.jsonrpc !== '2.0') {
      logger.tag('RPC Message').warn(`only accept JSONRPC 2.0 instead of "${jsonData.jsonrpc}"`)
      return
    }
    if (jsonData.method !== undefined) {
      // 判断是否为方法调用或通知，将进行本地调用
      let result = { jsonrpc: '2.0' }
      // 验证签名
      if (jsonData.sig || jsonData.extra) {
        let isValid = false
        const sigData = jsonData.sig || jsonData.extra
        delete jsonData.sig
        try {
          const cryptoUtils = require('../utils/crypto')
          const pubKey = await cryptoUtils.fetchPubKey('ecc', sigData.appid || 'app', false)
          if (pubKey) {
            isValid = cryptoUtils.verify(jsonData, sigData.signature, pubKey, sigData)
          }
        } catch (err) {
          logger.error(`failed to verify sig`, err)
          isValid = false
        }
        if (!isValid) {
          result.error = { code: 401, message: 'Request is not authorized.' }
        }
      } else if (jp.env.isProd) {
        result.error = { code: 401, message: 'missing sig or extra.' }
      }
      // 检测方法名是否可用
      let methodName = _.kebabCase(jsonData.method)
      if (this.acceptMethods.indexOf(methodName) === -1) {
        result.error = { code: 404, message: 'Method not found.' }
      }
      // 进行本地调用
      if (!result.error) {
        logger.tag(`Invoke:${jsonData.method}`).log(`id=${jsonData.id}`)
        try {
          result.result = await jp.invokeMethod(methodName, null, jsonData.params)
        } catch (err) {
          result.error = { code: err.code, message: err.message }
          logger.tag(`Invoked:${methodName}`, 'Error').logObj(result.error)
        }
      }
      // 若为方法调用, 则需返回结果
      if (jsonData.id) {
        result.id = jsonData.id
        ws.send(JSON.stringify(result), err => {
          if (err) logger.error(null, err)
        })
      }
    } else if (jsonData.id !== undefined && (jsonData.result !== undefined || jsonData.error !== undefined)) {
      // 判断是否为回调请求，若为回调请求则需返回结果到请求Promise
      const emiter = this.requests.get(jsonData.id)
      if (!emiter) {
        logger.tag('Message').warn(`unknown id ${jsonData.id}`)
        return
      }
      if (jsonData.result !== undefined) {
        logger.tag(`Result`).log(`id=${jsonData.id},result=${JSON.stringify(jsonData.result)}`)
        emiter.emit('response', jsonData.result)
      } else {
        const errData = jsonData.error
        logger.tag(`ErrorResult`).log(`id=${jsonData.id},code=${errData.code},message=${errData.message}`)
        emiter.emit('error', new NBError(errData.code, errData.message))
      }
    } else {
      logger.warn(`unknown data`)
    }
  }

  /**
   * 状态监测函数
   * @param {String} url rpc连接地址
   */
  getClientReadyState (url) {
    const ws = this.clients.get(url)
    if (!ws) { return -1 }
    return ws.readyState
  }
}

module.exports = Service
