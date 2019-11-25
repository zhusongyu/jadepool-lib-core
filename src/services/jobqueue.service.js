const _ = require('lodash')
const moment = require('moment')
const { URL } = require('url')
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
    /** @type {Map<string, {name: string, cleaner: number}>} */
    this._runnableMethods = new Map()
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
      }
      // remove interval
      if (taskObj.cleaner) {
        clearInterval(taskObj.cleaner)
      }
      logger.tag('Task Removed').log(`name=${name}`)
    }
    // runnable methods
    for (const iter of this._runnableMethods) {
      const name = iter[0]
      const info = iter[1]
      if (info.cleaner) {
        clearInterval(info.cleaner)
      }
      logger.tag('Method Job Removed').log(`name=${name}`)
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
        const redisUrl = new URL(redisOpts.url)
        const cfg = {
          host: redisUrl.hostname,
          port: redisUrl.port || 6379,
          password: redisUrl.password || undefined
        }
        if (redisUrl.pathname) {
          try {
            cfg.db = parseInt(redisUrl.pathname)
          } catch (err) {}
        }
        cfg.db = cfg.db || 2
        queueOpts.redis = cfg
      } else if (typeof redisOpts.host === 'string' &&
        (typeof redisOpts.port === 'number' || typeof redisOpts.port === 'string')) {
        const cfg = _.pick(redisOpts, ['port', 'host', 'db', 'password'])
        cfg.db = cfg.db || 2
        queueOpts.redis = cfg
      } else {
        throw new NBError(`missing redis url.`)
      }
      logger.tag('RedisConn').log(`name=${taskName},host=${queueOpts.redis.host},db=${queueOpts.redis.db}`)
      params.push(queueOpts)
      // create queue
      queue = new Queue(...params)
      this._queues.set(taskName, queue)
    }
    return queue
  }

  /**
   * 实际注册任务
   * @param {string} name job name
   * @param {Function} func job function
   * @param {TaskOptions} taskOpts
   */
  async _registerJob (name, func, taskOpts = {}) {
    // 获取JobQueue
    const queue = await this.fetchQueue(name, {
      limiter: {
        max: taskOpts.limiterMax || 1000,
        duration: taskOpts.limiterDuration || 5000,
        bounceBack: false
      },
      settings: Object.assign(_.clone(this._defaultQueueOpts), {
        lockDuration: taskOpts.lockDuration || 360000,
        stalledInterval: taskOpts.stalledInterval || 360000,
        maxStalledCount: taskOpts.maxStalledCount || 1,
        backoffStrategies: {
          retry: taskOpts.retryStrategy || function () { return Math.random() * 1000 }
        }
      })
    })
    // 注册到JobQueue
    queue.process('*', taskOpts.concurrency || 1, func)
    // 监听completed和failed
    queue.on('cleaned', function (jobs, type) {
      if (jobs.length > 0) {
        logger.tag(name, 'Cleaned').debug(`type=${type},jobs=${jobs.length}`)
      }
    })
    return setInterval(function () {
      queue.clean(60 * 1000, 'completed', 10000)
      queue.clean(8 * 60 * 60 * 1000, 'failed', 10000)
    }, 30 * 1000)
  }

  /**
   * 注册任务函数
   */
  async registerMethod (name, method, taskOpts) {
    if (taskOpts === undefined && typeof method === 'object') {
      taskOpts = method
      method = name
    }
    if (typeof name !== 'string') {
      throw new NBError(10001, `invalid name`)
    }
    if (typeof method !== 'function' && typeof method !== 'string') {
      throw new NBError(10001, `invalid method`)
    }
    const cleaner = await this._registerJob(name, async function (job) {
      switch (typeof method) {
        case 'function':
          return method(job)
        case 'string':
          return jadepool.invokeMethod(method, null, { job })
      }
      return true
    }, taskOpts)
    this._runnableMethods.set(name, { name, cleaner })
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
      // 注册并返回interval id
      task.cleaner = await this._registerJob(task.name, task.instance.onHandle.bind(task.instance), task.instance.opts)
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
