const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const Logger = require('@jadepool/logger')
const ServiceLib = require('./serviceLib')
const Context = require('./context')
const BaseService = require('../services/core')

const logger = Logger.of('JadePool')

class JadePool {
  /**
   * 初始化Jadepool
   * @param {Context} ctx
   */
  initialize (ctx) {
    this.ctx = ctx
  }
  /**
   * 判断是否完成初始化
   */
  get isInitialized () { return !!this.ctx }
  /**
   * 环境变量对象
   */
  get env () { return this.ctx.env }
  /**
   * 全局配置
   * @type {object}
   */
  get config () { return this.ctx.config }
  /**
   * Models
   */
  get models () {
    return {
      ConfigDat: require('../models/configdat'),
      TaskConfig: require('../models/taskConfig'),
      Warning: require('../models/warning')
    }
  }
  /**
   * 插件目录
   * @type {string}
   */
  get pluginDir () { return this._pluginDir }
  /**
   * 注册服务
   * @param {typeof BaseService|string} serviceClass
   * @param {Object} opts 传入的初始化参数
   * @returns {BaseService}
   */
  async registerService (serviceClass, opts) {
    return this.ctx.registerService(serviceClass, opts)
  }
  /**
   * 获取服务
   * @param {String} name
   * @returns {BaseService}
   */
  getService (name) {
    return this.ctx.getService(name)
  }

  /**
   * 方法调用
   */
  async invokeMethod () {
    return this.ctx.invokeMethod.apply(this.ctx, arguments)
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
    const pluginDir = path.resolve(cwdPath, `../${pluginsCfg.root || 'plugins'}`)

    let nameInFolders = []
    if (fs.existsSync(pluginDir)) {
      nameInFolders = fs.readdirSync(pluginDir).filter(fileName => fileName.indexOf('.') === -1)
      Object.defineProperty(this, '_pluginDir', pluginDir)
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
const graceful = (SigStr) => {
  return async () => {
    if (isGracefulExiting) return
    isGracefulExiting = true
    // 新注册等待后方可自动退出
    const ts = 1000
    if (Date.now() - ServiceLib.lastRegisterTime < ts) {
      await new Promise(resolve => setTimeout(resolve, ts))
    }
    try {
      logger.diff('Services Exit').log(`Begin`)
      await Promise.all(_.map(jadepool.ctx.services, async ins => {
        if (typeof ins.onDestroy === 'function') {
          await ins.onDestroy()
        }
        logger.tag('Detached').log(`name=${ins.name}`)
      }))
      logger.diff('Services Exit').log(`End`)
    } catch (err) {
      logger.tag('Services Exit').error('failed to graceful exit', err)
    }
    await Logger.exit()
    process.kill(process.pid, SigStr)
  }
}
// 注册process的优雅退出处理函数
process.once('SIGUSR2', graceful('SIGUSR2'))
process.once('SIGQUIT', graceful('SIGQUIT'))
process.once('SIGTERM', graceful('SIGTERM'))
process.once('SIGINT', graceful('SIGINT'))

module.exports = Object.assign(jadepool, {
  Context,
  BaseService
})
