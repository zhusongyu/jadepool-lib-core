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
   */
  async initialize (opts) {
    // 设置签名和验签规则
    this.noAuth = !!opts.noAuth
    this.signerId = opts.signerId
    this.signer = opts.signer
    this.verifier = opts.verifier
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
          promise = cryptoUtils.verifyInternal(key, parseInt(timestamp), sig)
        } else {
          const pubKey = typeof opts.verifier === 'string' ? Buffer.from(opts.verifier, cryptoUtils.DEFAULT_ENCODE) : opts.verifier
          promise = new Promise((resolve, reject) => {
            try {
              resolve(cryptoUtils.verifyString(key, parseInt(timestamp), sig, pubKey))
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

    // 定义acceptMethods
    let methods = []
    if (opts.acceptMethods) {
      if (typeof opts.acceptMethods === 'string') {
        methods = opts.acceptMethods.split(',')
      } else if (Array.isArray(opts.acceptMethods)) {
        methods = opts.acceptMethods
      }
    }
    this.acceptMethods = methods
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
    // 判断是否进行信息签名
    if (!this.noAuth) {
      const sigOpts = {
        hash: 'sha256',
        encode: 'base64',
        withoutTimestamp: true
      }
      let sigData
      if (this.signerId === undefined) {
        sigOpts.appid = cryptoUtils.THIS_APP_ID
        sigData = await cryptoUtils.signInternal(reqData, undefined, sigOpts)
      } else {
        const priKey = typeof this.signer === 'string' ? Buffer.from(this.signer, cryptoUtils.DEFAULT_ENCODE) : this.signer
        sigOpts.appid = this.signerId || consts.DEFAULT_KEY
        sigData = await cryptoUtils.sign(reqData, priKey, sigOpts)
      }
      objToSend.sig = Object.assign({ signature: sigData.signature }, sigOpts)
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
      if (this.acceptMethods.indexOf(methodName) === -1) {
        res.error = { code: 404, message: 'Method not found.' }
      } else {
        // 进行本地调用
        try {
          res.result = await jp.invokeMethod(methodName, jp.env.param, jsonRequest.params || {}, ws)
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
