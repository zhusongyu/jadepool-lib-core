const _ = require('lodash')
const consts = require('../consts')
const buildEnvObject = require('./env')
const ServiceLib = require('./serviceLib')
const Logger = require('@jadepool/logger')
const logger = Logger.of('JadePool')

class JadePoolContext {
  constructor (serverType, version, invokeMethodFunc, configObj = undefined) {
    this.env = buildEnvObject(serverType, version)
    this._invokeMethodFunc = invokeMethodFunc
    /**
     * @type {Map<string, WeakMap<JadepoolPlugin, object>>}
     */
    this._methodHooks = new Map()
    // ServiceLib
    this.services = new ServiceLib()
    ServiceLib.lastRegisterTime = Date.now()
    // ConfigObject
    if (!configObj) {
      try {
        configObj = require('config')
      } catch (err) {
        configObj = {}
      }
    }
    Object.defineProperty(this, '_config', { value: configObj })
  }

  /**
   * @type {Map<string, JadepoolPlugin>}
   */
  get plugins () {
    if (!this._plugins) {
      Object.defineProperty(this, '_plugins', { value: new Map() })
    }
    return this._plugins
  }

  /**
   * 调用方法
   * @type {(methodName: string, namespace: string, args: any[], ...others) => any}
   */
  get invokeMethodFunc () { return this._invokeMethodFunc }

  /**
   * 配置对象
   * @type {Object}
   */
  get config () { return this._config }

  /**
   * Models
   */
  get models () {
    const result = {}
    result[consts.MODEL_NAMES.APPLICATION] = result.AppConfig = require('../models/app')
    result[consts.MODEL_NAMES.CONFIG_DATA] = result.ConfigDat = require('../models/configdat')
    result[consts.MODEL_NAMES.TASK_CONFIG] = result.TaskConfig = require('../models/taskConfig')
    result[consts.MODEL_NAMES.WARNING] = result.Warning = require('../models/warning')
    return result
  }

  /**
   * @param {string} name
   */
  getModel (name) {
    return this.models[name]
  }

  /**
   * 获取应用信息
   * @param {string} id
   */
  async fetchAppConfig (id) {
    const AppConfig = this.getModel(consts.MODEL_NAMES.APPLICATION)
    return AppConfig.findOne({ id }).exec()
  }

  /**
   * 注册服务
   * @param {typeof BaseService|string} serviceClass
   * @param {Object} opts 传入的初始化参数
   * @returns {BaseService}
   */
  async registerService (serviceClass, opts) {
    let ClassToRegister
    if (typeof serviceClass === 'string') {
      switch (serviceClass) {
        case consts.SERVICE_NAMES.APP:
          ClassToRegister = require('../services/app.service')
          break
        case consts.SERVICE_NAMES.ERROR_CODE:
          ClassToRegister = require('../services/error.code.service')
          break
        case consts.SERVICE_NAMES.SCRIPT:
          ClassToRegister = require('../services/script.service')
          break
        case consts.SERVICE_NAMES.JSONRPC:
          ClassToRegister = require('../services/rpcclient.service')
          break
        case consts.SERVICE_NAMES.JSONRPC_SERVER:
          ClassToRegister = require('../services/jsonrpc.service')
          break
        case consts.SERVICE_NAMES.SIO_WORKER:
          ClassToRegister = require('../services/sioworker.service')
          break
        case consts.SERVICE_NAMES.SOCKET_IO:
          ClassToRegister = require('../services/socketio.service')
          break
        case consts.SERVICE_NAMES.AGENDA:
          ClassToRegister = require('../services/agenda.service')
          break
        case consts.SERVICE_NAMES.CHILD_PROCESS:
          ClassToRegister = require('../services/process.service')
          break
        default:
          logger.warn(`failed to registerService: ${serviceClass}`)
          return
      }
    } else {
      ClassToRegister = serviceClass
    }
    return this.services.register(ClassToRegister, opts)
  }
  /**
   * 获取服务
   * @param {String} name
   * @returns {BaseService}
   */
  getService (name) {
    return this.services.get(name)
  }

  // Hook方法
  /**
   * Jadepool初始化
   */
  async hookInitialize (jadepool) {
    // NOTHING
  }
  hookPluginMounted (jadepool, plugin) {
    if (plugin && plugin.name) {
      if (this._invokeMethodFunc && typeof this._invokeMethodFunc === 'function') {
        this._applyMethodHooks(plugin, 'hookMethods', this._methodHooks)
      }
      this.plugins.set(plugin.name, plugin)
    }
  }
  hookPluginUnmounted (jadepool, plugin) {
    if (plugin && plugin.name && this.plugins.has(plugin.name)) {
      if (this._invokeMethodFunc && typeof this._invokeMethodFunc === 'function') {
        this._removeMethodHooks(plugin, 'hookMethods', this._methodHooks)
      }
      this.plugins.delete(plugin.name)
    }
  }

  // 封装方法
  buildSubContext (key) {
    return {
      app: this,
      env: this.env,
      configLoader: require('../utils/config/loader'),
      logger: Logger.of('JadePool Plugin', key)
    }
  }

  /**
   * 应用Method Hooks相关操作
   * @param {JadepoolPlugin} plugin
   * @param {string} sourceName
   * @param {Map<string, WeakMap<JadepoolPlugin, object>>} targetHookMap
   */
  _applyMethodHooks (plugin, sourceName, targetHookMap) {
    if (typeof plugin[sourceName] !== 'function') return
    const hooks = plugin[sourceName].call() || {}
    for (let methodName in hooks) {
      const key = _.kebabCase(methodName)
      const hookImpl = hooks[methodName]
      let pluginMap = targetHookMap.get(key)
      if (!pluginMap) {
        pluginMap = new WeakMap()
        targetHookMap.set(key, pluginMap)
      }
      pluginMap.set(plugin, hookImpl)
    }
  }

  /**
   * 移除Method Hooks相关操作
   * @param {JadepoolPlugin} plugin
   * @param {string} sourceName
   * @param {Map<string, WeakMap<JadepoolPlugin, object>>} targetHookMap
   */
  _removeMethodHooks (plugin, sourceName, targetHookMap) {
    if (typeof plugin[sourceName] !== 'function') return
    const hooks = plugin[sourceName].call() || {}
    for (let methodName in hooks) {
      const key = _.kebabCase(methodName)
      let pluginMap = targetHookMap.get(key)
      if (pluginMap && pluginMap.has(plugin)) {
        pluginMap.delete(plugin)
      }
    }
  }
  /**
   * 方法封装器
   * @param {Map<string, JadepoolPlugin>} plugins
   * @param {Map<string, WeakMap<JadepoolPlugin, object>>} methodHooks
   * @param {object} extraCxt 额外的上下文
   * @param {any} thisObj this对象
   * @param {string} methodName 方法名
   * @param {Function} methodFunc 方法体
   * @param {any[]} funcArgs 原始参数
   */
  async _methodWrapper (plugins, methodHooks, extraCxt, thisObj, methodName, methodFunc, funcArgs) {
    const key = _.kebabCase(methodName)
    /**
     * @type {{plugin: JadepoolPlugin, hookFunc: Function}[]}
     */
    const beforeHooks = []
    /**
     * @type {{plugin: JadepoolPlugin, hookFunc: Function}[]}
     */
    const afterHooks = []
    const hookMap = methodHooks.get(key)
    if (hookMap) {
      plugins.forEach(plugin => {
        const hookImpl = hookMap.get(plugin)
        if (!hookImpl) return
        if (typeof hookImpl.before === 'function') {
          beforeHooks.push({ plugin, hookFunc: hookImpl.before })
        }
        if (typeof hookImpl.after === 'function') {
          afterHooks.push({ plugin, hookFunc: hookImpl.after })
        }
      })
    }
    let replyError
    let replyResult
    let hasReply = false
    // Before Hook调用
    for (let i = 0; i < beforeHooks.length; i++) {
      const hookData = beforeHooks[i]
      const plugin = hookData.plugin
      const context = Object.assign({ plugin }, this.buildSubContext(plugin.name), extraCxt || {})
      try {
        const reply = await hookData.hookFunc(context, funcArgs)
        // 若在hook中result被设置了，即为直接返回结果
        if (reply && reply.result) {
          replyResult = reply.result
          hasReply = true
          break
        }
      } catch (err) {
        logger.tag('BeforeHook').error(`plugin=${plugin.name},method=${key}`, err)
      }
    } // end before hooks
    if (!hasReply) {
      try {
        replyResult = await methodFunc.apply(thisObj, funcArgs)
      } catch (err) {
        replyError = err
      }
    }
    // After Hook调用
    for (let i = 0; i < afterHooks.length; i++) {
      const hookData = afterHooks[i]
      const plugin = hookData.plugin
      const context = Object.assign({ plugin }, this.buildSubContext(plugin.name), extraCxt || {})
      try {
        await hookData.hookFunc(context, funcArgs, replyError, replyResult)
      } catch (err) {
        logger.tag('AfterHook').error(`plugin=${plugin.name},method=${key}`, err)
      }
    } // end after hooks
    if (replyError) {
      throw replyError
    } else {
      return replyResult
    }
  }
  // 调用方法
  /**
   * 进行Methods调用
   */
  async invokeMethod (methodName, namespace = null) {
    if (namespace === null || namespace === undefined || namespace === this.env.param) {
      // methodWrapper仅在本地调用时触发
      return this._methodWrapper(this.plugins, this._methodHooks, {}, null, methodName, this._invokeMethodFunc, arguments)
    } else {
      // 含有namespace的调用将不进行MethodWrapper
      return this._invokeMethodFunc.apply(null, arguments)
    }
  }
}

module.exports = JadePoolContext
