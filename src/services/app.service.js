const express = require('express')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const morgan = require('morgan')
const cors = require('cors')
const bodyParser = require('body-parser')

const jp = require('../jadepool')
const consts = require('../consts')
const NBError = require('../NBError')
const cfgLoader = require('../utils/config/loader')
const logger = require('@jadepool/logger').of('Service', 'Express')

class AppService extends jp.BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.APP, services)
  }

  /**
   * @param {object} opts
   * @param {boolean} opts.listenManually
   * @param {number} [opts.defaultErrorStatus=500]
   * @param {(app: Express) => void} opts.routes
   */
  async initialize (opts) {
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
      if (!errResult) {
        const errSrv = jp.getService(consts.SERVICE_NAMES.ERROR_CODE)
        if (errSrv && errCode) {
          errResult = errSrv.getErrObj(errCode)
          const category = errResult.category ? [ errResult.category ] : []
          logger.error(errResult.message, err, category)
          if (err.message) {
            errResult.result = { info: err.message }
          }
        } else {
          errResult = { code: err.code || status, message: err && err.message }
        }
      }
      res.status(status).json(errResult)
    })

    // Start the server
    const processKey = consts.PROCESS.TYPES.ROUTER + '-' + jp.env.server
    const serviceDat = await cfgLoader.loadConfig('services', processKey)
    if (!serviceDat) {
      throw new NBError(10001, `missing services config: ${processKey}`)
    }
    let serviceCfg = serviceDat.toMerged()
    if (serviceCfg.host !== jp.env.host) {
      serviceDat.applyModify({ host: jp.env.host })
      await serviceDat.save()
      logger.log(`host.modified=${jp.env.host}`)
    }
    if (!serviceCfg.http.disabled) {
      // 设置常量
      Object.defineProperties(this, {
        '_server': { value: http.createServer(app) },
        '_port': { value: serviceCfg.http.port }
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
        '_serverSSL': { value: https.createServer(opts, app) },
        '_portSSL': { value: serviceCfg.https.port }
      })
    }
    // 若非手动监听，则直接启动
    if (!opts.listenManually) {
      await this.listen()
    }
  }

  // Accessors
  get server () { return this._serverSSL || this._server }
  get port () { return this._portSSL || this._port }

  // Methods
  async listen () {
    if (this._server && !this._server.listening) {
      await new Promise(resolve => { this._server.listen(this._port, resolve) })
      logger.log(`port=${this._port}`, ['HTTP Listening'])
    }
    if (this._serverSSL && !this._serverSSL.listening) {
      await new Promise(resolve => { this._serverSSL.listen(this._portSSL, resolve) })
      logger.log(`port=${this._portSSL}`, ['HTTPS Listening'])
    }
  }
}

module.exports = AppService
