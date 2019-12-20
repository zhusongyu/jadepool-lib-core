const jp = require('../jadepool')
const BaseService = require('./core')
const consts = require('../consts')
const csvLocales = require('../utils/csvLocales')

const REDIS_ERROR_CODE_PREFIX = 'JADEPOOL_SERVICE:ERROR_CODE:'

class ErrorCodeService extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.ERROR_CODE, services)
  }

  /**
   * 初始化
   * @param {Object} opts
   * @param {Boolean} [opts.isHost=false]
   * @param {String} [opts.localePath=undefined]
   */
  async initialize (opts) {
    // 从文件中读取error code, 并写入redis
    if (opts.isHost) {
      const localePath = opts.localePath || jp.config.errorCodePath
      await csvLocales.loadCsvLocales(localePath, REDIS_ERROR_CODE_PREFIX)
    }
  }
  /**
   * @param {number} code
   * @param {string} locale
   */
  async getErrorInfo (code, locale = consts.SUPPORT_LOCALES.ZH_CN) {
    return csvLocales.getLocaleData(code, [], locale, REDIS_ERROR_CODE_PREFIX)
  }
}

module.exports = ErrorCodeService
