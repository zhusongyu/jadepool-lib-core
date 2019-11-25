const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const Logger = require('@jadepool/logger')
const ServiceLib = require('./serviceLib')
const Context = require('./context')
const Module = require('./module')
const NBError = require('../support/NBError')

const logger = Logger.of('JadePool')

class JadePool {
  /**
   * 初始化Jadepool
   * @param {Context} ctx
   */
  async initialize (ctx) {
    /** @type {Map<string, {path: string, scope: string, impl: Module, withConfig: boolean}>} */
    this.modules = new Map()
    this.ctx = ctx
    await this.ctx.hookInitialize(this)
    logger.log(`Context initialized`)
  }
  /**
   * 判断是否完成初始化
   */
  get isInitialized () { return !!this.ctx }
  /**
   * 环境变量对象
   */
  get env () { return this.ctx.env }
  get config () { return this.ctx.config }
  get configSrv () { return this.ctx.configSrv }
  get consulSrv () { return this.ctx.consulSrv }
  /**
   * Context
   */
  get Context () { return Context }
  /**
   * 插件目录
   * @type {string}
   */
  get pluginDir () { return this._pluginDir }
  /**
   * 注册服务
   * @param {typeof BaseService|string} serviceClass
   * @param {Object} opts 传入的初始化参数
   */
  async registerService (serviceClass, opts) {
    return this.ctx.registerService.apply(this.ctx, arguments)
  }
  /**
   * 获取服务
   * @param {String} name
   * @returns {BaseService}
   */
  getService (name) {
    return this.ctx.getService.apply(this.ctx, arguments)
  }
  /**
   * 确保服务
   * @param {typeof BaseService|string} serviceClass
   * @param {Object} opts 传入的初始化参数
   */
  async ensureService (name, opts) {
    return this.ctx.ensureService.apply(this.ctx, arguments)
  }
  /**
   * 获取模型对象
   * @param {string} name
   */
  getModel (name) {
    return this.ctx.getModel.apply(this.ctx, arguments)
  }

  /**
   * 获取应用信息
   * @param {string} id
   */
  fetchAppConfig (id) {
    return this.ctx.fetchAppConfig.apply(this.ctx, arguments)
  }

  /**
   * 发起async plan
   */
  async createAsyncPlan () {
    return this.ctx.createAsyncPlan.apply(this.ctx, arguments)
  }

  /**
   * 方法调用
   */
  async invokeMethod () {
    return this.ctx.invokeMethod.apply(this.ctx, arguments)
  }
  /**
   * 方法检测
   */
  async invokeMethodValid () {
    return this.ctx.invokeMethodValid.apply(this.ctx, arguments)
  }

  /**
   * 加载目录下的全部模块
   * @param {String} moduleFolder
   */
  initModules (moduleFolder, moduleScope = 'default') {
    if (!fs.existsSync(moduleFolder)) return
    const nameInFolders = fs.readdirSync(moduleFolder).filter(fileName => fileName.indexOf('.') === -1)
    if (nameInFolders.length === 0) return
    // 设置配置的全局别名
    _.forEach(nameInFolders, name => {
      const modulePath = path.resolve(moduleFolder, name)
      // setup config part
      const configLoader = require('../utils/config/loader')
      const cfgPath = path.resolve(modulePath, 'config')
      let withConfig = fs.existsSync(cfgPath)
      if (withConfig) {
        configLoader.setAliasConfigPath(moduleScope, name, cfgPath)
      }
      // add to modules
      this.modules.set(name, {
        path: modulePath,
        scope: moduleScope,
        withConfig: withConfig,
        impl: undefined
      })
    })
    logger.tag('Module Init', moduleScope).log(`modules=${nameInFolders}`)
  }

  /**
   * 加载指定模块
   */
  getModule (name) {
    if (!this.modules.has(name)) {
      throw new NBError(10010, `no module: ${name}`)
    }
    const mod = this.modules.get(name)
    if (mod.impl) return mod.impl

    // setup impl part
    const requireFoolWebpack = require('require-fool-webpack')
    const filePathDist = path.join(mod.path, 'dist/index.bundle.js')
    const filePathSrc = path.join(mod.path, 'src/index.js')
    const distExists = fs.existsSync(filePathDist)
    const srcExists = fs.existsSync(filePathSrc)

    let impl
    if (this.env.isProd) {
      // 生产环境仅读取dist
      impl = distExists && requireFoolWebpack(filePathDist)
    } else {
      // 非生产优先src/index.js
      try {
        impl = srcExists && requireFoolWebpack(filePathSrc)
      } catch (err) {
        logger.tag('Failed to load src/index.js').debug(err && err.message)
        impl = distExists && requireFoolWebpack(filePathDist)
      }
    }

    let cfg = {}
    if (mod.withConfig) {
      cfg = this.config.util.loadFileConfigs(path.resolve(mod.path, 'config'))
    }
    mod.impl = new Module(name, mod.scope, impl, cfg)
    logger.tag('Module Loaded', mod.scope).log(`module=${name}`)
    return mod.impl
  }

  /**
   * 加载全部插件
   */
  async loadAllPlugins () {
    const configLoader = require('../utils/config/loader')
    const pluginsDat = await configLoader.loadConfig('plugins', '')
    if (!pluginsDat) return

    const pluginsCfg = pluginsDat.toMerged()
    const cwdPath = process.cwd()
    const pluginDir = path.resolve(cwdPath, pluginsCfg.root || 'plugins')

    let nameInFolders = []
    if (fs.existsSync(pluginDir)) {
      nameInFolders = fs.readdirSync(pluginDir).filter(fileName => fileName.indexOf('.') === -1)
      Object.defineProperty(this, '_pluginDir', { value: pluginDir })
    }
    let enabledPlugins = _.intersection(pluginsCfg.enabled || [], nameInFolders)
    for (let i = 0; i < enabledPlugins.length; i++) {
      await this.loadPlugin(enabledPlugins[i])
    }
  }
  /**
   * 加载插件
   * @param {string} name 插件名称
   */
  async loadPlugin (name) {
    if (!this.pluginDir) return

    let pluginInfo
    try {
      const pluginPath = path.resolve(this.pluginDir, name)
      if (process.env.BUNDLE_MODE !== '1') {
        pluginInfo = require(pluginPath)
      } else {
        const requireFoolWebpack = require('require-fool-webpack')
        pluginInfo = requireFoolWebpack(pluginPath)
      }
    } catch (err) {
      logger.error(`failed to load plugin: ${name}`, err)
    }
    if (!pluginInfo || typeof pluginInfo.install !== 'function') return

    const configLoader = require('../utils/config/loader')
    let pluginDat = await configLoader.loadConfig('plugins', name)
    if (!pluginDat) {
      const opts = pluginInfo.defaultOptions || {}
      pluginDat = await configLoader.saveConfig('plugins', name, opts)
    }
    const opts = pluginDat.toMerged()
    const plugin = pluginInfo.install(this, opts)
    // 设置插件信息
    plugin.name = name
    plugin.version = pluginInfo.version
    // Mounted函数调用
    if (typeof plugin.mounted === 'function') {
      await plugin.mounted(this.ctx)
    }
    // 设置进plugins
    this.ctx.hookPluginMounted(this, plugin)
    logger.tag('Plugin Loaded').log(`name=${name}`)
  }
  /**
   * 卸载插件
   * @param {string} name
   */
  async unloadPlugin (name) {
    const plugins = this.ctx.plugins
    if (!plugins.has(name)) return
    const plugin = plugins.get(name)
    // Unmounted函数调用
    if (typeof plugin.unmounted === 'function') {
      await plugin.unmounted(this.ctx)
    }
    // 移除Plugin应用
    this.ctx.hookPluginUnmounted(this, plugin)
    logger.tag('Plugin Unloaded').log(`name=${name}`)
  }
}
// Singleton导出
const jadepool = new JadePool()

let isGracefulExiting = false
/**
 * 统一Process处理函数
 */
const graceful = async (signal) => {
  if (isGracefulExiting) return
  isGracefulExiting = true
  // 新注册等待后方可自动退出
  const ts = 1000
  if (Date.now() - ServiceLib.lastRegisterTime < ts) {
    await new Promise(resolve => setTimeout(resolve, ts))
  }
  const serviceNames = jadepool.ctx ? jadepool.ctx.services.serviceNames : []
  if (serviceNames.length !== 0) {
    logger.diff('Services Exit').tag(`Begin`).log(`signal=${signal}`)
    try {
      for (let i = serviceNames.length - 1; i >= 0; i--) {
        const ins = jadepool.getService(serviceNames[i])
        if (typeof ins.onDestroy === 'function') {
          await ins.onDestroy(signal)
        }
        logger.tag('Detached').log(`name=${ins.name},i=${i}`)
      }
      logger.diff('Services Exit').tag('End').log(`signal=${signal}`)
    } catch (err) {
      logger.tag('Services Exit').error('failed to graceful exit', err)
    }
  }
  await Logger.exit()
  process.exit(0)
}
// 注册process的优雅退出处理函数
process.once('SIGUSR2', graceful)
process.once('SIGQUIT', graceful)
process.once('SIGTERM', graceful)
process.once('SIGINT', graceful)

module.exports = jadepool
