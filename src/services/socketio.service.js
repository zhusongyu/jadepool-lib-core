const _ = require('lodash')
const socketio = require('socket.io')
const jp = require('../jadepool')
const consts = require('../consts')
const NBError = require('../NBError')
const cryptoUtils = require('../utils/crypto')
const logger = require('@jadepool/logger').of('Service', 'SocketIO')

class SocketService extends jp.BaseService {
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
   * @param {Boolean} [opts.adapter=undefined] 启用adapter的配置
   * @param {Boolean} [opts.disableInternal=false] 是否禁用internal名字空间
   */
  async initialize (opts) {
    // Step 0. 频道Map
    this._channels = new Map()

    // Step 1. 初始化io实例
    const ioOpts = { serveClient: false, cookie: false }
    // 检查app.service是否存在
    const appService = jp.getService(consts.SERVICE_NAMES.APP)
    let listenPort
    if (appService && appService.server) {
      listenPort = appService.port
      this.io = socketio(appService.server, ioOpts)
    } else {
      const cfgLoader = require('../utils/configLoader')
      const processKey = consts.PROCESS.TYPES.ROUTER + '-' + jp.env.server
      const serviceDat = await cfgLoader.loadConfig('services', processKey)
      if (!serviceDat) {
        throw new NBError(10001, `missing services config: ${processKey}`)
      }
      const serviceCfg = serviceDat.toMerged()
      listenPort = serviceCfg.http.port
      this.io = socketio(listenPort, ioOpts)
    }
    logger.tag('AttachTo').log(`port=${listenPort}`)

    // Step 2. 设置Adapter
    if (opts.adapter) {
      const adapterOpts = opts.adapter
      if (adapterOpts.type === 'mongo') {
        let dbUrl
        if (typeof adapterOpts.url === 'string') {
          dbUrl = adapterOpts.url
        } else {
          const db = require('../utils/db')
          dbUrl = db.getUri('mubsub')
        }
        const mongoAdapter = require('socket.io-adapter-mongo')
        this.io.adapter(mongoAdapter(dbUrl))
        logger.tag('Adapter').log('use mongo.')
      } else if (adapterOpts.type === 'redis') {
        let redisOpts = { host: jp.env.host, port: 6379 }
        if (typeof adapterOpts.host === 'string') {
          redisOpts.host = adapterOpts.host
          redisOpts.port = typeof adapterOpts.port === 'number' ? adapterOpts.port : redisOpts.port
        }
        const redisAdapter = require('socket.io-redis')
        this.io.adapter(redisAdapter(redisOpts))
        logger.tag('Adapter').log('use redis.')
      }
    }

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
      logger.tag('Authentication').error(null, err)
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
        logger.tag('Client OnError').error(null, err)
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
    let result = await _invokeInternalMethod(worker.socket, methodName, args)
    result.namespace = namespace
    result.sid = worker.sid
    return result
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
    let result = await _invokeInternalMethod(worker.socket, methodName, args)
    result.namespace = namespace
    result.sid = worker.sid
    return result
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
      allPromises.push(_invokeInternalMethod(worker.socket, methodName, args)
        .then(res => {
          res = res || {}
          res.namespace = namespace
          res.sid = worker.sid
          return res
        })
        .catch(err => errors.push(err.message)))
    })
    let result = (await Promise.all(allPromises)).filter(res => res !== undefined && res !== null)
    if (errors.length > 0) {
      logger.tag('Broadcast Errors').warn(...errors)
    }
    return result
  }
}

/**
 * 进行内方法调用的实际执行函数
 * @param {SocketIO.Socket} socket
 * @param {String} methodName
 * @param {Object} args
 * @param {Function} callback
 */
const _invokeInternalMethod = (socket, methodName, args) => {
  return new Promise((resolve, reject) => {
    socket.emit(consts.SIO_EVENTS.INVOKE_METHOD, methodName, args, function (err, data) {
      if (err) {
        reject(new NBError(err.code || 10001, err.message))
      } else {
        resolve(data || {})
      }
    })
  })
}

module.exports = SocketService
