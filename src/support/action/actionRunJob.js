const BaseAction = require('./action')
const jadepool = require('../../jadepool')
const consts = require('../../consts')

const logger = require('@jadepool/logger').of('Action', 'RunJob')

class Action extends BaseAction {
  constructor (ctx) {
    super('run-job', ctx)
  }
  /**
   * @type {Context}
   */
  get ctx () { return this._ctx }
  /**
   * @type {string}
   */
  get jobName () { return this.ctx.get('jobName') }
  /**
   * @type {{uid: string}[]}
   */
  get msgs () { return this.ctx.get('msgs') }
  /**
   * @type {number}
   */
  get delay () { return this.ctx.get('jobDelay') || 0 }
  /**
   * @type {number}
   */
  get priority () { return this.ctx.get('jobPriority') || 10 }

  /**
   * 确保blackboard中存在以下字段：
   * - jobName 启动的任务名称
   * - msgs 待推送的消息
   */
  async doBeforeExec () {
    return typeof this.jobName === 'string' &&
      this.msgs && typeof this.msgs.length === 'number' && // ensure msgs exists
      !this.msgs.some(msg => typeof msg !== 'object' || typeof msg.uid !== 'string') // ensure msgs data
  }

  /**
   * blackboard 将更新以下字段：
   */
  async doExec () {
    const jobSrv = await jadepool.ensureService(consts.SERVICE_NAMES.JOB_QUEUE)

    /** 任务启动方法 */
    const len = this.msgs.length
    let cap = 25
    let i = 0
    while (i * cap < len) {
      const from = (i++) * cap
      const batched = this.msgs.slice(from, from + cap)
      await Promise.all(batched.map(async data => {
        const queue = await jobSrv.fetchQueue(this.jobName)
        const jobId = this.jobName + `@${data.uid}`
        const existJob = await queue.getJob(jobId)

        if (!existJob || existJob.isCompleted() || existJob.isFailed()) {
          await jobSrv.add({
            name: this.jobName,
            data,
            options: {
              jobId,
              delay: this.delay,
              priority: this.priority,
              removeOnComplete: true,
              removeOnFail: true
            }
          })
          logger.tag(this.jobName).debug(`id=${jobId},delay=${this.delay},priority=${this.priority},data=${JSON.stringify(data)}`)
        } // end if
      })) // end promise all
    } // end while
    return true
  }
}

Action.default = Action
module.exports = Action
