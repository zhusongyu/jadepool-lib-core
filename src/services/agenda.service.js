const _ = require('lodash')
const Agenda = require('agenda')
const jp = require('../jadepool')
const consts = require('../consts')
const db = require('../utils/db')

const logger = require('@jadepool/logger').of('Service', 'Agenda')

class AgendaService extends jp.BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.AGENDA, services)
  }

  /**
   * 该Service的优雅退出函数
   * @returns {Promise}
   */
  async onDestroy () {
    // 先禁用
    await Promise.all(_.map(this._tasks, task => {
      return task.instance.disable()
    }))
    // 后删除
    await Promise.all(_.map(this._tasks, task => {
      return task.instance.onDestroy()
    }))
    // 关闭agenda
    this._tasks.length = 0
    this._agenda.removeAllListeners()
    await this._agenda.stop()
  }

  // Class Methods
  /**
   * 初始化
   * @param {{ tasks: [{fileName: String, name: String, chainKey: String}] }} opts 传入的初始化参数
   */
  async initialize (opts) {
    logger.diff('Initialize').log('Begin')
    // Step 0. 初始化agenda
    const mongoConn = await db.fetchConnection('agenda')
    this._agenda = new Agenda({
      mongo: mongoConn.db,
      processEvery: '10 seconds',
      maxConcurrency: 30,
      defaultConcurrency: 1
    })
    this._agenda.once('ready', () => {
      this._inited = true
      logger.diff('Initialize').log('DB-Ready')
    })
    this._agenda.on('fail', (err, job) => {
      logger.tag('Jobs-failed').log(`name=${job.attrs.name},msg=${err.message}`)
    })
    // Step 1. 加载Tasks配置
    this._tasks = (opts && opts.tasks) || []
    const taskNames = this._tasks.map(task => task.name)
    logger.tag('Jobs-load').log(`amount=${this._tasks.length}`)

    // Step 2 清理过期Tasks
    let cleaned = 0
    try {
      if (!this._inited) {
        await this._agenda._ready
      }
      cleaned = await this._agenda.cancel({ name: { $in: taskNames } })
    } catch (err) {
      logger.error('failed to cancel tasks', err)
    }
    logger.tag('Jobs-cleanup').log(`amount=${cleaned}`)

    // Step 3. 定义新的Tasks
    for (let i = 0, len = this._tasks.length; i < len; i++) {
      const t = this._tasks[i].instance
      if (t.onInit && typeof t.onInit === 'function') {
        await t.onInit()
      }
      if (t.onHandle && typeof t.onHandle === 'function') {
        if (t.opts) {
          this._agenda.define(t.name, t.opts, t.onHandle.bind(t))
        } else {
          this._agenda.define(t.name, t.onHandle.bind(t))
        }
      }
      logger.tag('Jobs-defined').log(`name=${t.name}`)
    }

    // Step 4. 启动agenda
    await this._agenda.start()

    // Step 5. 启动本地任务
    await this.startOrReloadJobs()

    logger.diff('Initialize').log(`Started`)
  }

  /**
   * 启动或重新加载Jobs
   */
  async startOrReloadJobs () {
    let running = 0
    await Promise.all(_.map(this._tasks, async taskObj => {
      if (taskObj.job) {
        await taskObj.job.remove()
      }
      let taskCfg = await jp.models.TaskConfig.findOne({ server: jp.env.server, name: taskObj.name }).exec()
      if (!taskCfg) return
      // 根据TaskConfig进行 job启动
      if (taskCfg.jobtype === consts.JOB_TYPES.EVERY) {
        if (taskCfg.seconds < 0) return
        const timeStr = `${taskCfg.seconds} seconds`
        logger.tag('Jobs-start', taskObj.name).log(`interval=${timeStr}`)
        taskObj.job = await this._agenda.every(timeStr, taskObj.name, _.pick(taskObj, ['fileName', 'prefix', 'chainKey']))
      } else if (taskCfg.jobtype === consts.JOB_TYPES.SCHEDULE) {
        logger.tag('Jobs-start', taskObj.name).log(`cron=${taskCfg.cron}`)
        taskObj.job = await this._agenda.every(taskCfg.cron, taskObj.name, _.pick(taskObj, ['fileName', 'prefix', 'chainKey']))
      }
      running++
    }))
    logger.tag('Jobs', 'Start-or-reload').log(`running=${running}`)
  }

  // agenda sugar
  async jobs (query) {
    if (!this._inited) {
      await this._agenda._ready
    }
    return this._agenda.jobs(query)
  }
  /**
   * 更新jobs
   */
  async update (query, update) {
    if (!this._inited) {
      await this._agenda._ready
    }
    return this._agenda._collection.updateMany(query, update)
  }

  async every (interval, name, data, options) {
    if (!this._inited) {
      await this._agenda._ready
    }
    return this._agenda.every(interval, name, data, options)
  }
  async schedule (when, name, data) {
    if (!this._inited) {
      await this._agenda._ready
    }
    return this._agenda.schedule(when, name, data)
  }
  async now (name, data) {
    if (!this._inited) {
      await this._agenda._ready
    }
    return this._agenda.now(name, data)
  }
  async create (name, data) {
    if (!this._inited) {
      await this._agenda._ready
    }
    return this._agenda.create(name, data)
  }
}

module.exports = AgendaService
