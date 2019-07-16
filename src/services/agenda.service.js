const _ = require('lodash')
const semver = require('semver')
const Agenda = require('agenda')
const BaseService = require('./core')
const jp = require('../jadepool')
const consts = require('../consts')
const db = require('../utils/db')

const logger = require('@jadepool/logger').of('Service', 'Agenda')

class AgendaService extends BaseService {
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
    // 停止agenda processing
    await this._agenda.stop()
    // 后删除
    await Promise.all(_.map(this._tasks, task => {
      return task.instance.onDestroy()
    }))
    // 关闭agenda
    this._tasks.length = 0
    this._agenda.removeAllListeners()
  }

  // Class Methods
  /**
   * 初始化
   * @param {Object} opts 传入的初始化参数
   * @param {number} opts.processEvery 扫描db间隔秒数
   * @param {{fileName: String, name: String, chainKey: String}[]} [opts.tasks=undefined] 任务配置
   */
  async initialize (opts) {
    logger.diff('Initialize').log('Begin')
    // Step 0. 初始化agenda
    const mongoConn = await db.fetchConnection('agenda')
    let mongoLegacy = false
    // 判定mongo版本
    const mongoAdmin = new db.mongoose.mongo.Admin(mongoConn.db)
    await new Promise((resolve, reject) => {
      mongoAdmin.buildInfo(function (err, info) {
        if (err) {
          logger.error(`failed-to-getMongoDB-Info`, err)
          reject(err)
          return
        }
        if (semver.lt(info.version, '3.6.0')) {
          mongoLegacy = true
        }
        logger.log(`mongodb.version=${info.version},mongoLegacy=${mongoLegacy}`)
        resolve()
      })
    })
    this._isMongoLegacy = mongoLegacy

    // Ageneda实例
    this._agenda = new Agenda({
      mongo: mongoConn.db,
      processEvery: `${opts.processEvery || 10} seconds`,
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

    // 等待agenda初始化完成
    if (!this._inited) {
      await this._agenda._ready
    }
    // 创建index
    await this.ensureIndexes()

    // Step 1. 加载Tasks配置
    this._tasks = (opts && opts.tasks) || []
    logger.tag('Jobs-find').log(`amount=${this._tasks.length}`)

    // Step 2 清理过期Tasks
    let cleaned = 0
    try {
      const taskNames = this._tasks.map(task => task.name)
      cleaned = await this.cancelFinishedJobs(taskNames)
    } catch (err) {
      logger.error('failed to cancel tasks', err)
    }
    if (cleaned > 0) {
      logger.tag('Jobs-cleanup').log(`amount=${cleaned}`)
    }

    // Step 3. 定义新的Tasks
    for (let i = 0, len = this._tasks.length; i < len; i++) {
      const t = this._tasks[i].instance
      if (!t) {
        logger.tag('Job-missing').warn(`name=${t.name}`)
        continue
      }
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
      const TaskConfig = jp.getModel(consts.MODEL_NAMES.TASK_CONFIG)
      let taskCfg = await TaskConfig.findOne({ server: jp.env.server, name: taskObj.name }).exec()
      if (!taskCfg || taskCfg.paused) return
      // 根据TaskConfig进行 job启动
      const jobData = _.pick(taskObj, ['fileName', 'prefix', 'chainKey'])
      switch (taskCfg.jobtype) {
        case consts.JOB_TYPES.EVERY:
          if (taskCfg.seconds < 0) return
          const timeStr = `${taskCfg.seconds} seconds`
          logger.tag('Jobs-start', taskObj.name).log(`interval=${timeStr}`)
          taskObj.job = await this._agenda.every(timeStr, taskObj.name, jobData)
          break
        case consts.JOB_TYPES.SCHEDULE:
          if (!taskCfg.cron) return
          logger.tag('Jobs-start', taskObj.name).log(`cron=${taskCfg.cron}`)
          taskObj.job = await this._agenda.every(taskCfg.cron, taskObj.name, jobData)
          break
        case consts.JOB_TYPES.NORMAL:
          if (!taskCfg.autoRunAmount) return
          const runnings = await this.runningJobs(taskObj.name)
          const autoRunAmount = Math.max(0, taskCfg.autoRunAmount - runnings.length)
          if (!autoRunAmount) return
          logger.tag('Jobs-start', taskObj.name).log(`auto.run.amount=${autoRunAmount}`)
          for (let i = 0; i < autoRunAmount; i++) {
            this._agenda.now(taskObj.name, jobData)
          }
          break
      }
      running++
    }))
    logger.tag('Jobs', 'Start-or-reload').log(`running=${running}`)
  }

  /**
   * 设置index
   */
  async ensureIndexes () {
    if (!this._inited) {
      await this._agenda._ready
    }
    return new Promise((resolve, reject) => {
      const coll = this._agenda._collection
      const oneHour = 3600
      try {
        coll.createIndex({ name: 1, 'data.id': 1, nextRunAt: -1 }, {
          name: 'runningCheck1',
          partialFilterExpression: { nextRunAt: { $exists: true } },
          expireAfterSeconds: oneHour
        })
        coll.createIndex({ name: 1, 'data.id': 1, lastFinishedAt: -1, lastRunAt: -1 }, {
          name: 'runningCheck2',
          expireAfterSeconds: oneHour
        })
      } catch (err) {
        logger.error('Failed to create Agenda index!', err)
      }
      resolve()
    })
  }

  /**
   * 移除已经完成任务
   * @param {string[]} taskNames
   */
  async cancelFinishedJobs (taskNames) {
    // 只要是lockedAt为null的全都可以删掉，因为lockedAt是在agenda.stop或者task finish后设置的
    return this._agenda.cancel({ name: { $in: taskNames }, lockedAt: null })
  }

  /**
   * 正在running的jobs
   * @param {string} taskName
   */
  async runningJobs (taskName, id = undefined) {
    let runningQuery
    // 版本
    if (this._isMongoLegacy) {
      runningQuery = {
        $where: 'function () { return this.lastRunAt > this.lastFinishedAt }'
      }
    } else {
      runningQuery = {
        $expr: { $gt: [ '$lastRunAt', '$lastFinishedAt' ] }
      }
    }
    const query = {
      name: taskName,
      $or: [
        { nextRunAt: { $ne: null } },
        { lastFinishedAt: { $exists: false } },
        runningQuery
      ]
    }
    // runingJobs可添加id进行check
    if (id !== undefined) {
      query['data.id'] = id
    }
    // 返回运行中的任务
    return this.jobs(query)
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
