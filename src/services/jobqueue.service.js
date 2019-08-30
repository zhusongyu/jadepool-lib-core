const _ = require('lodash')
const moment = require('moment')
const Queue = require('bull')
const Task = require('./task')
const BaseService = require('./core')
const consts = require('../consts')
const jadepool = require('../jadepool')
const NBError = require('../NBError')
const redis = require('../utils/redis')

const logger = require('@jadepool/logger').of('Service', 'Job Queue')

const REDIS_CATEGORY = 'JobQueue'

class Service extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.JOB_QUEUE, services)
    /** @type {Map<string, Bull.Queue<any>>} */
    this._queues = new Map()
    /** @type {Map<string, {name: string, instance: Task, job: Queue.Job}>} */
    this._runnableDefs = new Map()
  }

  /**
   * 该Service的优雅退出函数
   * @returns {Promise}
   */
  async onDestroy () {
    // runnable defs
    for (const iter of this._runnableDefs) {
      const name = iter[0]
      const taskObj = iter[1]
      const taskIns = taskObj.instance
      if (taskIns && typeof taskIns.onDestroy === 'function') {
        await taskIns.onDestroy()
      }
      // remove current job
      if (taskObj.job) {
        await taskObj.job.remove()
        logger.tag('Task Job Removed').log(`task=${name}`)
      }
    }
    // exists queues
    for (const iter of this._queues) {
      const name = iter[0]
      const queue = iter[1]
      await queue.close()
      logger.tag('Queue Closed').log(`queue=${name}`)
    }
  }

  // Class Methods
  /**
   * 初始化
   * @param {Object} opts 传入的初始化参数
   * @param {JobDef[]} [opts.tasks=undefined] 任务配置
   * @param {Object} [opts.settings=undefined] job queue默认配置
   */
  async initialize (opts) {
    // 默认job queue参数
    this._defaultQueueOpts = _.clone(opts.settings || {})
    // 注册任务
    if (opts.tasks && opts.tasks.length > 0) {
      await this.registerJobQueues(opts.tasks)
    }
    // 启动需要启动的定时任务
    await this.startOrReloadJobs()
  }

  /**
   * 获取一个队列
   * @param {String} taskName
   */
  async fetchQueue (taskName, opts = {}) {
    let queue = this._queues.get(taskName)
    if (!queue) {
      const redisOpts = redis.getOpts(REDIS_CATEGORY)
      const params = [ taskName ]
      const queueOpts = Object.assign({
        prefix: 'JADEPOOL_JOB_QUEUE'
      }, opts)
      if (typeof redisOpts.url === 'string') {
        params.push(redisOpts.url)
      } else if (typeof redisOpts.port === 'number' && typeof redisOpts.host === 'string') {
        queueOpts.redis = _.pick(redisOpts, ['port', 'host', 'db', 'password'])
      } else {
        throw new NBError(`missing redis url.`)
      }
      params.push(queueOpts)
      // create queue
      queue = new Queue(...params)
      this._queues.set(taskName, queue)
    }
    return queue
  }

  /**
   * 注册任务
   * @param {{name: string, instance: Task}[]} tasks
   */
  async registerJobQueues (tasks = []) {
    logger.tag('Register Jobs').log(`amount=${tasks.length}`)

    // Step 3. 定义新的Tasks
    for (let i = 0, len = tasks.length; i < len; i++) {
      const task = tasks[i]
      if (!task.instance || !(task.instance instanceof Task)) {
        logger.tag('Job-missing').warn(`name=${task.name}`)
        continue
      }
      // 初始化
      await task.instance.onInit()
      const taskOpts = task.instance.opts
      // 获取JobQueue
      const queue = await this.fetchQueue(task.name, {
        limiter: {
          max: taskOpts.limiterMax,
          duration: taskOpts.limiterDuration,
          bounceBack: false
        },
        settings: Object.assign(_.clone(this._defaultQueueOpts), {
          lockDuration: taskOpts.lockDuration,
          stalledInterval: taskOpts.stalledInterval,
          maxStalledCount: taskOpts.maxStalledCount,
          backoffStrategies: {
            retry: taskOpts.retryStrategy || function () { return Math.random() * 1000 }
          }
        })
      })
      // 注册到JobQueue
      queue.process('*', taskOpts.concurrency, task.instance.onHandle.bind(task.instance))

      // add to runnable
      this._runnableDefs.set(task.name, task)
      logger.tag('Jobs-defined').log(`name=${task.name}`)
    }
  }
  /**
   * 注册单个任务
   * @param {{name: string, instance: Task}} task
   */
  async registerJobQueue (task) {
    await this.registerJobQueues([ task ])
  }

  /**
   * 运行或重启循环任务
   */
  async startOrReloadJobs () {
    const TaskConfig = jadepool.getModel(consts.MODEL_NAMES.TASK_CONFIG)
    let running = 0
    for (const iter of this._runnableDefs) {
      const taskName = iter[0]
      const taskObj = iter[1]
      // remove current job
      if (taskObj.job) {
        await taskObj.job.remove()
      }

      let taskCfg = await TaskConfig.findOne({ server: jadepool.env.server, name: taskName }).exec()
      if (!taskCfg || taskCfg.paused) continue

      const queue = await this.fetchQueue(taskName)
      const priority = taskObj.instance.opts.priority || 1
      // 根据TaskConfig进行 job启动
      const jobData = _.pick(taskObj, ['fileName', 'prefix', 'chainKey'])
      switch (taskCfg.jobtype) {
        case consts.JOB_TYPES.EVERY:
          if (taskCfg.seconds < 0) {
            logger.tag('Jobs-skiped', taskCfg.jobtype).log(`name=${taskName},sec=${taskCfg.seconds}`)
            continue
          }
          taskObj.job = await queue.add(jobData, {
            priority,
            repeat: {
              every: taskCfg.seconds * 1000 // ms
            }
          })
          logger.tag('Jobs-start').log(`name=${taskName},interval=${taskCfg.seconds}s`)
          break
        case consts.JOB_TYPES.SCHEDULE:
          if (!taskCfg.cron) {
            logger.tag('Jobs-skiped', taskCfg.jobtype).log(`name=${taskName},cron=${taskCfg.cron}`)
            continue
          }
          taskObj.job = await queue.add(jobData, {
            priority,
            repeat: {
              cron: taskCfg.cron
            }
          })
          logger.tag('Jobs-start').log(`name=${taskName},cron=${taskCfg.cron}`)
          break
        case consts.JOB_TYPES.NORMAL:
          if (!taskCfg.autoRunAmount) {
            logger.tag('Jobs-skiped', taskCfg.jobtype).log(`name=${taskName},auto.run=${taskCfg.autoRunAmount}`)
            continue
          }
          const runnings = await this.runningJobs(taskName)
          const autoRunAmount = Math.max(0, taskCfg.autoRunAmount - runnings)
          if (!autoRunAmount) {
            logger.tag('Jobs-skiped', taskCfg.jobtype).log(`name=${taskName},running=${runnings}`)
            continue
          }
          for (let i = 0; i < autoRunAmount; i++) {
            await queue.add({}, { priority })
          }
          logger.tag('Jobs-start').log(`name=${taskName},auto.run.amount=${autoRunAmount}`)
          break
      }
      running++
    }
    logger.tag('Jobs', 'Start-or-reload').log(`running=${running}`)
  }

  /**
   * 正在running的jobs
   * @param {string} taskName
   */
  async runningJobs (taskName) {
    const queue = await this.fetchQueue(taskName)
    return queue.getJobCountByTypes('active,waiting,delayed')
  }

  async every (interval, taskName, data, options = {}) {
    const queue = await this.fetchQueue(taskName)
    const repeat = {}
    if (typeof interval === 'number') {
      repeat.every = interval * 1000
    } else if (typeof interval === 'string') {
      repeat.cron = interval
    }
    return queue.add(data, Object.assign({}, options, { repeat }))
  }
  async schedule (when, taskName, data, options = {}) {
    const queue = await this.fetchQueue(taskName)
    const diff = moment(when).diff(moment())
    if (diff <= 0) {
      logger.tag('Cannot-schedule-before-now').warn(`when=${when}`)
      return
    }
    return queue.add(data, Object.assign({}, options, { delay: diff }))
  }
  async add ({ name, subName, data, options }) {
    options = Object.assign({
      attempts: 3,
      backoff: { type: 'retry' }
    }, options || {})
    data = data || {}
    const queue = await this.fetchQueue(name)
    if (subName !== undefined) {
      return queue.add(subName, data, options)
    } else {
      return queue.add(data, options)
    }
  }
}

module.exports = Service
