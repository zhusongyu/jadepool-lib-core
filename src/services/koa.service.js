const _ = require('lodash')
const Koa = require('koa')
const Router = require('@koa/router')
const cors = require('@koa/cors')
const logger = require('koa-logger')
const bodyParser = require('koa-bodyparser')
const responseTime = require('koa-response-time')

const HttpBaseService = require('./httpbase.service')

const consts = require('../consts')

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
    app.use(logger())
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
    if (opts.router instanceof Router) {
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
