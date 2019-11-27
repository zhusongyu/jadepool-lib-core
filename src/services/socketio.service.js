const _ = require('lodash')
const socketio = require('socket.io')
const BaseService = require('./core')
const jp = require('../jadepool')
const consts = require('../consts')
const NBError = require('../support/NBError')
const cryptoUtils = require('../utils/crypto')
const logger = require('@jadepool/logger').of('Service', 'SocketIO')

class SocketService extends BaseService {
  /**
   * @param {SerivceLib} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.SOCKET_IO, services)
    this.internalPrefix = '/internal-'
  }

  /**
   * 该SocketIO将重用app.service的导出的server
   * @param {Object} opts
   * @param {Number} [opts.timeout=120] 120秒请求过期
   * @param {Numbr} [opts.port=undefined] 若无app.service则监听
   * @param {Boolean} [opts.disableInternal=false] 是否禁用internal名字空间
   */
  async initialize (opts) {
    /**
     * 过期时间
     * @type {number}
     */
    this.timeout = opts.timeout || 120
    // Step 0. 频道Map
    this._channels = new Map()

    // Step 1. 初始化io实例
    const ioOpts = { serveClient: false, cookie: false }
    // 检查app.service是否存在
    const appService = jp.getService(consts.SERVICE_NAMES.APP)
    let listenPort
    let ssl = false
    if (appService) {
      let server
      if (appService.serverSSL) {
        listenPort = appService.portSSL
        server = appService.serverSSL
        ssl = true
      } else if (appService.server) {
        listenPort = appService.port
        server = appService.server
      } else {
        throw new NBError(10001, `missing tcp server`)
      }
      this.io = socketio(server, ioOpts)
    } else if (typeof opts.port === 'number') {
      listenPort = opts.port
      this.io = socketio(listenPort, ioOpts)
    } else {
      throw new NBError(10002, `missing socket.io parameters`)
    }
    // 注册到consul
    await jp.consulSrv.registerService(consts.SERVICE_NAMES.SOCKET_IO, listenPort, {
      protocol: ssl ? 'https' : 'http',
      service: 'socketio.service',
      processKey: jp.env.processKey
    })
    logger.tag('AttachTo').log(`port=${listenPort}`)

    // Step 3. 设置通用中间件
    this.io.use(async (socket, next) => {
      logger.tag('TryConnect').logObj(socket.handshake.query)
      next()
    })

    // Step 4. 逐个初始化需要使用的部分
    if (!opts.disableInternal) {
      this._setupInternalNsp()
    }
  }

  /**
   * 初始化内部IPC用 socket namespace
   * @param {Object} opts
   */
  _setupInternalNsp (opts) {
    const dynamicInternalNsp = this.getChannelSpace()
    // Step 1. io需要认证相关的中间件
    dynamicInternalNsp.use(async (socket, next) => {
      const query = socket.handshake.query
      if (await cryptoUtils.verifyInternal(query.key, query.timestamp, query.sig)) {
        return next()
      }
      const err = new NBError(401, `query=${JSON.stringify(query)}`)
      logger.tag('Authentication').error(err)
      return next(err)
    })
    // Step 2. 连接设置
    dynamicInternalNsp.on('connect', (socket) => {
      const socketNsp = socket.nsp
      const internalKey = socketNsp.name.substr(this.internalPrefix.length)
      logger.tag('Client Connected').log(`socketId=${socket.id},category=${internalKey},namespace=${socketNsp.name}`)

      // 处理socketMap
      const socketMap = this.getSocketMap(internalKey)
      const s = socketMap.get(socket.id)
      // close previous connection
      if (s && s.socket) {
        s.socket.disconnect(true)
      }
      const now = Date.now()
      socketMap.set(socket.id, {
        sid: socket.id.split('#')[1] || socket.id,
        category: internalKey,
        socket,
        connectAt: now,
        updateAt: now
      })

      socket.on('disconnect', () => {
        socketMap.delete(socket.id)
        logger.tag('Client Disconnected').log(`socketId=${socket.id},category=${internalKey},namespace=${socketNsp.name}`)
      })
      socket.on('error', (err) => {
        logger.tag('Client OnError').error(err)
      })
    })
  }

  /**
   * 获取频道实例
   * @param {String|void} category
   * @returns {SocketIO.Namespace}
   */
  getChannelSpace (category = undefined) {
    let spaceKey
    if (category === undefined || category === null) {
      spaceKey = (name, query, next) => next(null, _.startsWith(name, this.internalPrefix))
    } else if (_.isString(category) && category !== '') {
      spaceKey = this.internalPrefix + category
    } else {
      spaceKey = '/'
    }
    return this.io.of(spaceKey)
  }

  /**
   * 判断是否具有该频道
   * @param {String} category
   * @returns {Boolean}
   */
  hasChannel (category) {
    return this._channels.has(category)
  }

  /**
   * 判断是否有Woker在该频道
   * @param {String} category
   * @returns {Boolean}
   */
  hasWorker (category) {
    let socketMap = this._channels.get(category)
    if (socketMap) {
      return socketMap.size > 0
    }
    return false
  }

  /**
   * 根据名称获取SocketMap
   * @param {String} category
   * @returns {Map<string, {sid: string, category:string, socket: SocketIO.Socket, connectAt: number, updateAt: number}>}
   */
  getSocketMap (category) {
    let socketMap = this._channels.get(category)
    if (!socketMap) {
      socketMap = new Map()
      this._channels.set(category, socketMap)
    }
    return socketMap
  }

  /**
   * 根据类型名选取一个已连接最早的Socket, 并更新updateAt
   * @param {String} category
   * @returns {{sid: string, category:string, socket: SocketIO.Socket, connectAt: number, updateAt: number}}
   */
  pickSocket (category) {
    const socketMap = this.getSocketMap(category)
    let minDatetime = Number.MAX_VALUE
    let picked
    socketMap.forEach(val => {
      if (val.updateAt < minDatetime) {
        picked = val
        minDatetime = val.updateAt
      }
    })
    if (picked) {
      picked.updateAt = Date.now()
    }
    return picked
  }

  /**
   * 为result补充namespace和sid参数
   * @param {object|array} result 仅Object和Array可补充
   * @param {string} namespace
   * @param {string} sid
   */
  _resultPostHandler (result, namespace, sid) {
    const resultBasicInfo = { namespace, sid }
    if (_.isArray(result)) {
      result = _.map(result, one => _.isObject(one) ? Object.assign(one, resultBasicInfo) : one)
    } else if (_.isObject(result)) {
      result = Object.assign(result, resultBasicInfo)
    }
    return result
  }

  /**
   * 调用内部跨进程方法
   * @param {String} namespace inteneralKey,通常为chain的Key
   * @param {String} methodName 方法名
   * @param {Object} args 参数
   * @returns {Promise<Object>} 方法返回的结果
   */
  async invokeInternalMethod (namespace, methodName, args) {
    if (!this.hasChannel(namespace)) {
      throw new NBError(21001, `namespace: ${namespace}`)
    }
    const worker = this.pickSocket(namespace)
    if (!worker) {
      throw new NBError(21002, `namespace: ${namespace}`)
    }
    // 执行远程调用
    logger.tag(`Invoke:${namespace}/Worker.${worker.sid}/${methodName}`).logObj(args)
    let result = await this._invokeInternalMethod(worker.socket, methodName, args)
    return this._resultPostHandler(result, namespace, worker.sid)
  }

  /**
   * 调用内部跨进程方法
   * @param {String} namespace inteneralKey,通常为chain的Key
   * @param {String} socketId socket的sid，需再次拼接修改为socket.id
   * @param {String} methodName 方法名
   * @param {Object} args 参数
   * @returns {Promise<Object>} 方法返回的结果
   */
  async invokeInternalMethodById (namespace, socketId, methodName, args) {
    if (!this.hasChannel(namespace)) {
      throw new NBError(21001, `namespace: ${namespace}`)
    }
    const socketMap = this.getSocketMap(namespace)
    const sid = this.internalPrefix + namespace + '#' + socketId
    const worker = socketMap.get(sid)
    if (!worker) {
      throw new NBError(21002, `socketId: ${socketId}`)
    }
    // 执行远程调用
    logger.tag(`Invoke:${namespace}/Worker.${worker.sid}/${methodName}`).logObj(args)
    let result = await this._invokeInternalMethod(worker.socket, methodName, args)
    return this._resultPostHandler(result, namespace, worker.sid)
  }

  /**
   * 广播内部跨进程方法
   * @param {String} namespace inteneralKey,通常为chain的Key
   * @param {String} methodName 方法名
   * @param {Object} args 参数
   * @return {Promise<Object[]>} 方法返回的结果
   */
  async broadcastInternalMethod (namespace, methodName, args) {
    let socketMap = new Map()
    if (this.hasChannel(namespace)) {
      socketMap = this.getSocketMap(namespace)
    }
    // 执行全部远程调用
    logger.tag(`Broadcast:${namespace}/Workers(${socketMap.size})/${methodName}`).logObj(args)
    const allPromises = []
    const errors = []
    socketMap.forEach(worker => {
      allPromises.push(this._invokeInternalMethod(worker.socket, methodName, args)
        .then(res => this._resultPostHandler(res || {}, namespace, worker.sid))
        .catch(err => errors.push(err && err.message)))
    })
    let result = (await Promise.all(allPromises)).filter(res => res !== undefined && res !== null)
    if (errors.length > 0) {
      logger.tag('Broadcast Errors').warn(...errors)
    }
    return result
  }
  /**
   * 进行内方法调用的实际执行函数
   * @param {SocketIO.Socket} socket
   * @param {String} methodName
   * @param {Object} args
   * @param {Function} callback
   */
  _invokeInternalMethod (socket, methodName, args) {
    return new Promise((resolve, reject) => {
      // 30秒超时定义
      const timeoutMs = this.timeout * 1000
      const timeout = setTimeout(() => reject(new NBError(21005, `method=${methodName}`)), timeoutMs)
      socket.emit(consts.SIO_EVENTS.INVOKE_METHOD, methodName, args, function (err, data) {
        clearTimeout(timeout)
        if (err) {
          reject(new NBError(err.code || 10001, err.message))
        } else {
          resolve(data || {})
        }
      })
    })
  }
}

module.exports = SocketService
