const _ = require('lodash')
const Koa = require('koa')
const cors = require('@koa/cors')
const koalogger = require('koa-logger')
const bodyParser = require('koa-bodyparser')
const responseTime = require('koa-response-time')

const logger = require('@jadepool/logger').of('Service', 'Koa')

const HttpBaseService = require('./httpbase.service')

const consts = require('../consts')
const jadepool = require('../jadepool')

class KoaService extends HttpBaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.KOA, services)
  }

  /**
   * @param {object} opts
   * @param {Router} opts.router
   * @param {any[]} opts.middlewares
   */
  async createApp (opts) {
    const app = new Koa()
    app.use(koalogger())
    app.use(responseTime())
    app.use(bodyParser({
      enableTypes: ['json'],
      onerror: function (err, ctx) { ctx.throw(err, 422) }
    }))
    app.use(cors())

    // add middlewares
    if (_.isArray(opts.middlewares)) {
      _.forEach(opts.middlewares, app.use)
    }

    // Default Error Handler
    app.use(async (ctx, next) => {
      try {
        await next()
      } catch (err) {
        if (!jadepool.env.isProd) {
          logger.tag(`Failed-to-invoke`).error(`path=${ctx.path}`, err)
        } else {
          logger.tag(`Failed-to-invoke`).info(`path=${ctx.path}`, err && err.message)
        }
        let locale = ctx.acceptsLanguages('zh-cn', 'en', 'ja')
        if (!locale) {
          const reqData = Object.assign({}, ctx.query, ctx.request.body)
          locale = reqData.lang || reqData.locale || consts.SUPPORT_LOCALES.ZH_CN
        }
        const info = await this.onErrorHandling(err, locale)
        ctx.status = info.status
        ctx.body = info.body
      }
    })

    // apply router
    if (opts.router &&
      typeof opts.router.routes === 'function' &&
      typeof opts.router.allowedMethods === 'function') {
      app.use(opts.router.routes())
        .use(opts.router.allowedMethods({ throw: true }))
    }

    // Catch 404 Errors and forward them to error handler
    app.use(async (ctx, next) => {
      ctx.throw(404)
    })

    return app.callback()
  }
}

module.exports = KoaService
