const _ = require('lodash')
const jp = require('../jadepool')
const BaseService = require('./core')
const consts = require('../consts')
const csvLocales = require('../utils/csvLocales')

// const logger = require('@jadepool/logger').of('Service', 'Activity')

const REDIS_PREFIX = 'JADEPOOL_SERVICE:ACTIVITY_CODE:'

class ActiviyService extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.ACTIVITY, services)
  }

  /**
   * 初始化
   * @param {Object} opts
   */
  async initialize (opts) {
    // NOTHINIG
  }

  /**
   * 将 activity 相关的文本加载到 Redis
   * @param {string} localePath
   */
  async setupActivityLocales (localePath) {
    await csvLocales.loadCsvLocales(localePath, REDIS_PREFIX)
  }

  /**
   * 获取 activity 的日志信息
   * @param {string|{_id:string}} activity
   */
  async getActivityLog (activity, locale = consts.SUPPORT_LOCALES.ZH_CN) {
    const Activities = jp.getModel(consts.MODEL_NAMES.ACTIVITY)
    let doc
    if (_.isString(activity)) {
      doc = await Activities.findById(activity).exec()
    } else if (activity._id) {
      doc = activity
    }
    if (!doc) return null
    const logInfo = doc.log_info
    return csvLocales.getLocaleData(logInfo.code, logInfo.params, locale, REDIS_PREFIX)
  }

  /**
   * 创建一个新的 Activity
   * @param {string} category
   * @param {string} moduleName
   * @param {string} name
   * @param {string} operator
   * @param {string} [operatorRole=undefined]
   * @param {object} [data={}]
   * @param {object} [data.input=undefined]
   * @param {string} [data.input.permission=undefined]
   * @param {string} data.input.method
   * @param {string} data.input.params
   * @param {object} [data.output=undefined]
   * @param {object|string} data.output.result
   * @param {object|Error|string} data.output.error
   * @param {string[]} [data.logParams=undefined]
   */
  async _createActivity (category, moduleName, name, operator, operatorRole, data = {}) {
    const Activities = jp.getModel(consts.MODEL_NAMES.ACTIVITY)
    const activity = new Activities({
      category,
      module: moduleName,
      name,
      operator,
      operator_role: operatorRole
    })
    // 设置入参
    if (!_.isEmpty(data.input)) {
      if (data.input.permission) activity.set('input.permission', String(data.input.permission))
      if (data.input.method) activity.set('input.method', String(data.input.method))
      if (data.input.params) activity.set('input.params', JSON.stringify(data.input.params))
    }
    // 设置出参
    if (!_.isEmpty(data.output)) {
      if (data.output.result) activity.set('output.result', _.isString(data.output.result) ? data.output.result : JSON.stringify(data.output.result))
      if (data.output.error) activity.set('output.error', _.isString(data.output.error) ? data.output.error : JSON.stringify(data.output.error))
      // 自动记录时间
      if (data.output.result || data.output.error) {
        activity.set('output.record_at', Date.now())
      }
    }
    // 设置 log params
    if (data.logParams && data.logParams.length > 0) {
      activity.log_params = data.logParams.filter(one => _.isString(one))
    }
    await activity.save()
    return activity
  }

  /**
   * 更新 activity 的 log params
   * @param {string} activityId
   * @param {string|string[]} params
   */
  async pushActivityLogParams (activityId, params) {
    const newParmas = []
    if (_.isString(params)) {
      newParmas.push(params)
    } else {
      newParmas.push(..._.filter(params, one => _.isString(one)))
    }
    const Activities = jp.getModel(consts.MODEL_NAMES.ACTIVITY)
    return Activities.findByIdAndUpdate(activityId, {
      $push: { log_params: { $each: newParmas } }
    }, { new: true }).exec()
  }

  // -------- API INVOKE Activity --------
  /**
   * 创建一个 API 日志型活动记录
   */
  async startApiLog (moduleName, name, operator, operatorRole, input = {}, logParams = []) {
    return this._createActivity(
      consts.ACTIVITY_CATEGORY.API_INVOKE,
      moduleName,
      name,
      operator,
      operatorRole,
      { input, logParams }
    )
  }
  /**
   * 结束一个 API 日志型活动记录
   */
  async finishApiLog (activityId, output = {}, logParams = []) {
    const Activities = jp.getModel(consts.MODEL_NAMES.ACTIVITY)
    const update = {}
    // 设置 record at
    update.$set = { 'output.record_at': Date.now() }
    if (output.result) update.$set['output.result'] = _.isString(output.result) ? output.result : JSON.stringify(output.result)
    if (output.error) update.$set['output.error'] = _.isString(output.error) ? output.error : JSON.stringify(output.error)
    // log
    if (logParams.length > 0) {
      update.$push = { log_params: { $each: logParams.filter(one => _.isString(one)) } }
    }
    return Activities.findByIdAndUpdate(activityId, update, { new: true }).exec()
  }
  // -------- USER Activity --------
  async createUserActivity (moduleName, name, operator, operatorRole, logParams = [], extra = {}) {
    return this._createActivity(
      consts.ACTIVITY_CATEGORY.USER,
      moduleName,
      name,
      operator,
      operatorRole,
      {
        input: extra.input || {},
        output: !_.isEmpty(extra.output) ? extra.output : { result: true },
        logParams
      }
    )
  }
  // -------- SYSTEM Activity --------
  async createSystemActivity (moduleName, name, operator, logParams = []) {
    return this._createActivity(
      consts.ACTIVITY_CATEGORY.SYSTEM,
      moduleName,
      name,
      operator,
      undefined,
      {
        output: { result: true },
        logParams
      }
    )
  }
}

module.exports = ActiviyService
