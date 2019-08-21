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
const cryptoUtils = require('../utils/crypto')

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

  /**
   * 初始化
   * @param {object} opts 参数
   * @param {number} [opts.timeout=120] ws的请求timeout时间
   * @param {boolean} [opts.noAuth=false] 是否需要验证
   * @param {string[]|string} opts.acceptMethods 可接受的RPC请求
   */
  async initialize (opts) {
    this.defaultRpcOpts = _.clone(opts)
    /**
     * 过期时间
     * @type {number}
     */
    this.timeout = opts.timeout || 120
    // 设置acceptMethods
    this.setAcceptMethods(opts.acceptMethods)
  }

  async onDestroy () {
    this.clients.forEach(socket => {
      try {
        socket.removeAllListeners()
        socket.terminate()
      } catch (err) {}
    })
  }

  /**
   * 设置可接受rpc方法
   * @param {string[]} acceptMethods
   */
  setAcceptMethods (acceptMethods) {
    // methods设置
    let methods = []
    if (acceptMethods) {
      if (typeof acceptMethods === 'string') {
        methods = acceptMethods.split(',')
      } else if (Array.isArray(acceptMethods)) {
        methods = acceptMethods
      }
    }
    /**
     * 可接受的方法调用
     * @type {String[]}
     */
    this.acceptMethods = _.map(methods, methodName => _.kebabCase(methodName))
  }

  /**
   * 创建JSONRpc服务
   * @param {String} url rpc连接地址
   * @param {object} opts 参数
   * @param {boolean} [opts.noAuth=false] 是否需要验证
   * @param {string} [opts.signerId=undefined] 签名用的AppId
   * @param {Buffer|string} [opts.signer=undefined] 签名用的
   * @param {Buffer|string} [opts.verifier=undefined] 验证签名的
   * @param {string} [opts.acceptNamespace=undefined] 可接受的RPC请求指定的namespace
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
          logger.tag('Terminate').info(`readyState=${ws.readyState},jsonrpc=${url}`)
          break
      }
    }

    let rpcOpts = Object.assign({}, this.defaultRpcOpts, opts)
    // Step 1. 构建认证query的签名
    let headers = {}
    if (!rpcOpts.noAuth) {
      const timestamp = Date.now()
      const key = encodeURI(`${consts.SERVICE_NAMES.JSONRPC}_${Math.floor(Math.random() * 1e8)}_${timestamp}`)
      let sig = await this._signObject(key, timestamp, opts.signerId, opts.signer, rpcOpts)
      headers['Authorization'] = [key, sig.timestamp, sig.signature].join(',')
    }

    // Step.1 创建WebSocket
    ws = new WebSocket(url, { headers })
    this.clients.set(url, ws)
    logger.tag('Create RPC').debug(`url=${url}`)

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
        logger.tag('Connected').info(`url=${url}`)
        resolve()
      })
    })
    ws.removeAllListeners()
    // 正常处理
    ws.on('close', (code, reason) => {
      logger.tag('Closed').info(`url=${url},code=${code}` + (!reason ? '' : `,reason=${reason}`))
    })
    ws.on('message', data => {
      this._handleRPCMessage(ws, data.valueOf(), _.clone(rpcOpts))
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
   * @param {boolean} [opts.noAuth=false] 是否需要验证
   * @param {string} [opts.signerId=undefined] 签名用的AppId
   * @param {string} [opts.signer=undefined] 签名用的
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
    logger.tag(`Request:${methodName}`).debug(`id=${reqData.id}`)
    return requestFunc.call(this, url, reqData, opts)
  }

  /**
   * 进行内容签名
   * @param {string|object} sigData
   * @param {number|undefined} timestamp
   * @param {string?} signerId
   * @param {string|Buffer?} signer
   * @param {object} opts
   */
  async _signObject (sigData, timestamp, signerId = undefined, signer = undefined, opts = {}) {
    try {
      let appid
      let sig
      if (signerId === undefined) {
        appid = consts.SYSTEM_APPIDS.INTERNAL
        sig = await cryptoUtils.signInternal(sigData, timestamp, opts)
      } else {
        let priKey
        // 不存在Signer即使用PriKey
        if (!signer) {
          appid = consts.SYSTEM_APPIDS.DEFAULT
          priKey = await cryptoUtils.getPriKey()
        } else {
          appid = signerId
          priKey = typeof signer === 'string' ? Buffer.from(signer, consts.DEFAULT_ENCODE) : signer
        }
        opts = Object.assign({ withoutTimestamp: timestamp === undefined }, opts)
        if (_.isString(sigData)) {
          sig = cryptoUtils.signString(sigData, timestamp, priKey, opts)
        } else {
          let objToSign = timestamp === undefined ? Object.assign({ timestamp }, sigData) : sigData
          sig = cryptoUtils.sign(objToSign, priKey, opts)
        }
      }
      return Object.assign({ appid }, sig)
    } catch (err) {
      throw new NBError(10001, `failed to sign object`)
    }
  }

  /**
   * 请求http的RPC调用
   * @param {String} url RPC的url
   * @param {String} methodName 方法名
   * @param {object} reqData
   * @param {string} reqData.id
   * @param {string} reqData.method
   * @param {object} opts 请求参数
   * @param {boolean} [opts.noAuth=false] 是否需要验证
   * @param {string} [opts.signerId=undefined] 签名用的AppId
   * @param {string} [opts.signer=undefined] 签名用的
   */
  async _requestHttpRPC (url, reqData, opts = {}) {
    let extra = { lang: opts.lang || 'zh-cn' }
    let data = Object.assign({}, reqData)
    const rpcOpts = Object.assign({}, this.defaultRpcOpts, opts)
    if (!rpcOpts.noAuth) {
      extra.appid = rpcOpts.signerId || 'jadepool'
      extra.hash = rpcOpts.hash || 'sha256'
      extra.sort = rpcOpts.sort || 'key'
      extra.encode = rpcOpts.encode || 'hex'
      // 进行签名
      let sig = await this._signObject(reqData, undefined, rpcOpts.signerId, opts.signer, extra)
      extra.sig = sig.signature
    }
    data.extra = extra
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
   * @param {object} reqData
   * @param {string} reqData.id
   * @param {string} reqData.method
   * @param {object} opts 请求参数
   */
  async _requestWsRPC (url, reqData, opts) {
    const ws = this.clients.get(url)
    if (!ws || ws.readyState !== ws.OPEN) {
      throw new NBError(21004, `method=${reqData.method}`)
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
      const timeoutMs = this.timeout * 1000
      const timeout = setTimeout(() => reject(new NBError(21005, `id=${reqData.id},method=${reqData.method}`)), timeoutMs)
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

  async _handleRPCMessage (ws, data, opts) {
    let jsonData
    try {
      jsonData = JSON.parse(data)
    } catch (err) {
      return
    }
    // handle batch request
    let reqs = []
    if (_.isArray(jsonData)) {
      reqs = jsonData
    } else {
      reqs.push(jsonData)
    }
    // 逐条完成JSONRPC
    for (const request of reqs) {
      try {
        await this._handleOneRPCMessage(ws, request, opts)
      } catch (err) {}
    } // end for
  }

  /**
   * 消息处理函数
   * @param {WebSocket} ws 处理用的websocket客户端
   * @param {String} data 明确为string类型, 即JSONRpc的传输对象
   * @param {object} opts 参数
   * @param {boolean} [opts.noAuth=false] 是否需要验证
   * @param {string} [opts.signerId=undefined] 签名用的AppId
   * @param {Buffer|string} [opts.signer=undefined] 签名用的
   * @param {Buffer|string} [opts.verifier=undefined] 验证签名的
   * @param {string} [opts.acceptNamespace=undefined] 可接受的RPC请求指定的namespace
   */
  async _handleOneRPCMessage (ws, jsonData, opts) {
    if (jsonData.jsonrpc !== '2.0') {
      logger.tag('RPC Message').warn(`only accept JSONRPC 2.0 instead of "${jsonData.jsonrpc}"`)
      return
    }
    if (jsonData.method !== undefined) {
      // 判断是否为方法调用或通知，将进行本地调用
      let result = { jsonrpc: '2.0' }
      // 验证签名
      const sigData = jsonData.sig || jsonData.extra
      if (!opts.noAuth) {
        if (sigData) {
          let isValid = false
          if (jsonData.sig) delete jsonData.sig
          if (jsonData.extra) delete jsonData.extra
          const verifyOpts = _.pick(sigData, ['sort', 'hash', 'encode'])
          if (typeof sigData.internal === 'string' || sigData.authWithTimestamp !== undefined) {
            verifyOpts.authWithTimestamp = sigData.authWithTimestamp || sigData.internal === 'timestamp'
            isValid = await cryptoUtils.verifyInternal(jsonData, sigData.timestamp, sigData.signature, verifyOpts)
          } else if (opts.verifier !== undefined) {
            const pubKey = typeof opts.verifier === 'string' ? Buffer.from(opts.verifier, consts.DEFAULT_ENCODE) : opts.verifier
            try {
              isValid = cryptoUtils.verify(jsonData, sigData.signature, pubKey, verifyOpts)
            } catch (err) {
              logger.error(`failed to verify sig`, err)
              isValid = false
            }
          }
          if (!isValid) {
            result.error = { code: 401, message: 'Request is not authorized.' }
          }
        } else if (jp.env.isProd) {
          result.error = { code: 401, message: 'missing sig or extra.' }
        }
      }
      // 检测方法名是否可用
      let methodName = _.kebabCase(jsonData.method)
      if (this.acceptMethods.indexOf(methodName) === -1) {
        result.error = { code: 404, message: 'Method not found.' }
      }
      // 进行本地调用
      if (!result.error) {
        logger.tag(`Invoke:${jsonData.method}`).debug(`id=${jsonData.id}`)
        try {
          const params = jsonData.params
          result.result = await jp.invokeMethod(methodName, opts.acceptNamespace || params.chain, params)
        } catch (err) {
          result.error = { code: err.code, message: err.message }
          logger.tag(`Invoked:${methodName}`, 'Error').warn(JSON.stringify(result.error))
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
        logger.tag(`Result`).debug(`id=${jsonData.id},result=${JSON.stringify(jsonData.result)}`)
        emiter.emit('response', jsonData.result)
      } else {
        const errData = jsonData.error
        logger.tag(`ErrorResult`).warn(`id=${jsonData.id},error=${JSON.stringify(errData)}`)
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
