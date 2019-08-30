const pm2 = require('pm2')
const { promisify } = require('util')
const BaseService = require('./core')
const consts = require('../consts')
const jadepool = require('../jadepool')

const logger = require('@jadepool/logger').of('Service', 'PM2')

// pm2 promise
const pm2Init = promisify(pm2.connect).bind(pm2)
const pm2List = promisify(pm2.list).bind(pm2)
const pm2Start = promisify(pm2.start).bind(pm2)
const pm2Stop = promisify(pm2.stop).bind(pm2)
const pm2Delete = promisify(pm2.delete).bind(pm2)
const pm2Restart = promisify(pm2.restart).bind(pm2)

class Service extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.PM2_PROCESS, services)
  }

  /**
   * 当前名称
   */
  get processPrefix () {
    return `${consts.PROCESS.NAME_PREFIX}-${jadepool.env.processType}`
  }

  /**
   * 初始化
   * @param {Object} opts
   */
  async initialize (opts) {
    // 尝试连接PM2服务
    try {
      await pm2Init()
    } catch (err) {
      logger.tag('Failed-to-init-pm2').error(err)
      process.exit(1)
    }
  }

  /**
   * 该Service的优雅退出函数
   * @param signal 退出信号
   */
  async onDestroy (signal) {
    // 父进程退出时移除全部子进程
    let processResults
    try {
      processResults = await this.list()
    } catch (err) {
      logger.tag('failed-to-list').error(err)
      return
    }
    if (!processResults || processResults.length === 0) return
    // 退出全部相关进程
    await Promise.all(processResults.map(async processOpts => {
      try {
        await this.stop(processOpts.name, true)
      } catch (err) {
        logger.tag(`failed-to-stop`, processOpts.name).error(err)
      }
    }))
  }

  /**
   * 以特定模式启动当前程序
   * @param {Object} opts
   * @param {'app'|'task'|'agent'} [opts.mode='task'] 进程模式
   * @param {String} opts.param 进程参数
   * @param {String} [opts.task=undefined] 进程任务名称
   * @param {String} [opts.jobs=undefined] 进程负责的多个任务名称
   */
  async start (opts) {

  }

  /**
   * 重启程序
   */
  async restart (processName) {

  }

  /**
   * 关闭程序
   */
  async stop (processName, isDelete = false) {

  }

  /**
   * 返回全部相关进程
   */
  async list () {

  }
}

module.exports = Service
