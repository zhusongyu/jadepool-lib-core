const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
const bodyParser = require('body-parser')

const HttpBaseService = require('./httpbase.service')

const consts = require('../consts')
const NBError = require('../support/NBError')

class ExpressService extends HttpBaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.APP, services)
  }

  /**
   * @param {object} opts
   * @param {(app: Express) => void} opts.routes
   */
  async createApp (opts) {
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
      let locale = req.acceptsLanguages('zh-cn', 'en', 'ja')
      if (!locale) {
        const reqData = Object.assign({}, req.query, req.body)
        locale = reqData.lang || reqData.locale || consts.SUPPORT_LOCALES.ZH_CN
      }
      const promise = this.onErrorHandling(err, locale)
      // 发送
      promise.then(result => {
        res.status(result.status).json(result.body)
      }).catch(err => {
        res.status(500).json({ code: 500, message: err.message })
      })
    })

    return app
  }
}

module.exports = ExpressService
