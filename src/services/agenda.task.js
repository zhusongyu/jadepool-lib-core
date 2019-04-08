const _ = require('lodash')
const jp = require('../jadepool')
const consts = require('../consts')

// 常量设置
const logger = require('@jadepool/logger').of('Task')

const waitForSeconds = (sec) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, sec * 1000)
  })
}

const sRunAmt = Symbol('runAmount')
const sHandlingAmt = Symbol('handlingAmount')
const sDestroying = Symbol('destroying')
const sTaskConfig = Symbol('taskConfig')

class Task {
  /**
   * @param {String} taskName
   */
  constructor (taskName) {
    Object.defineProperties(this, {
      'name': { value: taskName }
    })
    this._i = 0 // 部分task使用
    // 默认情况任务并发数为1
    this.opts = { concurrency: 1 }
    // 默认情况不做next重试
    this.nextInterval = null
    // 默认不记录Round
    this.recordRound = false
    // 辅助参数
    this[sRunAmt] = 0 // 该基类记录, 总运行的次数
    this[sHandlingAmt] = 0 // 该基类记录, 正在运行中的次数
    this[sTaskConfig] = null // 基类记录，任务配置信息
  }

  /**
   * Accessor
   */
  get agenda () { return jp.getService(consts.SERVICE_NAMES.AGENDA) }
  get isWorking () { return !this[sDestroying] }
  get round () { return this[sRunAmt] }
  get handlingAmt () { return this[sHandlingAmt] }
  get taskQuery () { return { server: jp.env.server, name: this.name } }
  get taskConfig () { return this[sTaskConfig] }

  /**
   * 任务初始化
   */
  async onInit () {
    await this.initialize()
    // 设置TaskConfig的working状态
    try {
      const TaskConfig = jp.getModel(consts.MODEL_NAMES.TASK_CONFIG)
      await TaskConfig.updateOne(this.taskQuery, { $set: { working: true } })
    } catch (err) {}
  }

  /**
   * 任务销毁方法
   */
  async onDestroy () {
    this[sDestroying] = true
    // 设置TaskConfig的working状态
    try {
      const TaskConfig = jp.getModel(consts.MODEL_NAMES.TASK_CONFIG)
      await TaskConfig.updateOne(this.taskQuery, { $set: { working: false } })
    } catch (err) {}
    // 等待退出
    if (this[sHandlingAmt] > 0) {
      logger.diff(`${this.name} Destroy`).tag('Begin').log(`name=${this.name},handling=${this[sHandlingAmt]}`)
      // 直到 handler 处理完成方可确认任务销毁÷÷÷
      while (this[sHandlingAmt] > 0) {
        logger.tag(`${this.name} Destroying`).log(`name=${this.name},handling=${this[sHandlingAmt]}`)
        await waitForSeconds(1)
      }
      logger.diff(`${this.name} Destroy`).tag('End').log(`name=${this.name}`)
    } else {
      logger.tag(`${this.name} Destroy`).log(`name=${this.name}`)
    }
  }

  /**
   * @param {Object} job
   */
  async onHandle (job, done) {
    if (this[sDestroying]) {
      return done()
    }
    const startTs = Date.now()
    if (this.recordRound) {
      logger.diff(this.name).tag('Start').log(`round=${this[sRunAmt]}`)
    }
    const TaskConfig = jp.getModel(consts.MODEL_NAMES.TASK_CONFIG)
    // 任务进行中
    this[sHandlingAmt]++
    // 获取当前task的相关配置信息
    const taskquery = this.taskQuery
    try {
      this[sTaskConfig] = await TaskConfig.findOne(taskquery).exec()
      if (!this[sTaskConfig]) {
        this[sTaskConfig] = new TaskConfig(taskquery)
        await this[sTaskConfig].save()
      }
      // 如果是循环任务，则记录循环任务时间
      if (this[sTaskConfig].jobtype !== consts.JOB_TYPES.NORMAL) {
        await TaskConfig.updateOne(this.taskQuery, {
          $set: {
            working: true,
            'data.lastRunAt': startTs
          }
        })
      }
    } catch (err) {
      logger.tag(this.name, 'fetchTaskConfig').error(null, err)
    }
    // 处理并运行job
    let errResult
    try {
      await this.handler(job)
    } catch (err) {
      errResult = err
      await this.handleError(job, err)
      // log日志
      logger.tag(this.name).error(`failed job is [${this.name}]`, err)
      // 尝试next
      this.next(job)
    }
    if (this.recordRound) {
      logger.diff(this.name).tag('End').log(`round=${this[sRunAmt]}`)
    }
    // 设置taskConfig数据
    if (this[sTaskConfig]) {
      try {
        const updateObj = {}
        const oldMaxDt = this[sTaskConfig].get('data.maxDeltaTime') || 0
        // 记录DeltaTime
        const endTs = Date.now()
        const deltaTime = (endTs - startTs) / 1000
        updateObj['data.lastDeltaTime'] = deltaTime
        updateObj['data.maxDeltaTime'] = Math.max(oldMaxDt, deltaTime)
        // 如果是循环任务，则记录循环任务时间
        if (this[sTaskConfig].jobtype !== consts.JOB_TYPES.NORMAL) {
          updateObj['data.lastFinishedAt'] = endTs
        }
        await TaskConfig.updateOne(taskquery, { $set: updateObj }).exec()
      } catch (err) {
        logger.tag(this.name, 'saveTaskConfig').error(null, err)
      }
      this[sTaskConfig] = null // 移除配置
    }
    // 记录总次数
    this[sRunAmt]++
    this[sHandlingAmt]--
    // 完成当前任务执行
    if (errResult) {
      done(errResult)
    } else {
      done()
    }
  }

  /**
   * 处理定制错误 NBError
   * @param {Job} job
   * @param {Error} err
   * @param {String} level ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING']
   */
  async handleError (job, err, level = 'WARNING') {
    const errCodeSrv = jp.getService(consts.SERVICE_NAMES.ERROR_CODE)
    // 处理定制错误 NBError
    if (errCodeSrv && err && typeof err.code === 'number') {
      const errDesc = errCodeSrv.getErrObj(err.code)
      // Warning记录
      if (errDesc) {
        const Warning = jp.getModel(consts.MODEL_NAMES.WARNING)
        const warn = new Warning()
        warn.level = level
        warn.category = errDesc.status
        let errMsg = err.message || ''
        if (errMsg) {
          const arr = _.map(errMsg.split(','), value => {
            const kv = value.split('=')
            return { key: kv[0], value: kv[1] }
          })
          const moduleKV = _.find(arr, { key: 'module' })
          if (moduleKV) {
            warn.module = moduleKV.value
          }
          errMsg = `(${errMsg})`
        }
        warn.message = `[${job.attrs.name}]` + (errDesc.category ? `[${errDesc.category}]` : '') + errDesc.message + errMsg
        await warn.save()
      }
    }
  }

  /**
   * 进行下一步Schedule
   * @param {Object} job
   */
  next (job) {
    if (!this.nextInterval) return
    job.schedule(this.nextInterval)
  }

  /** 重载函数区 */
  /**
   * Task 初始化函数
   */
  async initialize () {
    // 需要实现
  }
  /**
   * Task 处理函数
   */
  async handler (job) {
    throw new Error(`[${job.attrs.name}] handler need to be implemented!`)
  }
}

module.exports = Task
