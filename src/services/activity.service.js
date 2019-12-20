const jp = require('../jadepool')
const BaseService = require('./core')
const consts = require('../consts')
const csvLocales = require('../utils/csvLocales')

const logger = require('@jadepool/logger').of('Service', 'Activity')

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

  }

  /**
   * 将 activity 相关的文本加载到 Redis
   * @param {string} localePath
   */
  async loadActivityLocales (localePath) {
    // TODO
  }
}

module.exports = ActiviyService
