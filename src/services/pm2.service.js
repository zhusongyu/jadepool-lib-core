const _ = require('lodash')
const pm2 = require('pm2')
const { promisify } = require('util')
const BaseService = require('./core')
const NBError = require('../NBError')
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
    const processNames = _.reduce(processResults, (all, curr) => {
      if (all.indexOf(curr.name) === -1) {
        all.push(curr.name)
      }
      return all
    }, [])
    // 退出全部相关进程
    await Promise.all(processNames.map(async processName => {
      try {
        await this.stop(processName, true)
      } catch (err) {
        logger.tag(`failed-to-stop`, processName).error(err)
      }
    }))
  }

  /**
   * 以特定模式启动当前程序
   * @param {Object} opts
   * @param {'app'|'task'|'agent'} [opts.mode='task'] 进程模式
   * @param {String} opts.param 进程参数
   * @param {String} [opts.task=undefined] 进程任务名称
   * @param {String|String[]} [opts.jobs=undefined] 进程负责的多个任务名称
   * @param {Number} [opts.timeout=undefined] 退出进程的超时
   * @param {String} [opts.cwd=undefined] 启动运行路径
   * @param {String} [opts.script=undefined] 启动脚本
   * @param {Boolean} [opts.cluster=false] 是否启动cluster模式
   * @param {Number} [opts.instances=1] cluster模式下启动的进程数
   */
  async start (opts) {
    const mode = opts.mode || 'task'
    const supportedModes = ['app', 'task', 'agent']
    if (supportedModes.indexOf(mode) === -1) {
      throw new NBError(10002, `unsupported mode`)
    }

    // 设置worker名字
    let workerProcessName = this.processPrefix
    if (opts.param) {
      workerProcessName += `-${opts.param}`
    }
    if (opts.task) {
      workerProcessName += `-${opts.task}`
    }
    // 操作进程启动
    const workerEnv = {
      JP_MODE: mode,
      JP_PARAM: opts.param || '',
      JP_TASK: opts.task || '',
      NODE_ENV: jadepool.env.name
    }
    if (opts.jobs) {
      workerEnv.JP_JOBS = _.isArray(opts.jobs) ? opts.jobs.join(',') : opts.jobs
    }
    // 添加外部workerEnv
    for (const key in jadepool.env) {
      const workerEnvPrefix = 'workerEnv'
      if (!key.startsWith(workerEnvPrefix)) continue
      const newKey = _.snakeCase('jp' + key.substr(workerEnvPrefix.length)).toUpperCase()
      workerEnv[newKey] = jadepool.env[key]
    }
    const startOpts = {
      name: workerProcessName,
      script: opts.script || jadepool.env.script,
      cwd: opts.cwd || process.cwd(),
      kill_timeout: opts.timeout || 1000 * 60 * 3, // timeout为3分钟
      force: typeof opts.force === 'boolean' ? opts.force : true, // 强制启动新进程
      instance_var: 'NODE_INSTANCE_ID',
      watch: false,
      env: workerEnv
    }
    if (opts.cluster) {
      startOpts.exec_mode = 'cluster'
      startOpts.instances = opts.instances || 1
    }
    // 启动进程
    const re = await pm2Start(startOpts)
    let results
    if (re && re.length > 0) {
      results = re.map(t => Object.assign(this._parsePM2Result(t), { env: workerEnv }))
    } else {
      throw new NBError(21003, `worker.name=${workerProcessName}`)
    }
    return results
  }

  /**
   * 重启程序
   * @param {String|Number} nameOrId
   */
  async restart (nameOrId) {
    let result
    // 由PM2管理进程
    let re = await pm2Restart(nameOrId)
    if (re && re.length > 0) {
      result = re.map(t => this._parsePM2Result(t))
    } else {
      throw new NBError(21003, `nameOrId=${nameOrId}`)
    }
    return result
  }

  /**
   * 关闭程序
   * @param {String|Number} nameOrId
   */
  async stop (nameOrId, isDelete = false) {
    // 对已有进程的启动，无需关注其他信息
    let result
    let re = isDelete ? (await pm2Delete(nameOrId)) : (await pm2Stop(nameOrId))
    if (re && re.length > 0) {
      result = re.map(t => this._parsePM2Result(t))
    } else {
      throw new NBError(21003, `nameOrId=${nameOrId}`)
    }
    return result
  }

  /**
   * 查询信息
   * @param {String|Number} nameOrId
   */
  async info (nameOrId) {
    let list = await this.list()
    return list.filter(t => {
      return t.name === nameOrId || `${t.worker_id}` === `${nameOrId}`
    })
  }

  /**
   * 返回全部相关进程
   */
  async list () {
    // 由PM2管理进程
    const list = await pm2List()
    return list.filter(o => o.name.startsWith(this.processPrefix)).map(t => this._parseProcessStatus(t))
  }

  /**
   * 返回简单结果
   * @param {Object} t
   */
  _parsePM2Result (t) {
    return {
      name: t.name,
      worker_id: t.pm_id,
      pid: undefined,
      status: t.status,
      restarts: t.restart_time,
      unstable_restarts: t.unstable_restarts
    }
  }
  /**
   * 返回结果
   * @param {Object} t
   */
  _parseProcessStatus (t) {
    return {
      name: t.name,
      worker_id: t.pm_id,
      uuid: t.pm2_env.unique_id,
      pid: t.pid,
      monit: t.monit,
      status: t.pm2_env.status,
      uptime: t.pm2_env.pm_uptime,
      restarts: t.pm2_env.restart_time,
      unstable_restarts: t.pm2_env.unstable_restarts,
      env: {
        JP_MODE: t.pm2_env.JP_MODE,
        JP_PARAM: t.pm2_env.JP_PARAM || undefined,
        JP_TASK: t.pm2_env.JP_TASK || undefined,
        JP_JOBS: t.pm2_env.JP_JOBS || undefined,
        NODE_ENV: t.pm2_env.NODE_ENV
      }
    }
  }
}

module.exports = Service
