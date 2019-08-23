const _ = require('lodash')
const Queue = require('bull')
const BaseService = require('./core')
const consts = require('../consts')
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
  }

  /**
   * 该Service的优雅退出函数
   * @returns {Promise}
   */
  async onDestroy () {
    for (const iter of this._queues) {
      const name = iter[0]
      const queue = iter[1]
      await queue.close()
      logger.tag('Queue Closed').log(`task=${name}`)
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
    this._defaultQueueOpts = _.clone(opts.settings || {})
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
        prefix: 'JADEPOOL_JOB_QUEUE',
        settings: _.clone(this._defaultQueueOpts)
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
   * @param {JobDef[]} tasks
   */
  async registerQueues (tasks = []) {
    // lockDuration
    // TODO
  }
  /**
   * 注册单个任务
   * @param {JobDef} task
   */
  async registerQueue (task) {
    await this.registerQueues([ task ])
  }

  /**
   * 运行任务
   */
  async startOrReloadJobs () {
    // TODO
  }

  /**
   * 正在running的jobs
   * @param {string} taskName
   */
  async runningJobs (taskName) {
    // TODO
  }

  async every (interval, name, data, options) {
    // TODO
  }
  async schedule (when, name, data) {
    // TODO
  }
  async now (name, data) {
    // TODO
  }
}

module.exports = Service
