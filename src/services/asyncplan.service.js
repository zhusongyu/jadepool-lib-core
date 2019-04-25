const BaseService = require('./core')
const consts = require('../consts')
const NBError = require('../NBError')
const jadepool = require('../jadepool')

const logger = require('@jadepool/logger').of('Service', 'Async Plan')

class Service extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.CHILD_PROCESS, services)
    // check required
    const agendaSrv = jadepool.getService(consts.SERVICE_NAMES.AGENDA)
    if (!agendaSrv) {
      throw new NBError(10001, `missing agenda service`)
    }
  }

  /**
   * 初始化
   * @param {Object} opts
   */
  async initialize (opts) {
    const agendaSrv = jadepool.getService(consts.SERVICE_NAMES.AGENDA)
    const agendaNative = agendaSrv._agenda
    // 运行循环任务
    const taskName = 'async-plan-service-tick'
    agendaNative.define(taskName, { priority: 'high', concurrency: 1 }, async (job, done) => {
      try {
        await this.everyHandler()
      } catch (err) {
        logger.error(`unexpected`, err)
      }
      // 完成任务
      done()
    })
    await agendaNative.every('30 seconds', taskName)
  }

  /**
   * 该Service的优雅退出函数
   * @param signal 退出信号
   */
  async onDestroy (signal) {
    // NOTHING
  }

  /**
   * 运行时
   */
  async everyHandler () {
    const AsyncPlan = jadepool.getModel(consts.MODEL_NAMES.ASYNC_PLAN)
    let plan

    // Step.1 开启未开启的新任务
    let cursor = AsyncPlan.find({
      $and: [
        { run_at: { $exists: true } },
        { run_at: { $lte: new Date() } }
      ]
    }).cursor()
    while ((plan = await cursor.next()) !== null) {
      // plan.run_at = null
      // plan.started_at = new Date()
    }

    // Step.2 继续老任务
  }

  /**
   * 运行新任务
   * @param {object} planData 计划任务数据
   * @param {string} planData.category 类别
   * @param {string} planData.namespace 名字空间
   * @param {string} planData.method 方法名
   * @param {string} planData.params 方法参数
   */
  async runNewPlan (planData) {
    // 执行method先
    const result = await jadepool.invokeMethod(planData.method, planData.namespace, planData.paramsx)
    // 普通任务直接记录
    const ret = { result, order: undefined }
    // Order任务记录订单
    if (planData.category === consts.ASYNC_PLAN_CATEGORY.INTERNAL_ORDER) {
      const Order = jadepool.getModel(consts.MODEL_NAMES.ORDER)
      // 可记录订单
      if (Order && result._id) {
        const order = await Order.findById(result._id).exec()
        ret.order = order && order._id
      }
    }
    return ret
  }
}

module.exports = Service
