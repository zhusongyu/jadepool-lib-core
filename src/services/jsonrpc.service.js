const _ = require('lodash')
const uuid = require('uuid')
const WebSocket = require('ws')
const { EventEmitter } = require('events')

const BaseService = require('./core')
const jp = require('../jadepool')
const consts = require('../consts')
const cryptoUtils = require('../utils/crypto')
const logger = require('@jadepool/logger').of('Service', 'JsonRPC')

/**
 * 基于ws的通用jsonrpc发送和接收服务
 * 1.支持保持对多个地址服务调用jsonrpc
 * 2.支持将本地methods包装为jsonrpc服务，暴露给连接对象
 */
class JSONRPCService extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.JSONRPC_SERVER, services)
    /**
     * 调用请求的Map
     * @type {Map<string, EventEmitter>}
     */
    this.requests = new Map()
    /**
     * 可接受的方法
     * @type {Map<string, Function|Boolean>}
     */
    this.acceptMethods = new Map()
  }
  /**
   * 销毁
   */
  async onDestroy () {
    this.wss.clients.forEach(ws => {
      ws.removeAllListeners()
      ws.terminate()
    })
  }
  /**
   * 初始化
   * @param {object} opts
   * @param {string?} opts.host
   * @param {number?} opts.port
   * @param {string[]} opts.acceptMethods
   * @param {boolean?} [opts.noAuth=false] 是否需要验证
   * @param {string?} opts.signerId
   * @param {Buffer|string|undefined} opts.signer
   * @param {Buffer|string|undefined} opts.verifier
   * @param {string} [opts.hash='sha256']
   * @param {string} [opts.encode='base64']
   * @param {string} [opts.sort=undefined]
   * @param {boolean} [opts.withoutTimestamp=false]
   * @param {boolean} [opts.authWithTimestamp=false] 以时间戳进行签名，验签
   */
  async initialize (opts) {
    // 设置签名和验签规则
    this.opts = _.clone(opts)
    // 定义ws server
    const host = opts.host || '0.0.0.0'
    const port = opts.port || 7897
    this.wss = new WebSocket.Server({
      host,
      port,
      /**
       * @param {{ origin: string; secure: boolean; req: IncomingMessage }} info
       * @param {(res: boolean, code?: number, message?: string, headers?: http.OutgoingHttpHeaders) => void} done
       * @return {boolean}
       */
      verifyClient: (info, done) => {
        // 无需验证
        if (opts.noAuth) {
          return done(true)
        }
        if (!info.req.headers || !info.req.headers.authorization) {
          logger.warn(`missing headers.authorization. client: ${info.origin}`)
          return done(false)
        }
        const authString = info.req.headers.authorization
        let [key, timestamp, sig] = authString.split(',')
        let promise
        if (!opts.verifier) {
          promise = cryptoUtils.verifyInternal(key, parseInt(timestamp), sig, opts)
        } else {
          const pubKey = typeof opts.verifier === 'string' ? Buffer.from(opts.verifier, consts.DEFAULT_ENCODE) : opts.verifier
          promise = new Promise((resolve, reject) => {
            try {
              resolve(cryptoUtils.verifyString(key, parseInt(timestamp), sig, pubKey, opts))
            } catch (err) { reject(err) }
          })
        }
        promise.then(result => {
          if (!result) {
            logger.warn(`authorization failed. client: ${info.origin}`)
          }
          done(!!result)
        }).catch(err => {
          logger.error(`verify from jadepool: ${authString}`, err)
          done(false)
        })
      }
    })
    this.wss.once('listening', () => { logger.log(`JSONRPC Service listen to ${host}:${port}`) })

    // 设置acceptMethods
    this.setAcceptMethods(opts.acceptMethods)

    // 设置Websocket.Server的事件监听
    this.wss.on('connection', (client) => {
      client.addListener('close', (code, reason) => {
        logger.tag('Closed').log(`reason=${reason},code=${code}`)
        client.removeAllListeners()
      }).addListener('message', data => {
        this._handleRPCMessage(client, data.valueOf())
      })
    })
  }

  /**
   * 设置可接受rpc方法
   * @param {string[]|string} acceptMethods
   */
  setAcceptMethods (acceptMethods) {
    // 定义acceptMethods
    let methods = []
    if (acceptMethods) {
      if (typeof acceptMethods === 'string') {
        methods = acceptMethods.split(',').map(method => ({ name: method }))
      } else if (Array.isArray(acceptMethods)) {
        methods = acceptMethods.map(method => {
          if (typeof method === 'string') {
            return { name: method }
          } else if (typeof method.name === 'string') {
            return { name: method.name, func: typeof method.func === 'function' ? method.func : undefined }
          } else {
            return null
          }
        }).filter(m => !!m)
      }
    }
    // 设置acceptMethods
    methods.forEach(method => {
      this.acceptMethods.set(method.name, method)
    })
  }

  /**
   * 添加新的可接受方法
   * @param {string} methodName 方法名
   * @param {Function|undefined} methodFunc
   */
  addAcceptableMethod (methodName, methodFunc) {
    const methodData = { name: methodName }
    if (typeof methodFunc === 'function') {
      methodData.func = methodFunc
    }
    this.acceptMethods.set(methodName, methodData)
  }

  /**
   * 移除新是可接受方法
   * @param {string} methodName 方法名
   */
  removeAcceptableMethod (methodName) {
    if (this.acceptMethods.has(methodName)) {
      this.acceptMethods.delete(methodName)
    }
  }

  /**
   * 请求RPC地址
   * @param {WebSocket} client 请求的客户端
   * @param {string} methodName 方法名
   * @param {object} args 参数
   */
  async requestJSONRPC (ws, methodName, args) {
    if (!ws || ws.readyState !== ws.OPEN) {
      throw new Error(`client isn't opened`)
    }
    const reqData = {
      id: uuid.v1(),
      method: methodName,
      params: args,
      jsonrpc: '2.0'
    }
    logger.tag(`Request:${methodName}`).log(`id=${reqData.id}`)
    const emitter = new EventEmitter()
    this.requests.set(reqData.id, emitter)
    let objToSend = reqData
    const opts = _.clone(this.opts)
    // 判断是否进行信息签名
    if (!opts.noAuth) {
      opts.hash = opts.hash || 'sha256'
      opts.encode = opts.encode || 'base64'
      let appid
      let sigData
      if (opts.signerId === undefined) {
        appid = consts.SYSTEM_APPIDS.INTERNAL
        const timestamp = !opts.withoutTimestamp ? Date.now() : undefined
        sigData = await cryptoUtils.signInternal(reqData, timestamp, opts)
      } else if (opts.signer !== undefined) {
        const priKey = typeof opts.signer === 'string' ? Buffer.from(opts.signer, consts.DEFAULT_ENCODE) : opts.signer
        appid = opts.signerId || consts.SYSTEM_APPIDS.DEFAULT
        sigData = await cryptoUtils.sign(reqData, priKey, opts)
      }
      if (!sigData) {
        throw new Error(`missing signer`)
      }
      objToSend.sig = Object.assign({
        appid,
        signature: sigData.signature,
        internal: opts.signerId ? undefined : (opts.authWithTimestamp ? 'timestamp' : 'version')
      }, _.pick(opts, ['hash', 'sort', 'encode', 'accept', 'withoutTimestamp']))
    }
    // 发起并等待请求
    const result = await new Promise((resolve, reject) => {
      // 发起请求
      ws.send(JSON.stringify(objToSend), err => {
        if (err) {
          reject(err instanceof Error ? err : new Error(err))
        }
      })
      // 监听回调
      emitter.once('response', resolve)
      emitter.once('error', reject) // reject将自动throw error
    })
    // 移除Emitter依赖
    emitter.removeAllListeners()
    this.requests.delete(reqData.id)
    // 返回结果
    return result
  }

  /**
   * 消息处理函数
   * @param {WebSocket} ws 处理用的websocket客户端
   * @param {any} data 明确为string类型, 即JSONRpc的传输对象
   */
  async _handleRPCMessage (ws, data) {
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
        await this._handleOneRPCMessage(ws, request)
      } catch (err) {}
    } // end for
  }

  async _handleOneRPCMessage (ws, jsonData) {
    if (jsonData.jsonrpc !== '2.0') {
      logger.tag('RPC Message').warn(`only accept JSONRPC 2.0 instead of "${jsonData.jsonrpc}"`)
      return
    }
    // 请求类型判断
    let jsonRequest = jsonData
    if (jsonRequest.method !== undefined) {
      // 判断是否为方法调用或通知，将进行本地调用
      let res = { jsonrpc: '2.0' }
      // 检测方法名是否可用
      const methodName = _.kebabCase(jsonRequest.method)
      if (!this.acceptMethods.has(methodName)) {
        res.error = { code: 404, message: 'Method not found.' }
      } else {
        const methodData = this.acceptMethods.get(methodName)
        // 进行本地调用
        try {
          const params = jsonRequest.params || {}
          if (!methodData.func) {
            res.result = await jp.invokeMethod(methodName, jp.env.param, params, ws)
          } else {
            res.result = await methodData.func(params, ws)
          }
        } catch (err) {
          let code = err.code
          let message = err.message
          if (err.response) {
            code = 20000 + err.response.status
            message = err.response.detail || err.mesage
          }
          res.error = { code, message }
        }
      }
      // 若为方法调用, 则需返回结果
      if (jsonRequest.id) {
        res.id = jsonRequest.id
        ws.send(JSON.stringify(res), err => {
          if (err) {
            logger.error(null, err)
          }
        })
      }
      logger.tag(`Invoked:${methodName}`).log(`id=${jsonRequest.id}`)
      return
    }
    // 回调类型判断
    let jsonResponse = jsonData
    if (jsonResponse.id !== undefined && (jsonResponse.result !== undefined || jsonResponse.error !== undefined)) {
      // 判断是否为回调请求，若为回调请求则需返回结果到请求Promise
      const emiter = this.requests.get(jsonResponse.id)
      if (!emiter) {
        logger.tag('Result').warn(`unknown id ${jsonResponse.id}`)
        return
      }
      logger.tag(`Result`).log(`id=${jsonResponse.id}` + (!jsonResponse.error ? '' : `,code=${jsonResponse.error.code},message=${jsonResponse.error.message}`))
      if (jsonResponse.result !== undefined) {
        emiter.emit('response', jsonResponse.result)
      } else if (jsonResponse.error !== undefined) {
        emiter.emit('error', jsonResponse.error)
      }
      return
    }
    // 无任何解析的情况，直接打印warning
    logger.warn(`unknown data`)
  }
}

module.exports = JSONRPCService
