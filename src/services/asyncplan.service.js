const _ = require('lodash')
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
    super(consts.SERVICE_NAMES.ASYNC_PLAN, services)
    // check required
    const agendaSrv = jadepool.getService(consts.SERVICE_NAMES.AGENDA)
    if (!agendaSrv) {
      throw new NBError(10001, `missing agenda service`)
    }
  }

  /**
   * 初始化
   * @param {Object} opts
   * @param {number} [opts.processEvery=30] 检测间隔
   */
  async initialize (opts) {
    const agendaSrv = jadepool.getService(consts.SERVICE_NAMES.AGENDA)
    const agendaNative = agendaSrv._agenda
    // 运行循环任务
    const taskName = 'async-plan-service-tick'
    agendaNative.define(taskName, { priority: 'high', concurrency: 1 }, async (job, done) => {
      try {
        await this._everyHandler()
      } catch (err) {
        logger.error(`unexpected`, err)
      }
      // 完成任务
      done()
    })
    const sec = opts.processEvery || 30
    await agendaNative.every(`${sec} seconds`, taskName)
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
  async _everyHandler () {
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
      plan.run_at = null
      plan.started_at = new Date()
      logger.tag('Started').log(`plan=${plan._id}`)
      await plan.save()
    }

    // Step.2 检测并执行老任务
    cursor = AsyncPlan.find({
      started_at: { $exists: true },
      status: { $exists: false },
      finished_at: { $exists: false }
    }).sort({ started_at: 1 }).cursor()
    while ((plan = await cursor.next()) !== null) {
      // 加载refer
      if (plan.refer) {
        await plan.populate('refer').execPopulate()
      }
      const updateObj = { $set: {} }
      let anyError = false // 是否存在错误
      if (plan.mode === consts.ASYNC_PLAN_MODES.PARALLEL) {
        // 并行任务
        const updates = await Promise.all(_.map(plan.plans, this._updatePlanData.bind(this, plan, plan.refer)))
        updateObj.$set = Object.assign({}, ...updates)
      } else {
        // 串行任务
        // Check last task
        const lastPlanData = plan.finished_steps > 0 ? plan.plans[plan.finished_steps - 1] : null
        if (lastPlanData && lastPlanData.finished_at) {
          anyError = !(await this._checkPlanSuccess(lastPlanData))
        }
        const currPlanData = plan.plans[plan.finished_steps]
        if (!anyError && currPlanData) {
          updateObj.$set = await this._updatePlanData(plan, plan.refer, currPlanData, plan.finished_steps)
        }
      }
      // 判断是否全局完成任务
      let finishedSteps = 0 // 已完成
      for (let i = 0; i < plan.plans.length; i++) {
        const planData = plan.plans[i]
        finishedSteps = finishedSteps + (!planData.finished_at ? 0 : 1)
        // 已完成
        if (planData.finished_at) {
          anyError = anyError || !(await this._checkPlanSuccess(planData))
        }
      }
      updateObj.$set.finished_steps = finishedSteps
      if (finishedSteps === plan.plans.length ||
        (plan.mode === consts.ASYNC_PLAN_MODES.SERIES && anyError)) {
        updateObj.$set.finished_at = new Date()
        const status = anyError ? consts.ASYNC_PLAN_STATUS.FAILED : consts.ASYNC_PLAN_STATUS.COMPLETED
        updateObj.$set.status = status
        logger.tag('Finished').log(`plan=${plan._id},status=${status}`)
      }
      // 保存订单
      await AsyncPlan.updateOne({ _id: plan._id }, updateObj).exec()
    } // end while
  }

  /**
   * 更新任务状态，返回mongo update对象
   * @param {AsyncPlan} plan
   * @param {AsyncPlan} refer
   * @param {any} planData
   * @param {number} idx
   */
  async _updatePlanData (plan, refer, planData, idx) {
    let update = {}
    // 没启动则需要启动
    if (!planData.started_at) {
      const methodValid = await jadepool.invokeMethodValid(planData.method, planData.namespace)
      // 仅该方法可用时进行调用
      if (methodValid) {
        update.started_at = new Date()
        logger.tag('one-exec').log(`plan=${plan._id},index=${idx},data=${JSON.stringify(planData)}`)
        Object.assign(update, await this._execNewPlan(planData, refer && refer.plans[idx]))
        // 更新本地数据
        Object.assign(planData, update)
      }
    }
    // 已启动需要检测是否完成
    if (planData.started_at && !planData.finished_at) {
      const isCompleted = await this._checkPlanFinished(planData)
      if (isCompleted) {
        logger.tag('one-finished').log(`plan=${plan._id},index=${idx}`)
        update.finished_at = new Date()
        // 更新本地数据
        Object.assign(planData, update)
      }
    }
    return _.mapKeys(update, (value, key) => `plans.${idx}.${key}`)
  }

  /**
   * 运行新任务
   * @param {object} planData 计划任务数据
   * @param {string} planData.category 类别
   * @param {string} planData.namespace 名字空间
   * @param {string} planData.method 方法名
   * @param {string} planData.params 方法参数
   */
  async _execNewPlan (planData, referPlanData) {
    // 检查referPlanData, 若成功则不需要再次执行
    if (referPlanData) {
      const isSuccess = await this._checkPlanSuccess(referPlanData)
      // 一次success最多3次自动重试
      if (isSuccess && referPlanData.fastRetries) {
        const result = _.pick(referPlanData, ['result', 'order', 'started_at', 'finished_at'])
        result.fastRetries = (referPlanData.fastRetries || 1) - 1
        return result
      }
    }
    // 执行method先
    let result
    let error
    try {
      result = await jadepool.invokeMethod(planData.method, planData.namespace, planData.params)
    } catch (err) {
      error = JSON.stringify({ code: err && err.code, message: err && err.message, response: err && err.response })
      logger.tag('failed-to-exec-plan').warn(error)
    }
    // Order任务记录订单
    let orderObjId
    if (planData.category === consts.ASYNC_PLAN_CATEGORY.INTERNAL_ORDER) {
      const Order = jadepool.getModel(consts.MODEL_NAMES.ORDER)
      // 可记录订单
      if (Order && result && result._id) {
        const order = await Order.findById(result._id).exec()
        orderObjId = order && order._id
      }
    }
    return {
      result: result && JSON.stringify(result),
      error,
      order: orderObjId
    }
  }

  /**
   * 运行新任务
   * @param {object} planData 计划任务数据
   * @param {string} planData.category 类别
   * @param {string} planData.result 结果
   * @param {string} planData.error 错误
   * @param {string} planData.order 订单_id
   */
  async _checkPlanFinished (planData) {
    // 普通plan，只要有结果就行了
    let isFinished = planData.result || planData.error
    if (planData.category === consts.ASYNC_PLAN_CATEGORY.INTERNAL_ORDER) {
      const Order = jadepool.getModel(consts.MODEL_NAMES.ORDER)
      if (Order && planData.order) {
        const order = await Order.findById(planData.order).exec()
        isFinished = isFinished && (order ? order.state === consts.ORDER_STATE.DONE || order.state === consts.ORDER_STATE.FAILED : false)
      } else {
        if (planData.error) {
          // 有error说明完成了额
          isFinished = true
        } else {
          // 没有order? 估计代码有问题hold住吧
          isFinished = false
        }
      }
    }
    return isFinished
  }
  /**
   * 运行新任务
   * @param {object} planData 计划任务数据
   * @param {string} planData.category 类别
   * @param {string} planData.result 结果
   * @param {string} planData.error 错误
   * @param {string} planData.order 订单_id
   */
  async _checkPlanSuccess (planData) {
    // 普通plan
    let isSucceed = planData.result && !planData.error
    if (planData.category === consts.ASYNC_PLAN_CATEGORY.INTERNAL_ORDER) {
      const Order = jadepool.getModel(consts.MODEL_NAMES.ORDER)
      if (Order && planData.order) {
        const order = await Order.findById(planData.order).exec()
        isSucceed = isSucceed && (order ? order.state === consts.ORDER_STATE.DONE : false)
      } else {
        isSucceed = false
      }
    }
    return isSucceed
  }
}

module.exports = Service
