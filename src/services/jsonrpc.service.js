const _ = require('lodash')
const uuid = require('uuid')
const url = require('url')
const http = require('http')
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
     * @type {Map<string, {name: string, func?: boolean, encryptResult?: boolean}>}
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
    this.wss = new WebSocket.Server({ noServer: true })
    // 定义ws server
    let httpServer
    let host
    let port
    let attachPath
    const appServer = jp.getService(consts.SERVICE_NAMES.APP)
    if (appServer && appServer.server) {
      host = jp.env.host
      port = appServer.port
      attachPath = '/rpc'
      httpServer = appServer.server
      logger.tag('AttachTo').log(`host=${host},port=${port}`)
    } else {
      host = opts.host || '0.0.0.0'
      port = opts.port || 7897
      attachPath = '/'
      httpServer = http.createServer()
    }
    // 设置常量
    Object.defineProperties(this, {
      host: { value: host, writable: false, enumerable: true },
      port: { value: port, writable: false, enumerable: true }
    })

    // 设置Websocket.Server的事件监听
    this.wss.on('connection', (client) => {
      client.addListener('close', (code, reason) => {
        logger.tag('Closed').log(`code=${code}` + (!reason ? '' : `,reason=${reason}`))
        client.removeAllListeners()
      }).addListener('message', data => {
        this._handleRPCMessage(client, data.valueOf())
      })
    })

    // 设置acceptMethods
    this.setAcceptMethods(opts.acceptMethods)

    /**
     * @param {IncomingMessage} req
     * @return {Promise<boolean>}
     */
    const verifyClient = async (req) => {
      if (!req.headers || !req.headers.authorization) {
        logger.warn(`missing headers.authorization. client: ${req.url}`)
        return false
      }
      const authString = req.headers.authorization
      let [key, timestamp, sig] = authString.split(',')
      let result
      if (!opts.verifier) {
        result = await cryptoUtils.verifyInternal(key, parseInt(timestamp), sig, opts)
      } else {
        const pubKey = typeof opts.verifier === 'string' ? Buffer.from(opts.verifier, consts.DEFAULT_ENCODE) : opts.verifier
        result = await cryptoUtils.verifyString(key, parseInt(timestamp), sig, pubKey, opts)
      }
      if (!result) {
        logger.warn(`authorization failed. client: ${req.url}`)
      }
      return result
    }

    // 仅监听http server, 设置upgrade
    httpServer.on('upgrade', async (request, socket, head) => {
      /* eslint-disable-next-line node/no-deprecated-api */
      const requrl = url.parse(request.url)
      if (requrl.pathname !== attachPath) {
        socket.destroy()
        return
      }
      // 进行验证
      if (!opts.noAuth) {
        let result
        try {
          result = await verifyClient(request)
        } catch (err) {
          logger.tag('failed-to-verify-client').error(err)
        }
        if (!result) {
          socket.destroy()
          return
        }
      }
      // upgrade it
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request)
        logger.tag('Connected').log(`url=${request.url},auth=${request.headers.authorization}`)
      })
    })

    // 开新的port监听
    if (!appServer) {
      await new Promise(resolve => { httpServer.listen(port, resolve) })
      logger.tag('Listen').log(`url=ws://${host}:${port}`)
    }
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
            return {
              name: method.name,
              func: typeof method.func === 'function' ? method.func : undefined,
              encryptResult: !!method.encryptResult
            }
          } else {
            return null
          }
        }).filter(m => !!m)
      }
    }
    // 设置acceptMethods
    methods.forEach(method => {
      const methodName = _.kebabCase(method.name)
      this.acceptMethods.set(methodName, method)
    })
  }

  /**
   * 添加新的可接受方法
   * @param {string} methodName 方法名
   * @param {Function|undefined} methodFunc
   * @param {boolean} [encryptResult=false]
   */
  addAcceptableMethod (methodName, methodFunc, encryptResult) {
    methodName = _.kebabCase(methodName)
    const methodData = { name: methodName }
    if (typeof methodFunc === 'function') {
      methodData.func = methodFunc
    }
    methodData.encryptResult = !!encryptResult
    this.acceptMethods.set(methodName, methodData)
  }

  /**
   * 移除新是可接受方法
   * @param {string} methodName 方法名
   */
  removeAcceptableMethod (methodName) {
    methodName = _.kebabCase(methodName)
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
    logger.tag(`Request:${methodName}`).debug(`id=${reqData.id}`)
    const emitter = new EventEmitter()
    this.requests.set(reqData.id, emitter)
    const objToSend = _.clone(reqData)
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
        timestamp: sigData.timestamp,
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
          // 若需要加密，直接进行加密
          if (methodData.encryptResult) {
            res.result = await cryptoUtils.encryptData(res.result, !!this.opts.authWithTimestamp)
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
            logger.error(err)
          }
        })
      }
      logger.tag(`Invoked:${methodName}`).debug(`id=${jsonRequest.id}`)
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
      logger.tag(`Result`).debug(`id=${jsonResponse.id}` + (!jsonResponse.error ? '' : `,code=${jsonResponse.error.code},message=${jsonResponse.error.message}`))
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
