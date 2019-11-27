const express = require('express')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const morgan = require('morgan')
const cors = require('cors')
const bodyParser = require('body-parser')

const BaseService = require('./core')
const jp = require('../jadepool')
const consts = require('../consts')
const NBError = require('../support/NBError')
const logger = require('@jadepool/logger').of('Service', 'Express')

class AppService extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.APP, services)
  }

  /**
   * 该app service key
   */
  get serviceKey () { return `app-${jp.env.server}` }

  /**
   * @param {object} opts
   * @param {boolean} [opts.listenManually=false]
   * @param {object} [opts.server=undefined]
   * @param {number} [opts.defaultErrorStatus=500]
   * @param {(app: Express) => void} opts.routes
   */
  async initialize (opts = {}) {
    const app = express()

    // Middleware
    morgan.token('localedate', function (req, res) { return new Date().toLocaleString() })
    morgan.token('bodydata', function (req, res) {
      try {
        const dataToRecord = req.body.data || req.body
        return JSON.stringify(dataToRecord)
      } catch (err) {
        return 'undefined'
      }
    })
    app.use(morgan(':localedate|[RESTful][:method]|url=:url,status=:status,response-time=:response-time ms,body-data=:bodydata,res-content-length=:res[content-length]'))
    app.use(bodyParser.json())
    app.use(cors())

    // Routes
    if (typeof opts.routes === 'function') {
      opts.routes(app)
    }

    // Catch 404 Errors and forward them to error handler
    app.use((req, res, next) => {
      throw new NBError(404)
    })

    // Error handler function
    app.use((err, req, res, next) => {
      let status = opts.defaultErrorStatus || 500
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
      } else {
        // 未知系统错误
        status = 500
      }
      // 设置错误结果
      let promise
      if (!errResult) {
        const errSrv = jp.getService(consts.SERVICE_NAMES.ERROR_CODE)
        if (errSrv && errCode) {
          const reqData = Object.assign({}, req.query, req.body)
          const locale = (reqData.lang || reqData.locale) || consts.SUPPORT_LOCALES.ZH_CN
          promise = errSrv.getErrorInfo(errCode, locale).then(errResult => {
            const category = errResult.category ? [ errResult.category ] : []
            logger.tag(...category).error(errResult.message, err)
            if (err.message) {
              errResult.result = { info: err.message }
            }
            return errResult
          })
        }
      }
      if (!promise) {
        promise = Promise.resolve({ code: errCode || status, message: err && err.message })
      }
      // 发送
      promise.then(errResult => {
        res.status(status).json(errResult)
      }).catch(err => {
        res.status(500).json({ code: errCode, message: err.message })
      })
    })

    // Start the server
    // { host: string, http: { port: number, disabled: boolean }, https: { port: number, disabled: boolean, key: string, cert: string, ca: string } }
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
    // 若非手动监听，则直接启动
    if (!opts.listenManually) {
      await this.listen()
    }
  }

  // Methods
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
}

module.exports = AppService
