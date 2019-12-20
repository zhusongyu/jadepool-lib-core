const path = require('path')
const { promisify } = require('util')
const jp = require('../jadepool')
const BaseService = require('./core')
const consts = require('../consts')
const redis = require('../utils/redis')

const logger = require('@jadepool/logger').of('Service', 'Activity')

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
}

module.exports = ActiviyService
