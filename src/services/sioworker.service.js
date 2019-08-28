const io = require('socket.io-client')
const BaseService = require('./core')
const jp = require('../jadepool')
const consts = require('../consts')
const NBError = require('../NBError')
const cryptoUtils = require('../utils/crypto')

const logger = require('@jadepool/logger').of('Service', 'Worker(SocketIO)')

class SioWorkerService extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.SIO_WORKER, services)
    this.internalPrefix = '/internal-'
  }

  /**
   * 该Service的优雅退出函数
   * @returns {Promise}
   */
  async onDestroy () {
    this.sockets.forEach(socket => {
      if (!socket.disconnected) {
        socket.disconnect(true)
      }
    })
    this.sockets.clear()
  }

  /**
   * @param {{ namespaces: String[] }} opts
   */
  async initialize (opts = {}) {
    // Step 0. 加载服务器配置信息
    const serviceData = await jp.consulSrv.getServiceData(consts.SERVICE_NAMES.SOCKET_IO)
    const protocol = (serviceData.meta && serviceData.meta.protocol) ? `${serviceData.meta.protocol}://` : 'http://'
    const serverUri = protocol + serviceData.host + ':' + serviceData.port
    logger.tag('TryConnect').log(`host=${serviceData.host},port=${serviceData.port},meta=${JSON.stringify(serviceData.meta)}`)

    // Step 1. 构建认证query的签名
    const timestamp = Date.now()
    const key = encodeURI(`${consts.SERVICE_NAMES.SIO_WORKER}_${Math.floor(Math.random() * 1e8)}_${timestamp}`)
    let sig
    try {
      sig = await cryptoUtils.signInternal(key, timestamp)
    } catch (err) {
      throw new NBError(10001, `failed to sign internal`)
    }

    // Step 2. 新建Socket Manager
    this.ioManager = io.Manager(serverUri, {
      timeout: 120000,
      autoConnect: true,
      rejectUnauthorized: false,
      transports: ['websocket'],
      query: { key, timestamp: sig.timestamp, sig: sig.signature }
    })
    logger.tag('Manager').log(`url=${serverUri},query.key=${key},query.sig=${sig.signature}`)

    // Step 3. 根据opts创建worker
    const preloadNsps = opts.namespaces || []
    for (let i = 0; i < preloadNsps.length; i++) {
      await this.createWorkerSocket(preloadNsps[i])
    }
  }

  /**
   * @returns {Map<string, SocketIO.Socket>}
   */
  get sockets () {
    // 定义socket集合
    this._sockets = this._sockets || new Map()
    return this._sockets
  }

  /**
   * 连接到SocketIO服务并创建响应namespace的socket
   * @param {String} category
   * @returns {Boolean}
   */
  async createWorkerSocket (category) {
    const namespace = this.internalPrefix + category
    let socket = this.sockets.get(namespace)
    if (socket) return socket
    // Step 1. 创建新的socket
    socket = this.ioManager.socket(namespace)
    logger.tag('Create').log(`service=${category},namespace=${namespace}`)
    this._sockets.set(namespace, socket)

    // Step 2. 监听连接事件
    socket.on('connect', () => {
      logger.tag('Server Connected').log(`socketId=${socket.id},service=${category},namespace=${namespace}`)
    })
    socket.on('disconnect', (reason) => {
      logger.tag('Server Disconnected').log(`reason=${reason},service=${category},namespace=${namespace}`)
      // the disconnection was initiated by the server, you need to reconnect manually
      if (reason === 'io server disconnect') {
        socket.connect()
      }
    })
    socket.on('connect_error', err => { logger.tag('Connect').warn(`err=${err.name},message=${err.message}`) })
    socket.on('connect_timeout', (timeout) => { logger.tag('Timeout').warn(`timeout=${timeout}`) })
    socket.on('error', (err) => { logger.error(err) })

    // Step 3.监听行为事件
    socket.on(consts.SIO_EVENTS.INVOKE_METHOD, _invokeInternalMethod.bind(this, category))
  }
}

/**
 * 进行内方法调用的实际执行函数
 * @param {String} namespace
 * @param {String} methodName
 * @param {Object} args
 * @param {Function} callback
 */
const _invokeInternalMethod = async (namespace, methodName, args, callback) => {
  let result
  let error
  const diffKey = `${namespace}/${methodName}`
  logger.diff(diffKey).tag('Invoke Begin').logObj(args)
  try {
    result = await jp.invokeMethod(methodName, namespace, args)
  } catch (err) {
    error = { code: err.code, message: err.message }
  }
  logger.diff(diffKey).tag('Invoke End').logObj(args)
  callback(error, result)
}

module.exports = SioWorkerService
