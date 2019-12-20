const path = require('path')
const { promisify } = require('util')
const jp = require('../jadepool')
const BaseService = require('./core')
const consts = require('../consts')
const redis = require('../utils/redis')

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
   * @param {Boolean} [opts.isHost=false]
   * @param {String} [opts.localePath=undefined]
   */
  async initialize (opts) {

  }

  /**
   * 将 activity 相关的文本加载到 Redis
   * @param {string} localePath
   */
  async loadActivityLocales (localePath) {
    // 确保redis配置正常, 若无法获取该方法将throw error
    this.redisClient = redis.fetchClient('LocaleCodeRedisClient')
    await new Promise(resolve => this.redisClient.once('state_change', resolve))

  }
}

module.exports = ActiviyService
