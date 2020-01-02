const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')

const BaseService = require('./core')
const jp = require('../jadepool')
const consts = require('../consts')
const NBError = require('../support/NBError')

const logger = require('@jadepool/logger').of('Service', 'Http')

class ExpressService extends BaseService {
  /**
   * 该app service key
   */
  get serviceKey () { return `app-${jp.env.server}` }
  /**
   * @param {object} opts
   * @param {object} [opts.server=undefined]
   * @param {boolean} [opts.listenManually=false]
   * @param {number} [opts.defaultErrorStatus=500]
   */
  async initialize (opts = {}) {
    this._errorStatus = opts.defaultErrorStatus || 500

    const app = await this.createApp(opts)
    // Start the server
    /*
      {
        host: string,
        http: { port: number, disabled: boolean },
        https: { port: number, disabled: boolean, key: string, cert: string, ca: string }
      }
    */
    let serviceCfg
    if (!opts.server) {
      const cfgLoader = require('../utils/config/loader')
      const serviceDat = await cfgLoader.loadConfig('services', this.serviceKey)
      if (!serviceDat) {
        throw new NBError(10001, `missing services config: ${this.serviceKey}`)
      }
      serviceCfg = serviceDat.toMerged()
    } else {
      serviceCfg = opts.server
    }

    if (!serviceCfg.http.disabled) {
      // 设置常量
      Object.defineProperties(this, {
        'server': { value: http.createServer(app) },
        'port': { value: serviceCfg.http.port }
      })
    }
    if (!serviceCfg.https.disabled) {
      const cwdPath = process.cwd()
      const opts = {
        key: fs.readFileSync(path.resolve(cwdPath, serviceCfg.https.key)),
        cert: fs.readFileSync(path.resolve(cwdPath, serviceCfg.https.cert)),
        ca: [fs.readFileSync(path.resolve(cwdPath, serviceCfg.https.ca))]
      }
      // 设置常量
      Object.defineProperties(this, {
        'serverSSL': { value: https.createServer(opts, app) },
        'portSSL': { value: serviceCfg.https.port }
      })
    }

    if (!opts.listenManually) {
      await this.listen()
    }
  }

  // 需要重载
  async createApp (opts) {
    throw new NBError(10001, `missing app implement.`)
  }

  async listen () {
    if (this.server && !this.server.listening) {
      await new Promise(resolve => { this.server.listen(this.port, resolve) })
      // 注册到consul
      await jp.consulSrv.registerService(`rest-${jp.env.server}-http`, this.port)
      logger.tag('HTTP Listening').log(`port=${this.port}`)
    }
    if (this.serverSSL && !this.serverSSL.listening) {
      await new Promise(resolve => { this.serverSSL.listen(this.portSSL, resolve) })
      // 注册到consul
      await jp.consulSrv.registerService(`rest-${jp.env.server}-https`, this.portSSL)
      logger.tag('HTTPS Listening').log(`port=${this.portSSL}`)
    }
  }

  /**
   * 处理错误
   * @param {Error} err
   */
  async onErrorHandling (err, locale = consts.SUPPORT_LOCALES.ZH_CN) {
    let status = err.status || this._errorStatus
    let errCode
    let errResult
    if (err.response) {
      // 第三方调用失败
      status = 200
      const errData = err.response.data
      errResult = {
        code: errData.status || errData.code,
        message: errData.message,
        result: errData.result
      }
    } else if (err.code === 'ECONNREFUSED') {
      // 第三方调用无响应
      status = 403
      errCode = 403
    } else if (typeof err.code === 'number') {
      // NBError系列处理
      if (err.code === 404) {
        status = 404
      }
      errCode = err.code
    }
    // 设置错误结果
    if (!errResult) {
      const errSrv = jp.getService(consts.SERVICE_NAMES.ERROR_CODE)
      if (errSrv && errCode) {
        errResult = await errSrv.getErrorInfo(errCode, locale)
        if (errResult) {
          const category = errResult.category ? [ errResult.category ] : []
          logger.tag(...category).error(errResult.message, err)
          if (err.message) {
            errResult.result = { info: err.message }
          }
        }
      }
    }
    if (!errResult) {
      errResult = { code: errCode || status, message: err && err.message }
    }
    return {
      status,
      body: errResult
    }
  }
}

module.exports = ExpressService
