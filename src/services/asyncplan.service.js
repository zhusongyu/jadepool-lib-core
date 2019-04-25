const BaseService = require('./core')
const consts = require('../consts')
const NBError = require('../NBError')

// const logger = require('@jadepool/logger').of('Service', 'Async Plan')

class Service extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.CHILD_PROCESS, services)
    // check required
    const agendaSrv = services.get(consts.SERVICE_NAMES.AGENDA)
    if (!agendaSrv) {
      throw new NBError(10001, `missing agenda service`)
    }
  }

  /**
   * 初始化
   * @param {Object} opts
   */
  async initialize (opts) {
    // TODO
  }

  /**
   * 该Service的优雅退出函数
   * @param signal 退出信号
   */
  async onDestroy (signal) {
    // TODO
  }
}

module.exports = Service
