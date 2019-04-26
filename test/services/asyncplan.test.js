const assert = require('chai').assert
const { jadepool, consts, utils } = require('../../')

const config = {
  mongo: {
    default: 'mongodb://localhost:27017/jadepool-BN-dev',
    config: 'mongodb://localhost:27017/jadepool-cfg-dev'
  }
}
const invokeMethod = async function (method, namespace, params) {
  if (params.c) {
    throw new Error()
  }
  return method
}
const waitSeconds = async function (sec) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, sec * 1000)
  })
}
describe('Services: async plan', function () {
  this.timeout(30000)
  let createPlans = []

  before(async () => {
    await jadepool.initialize(new jadepool.Context(
      consts.SERVER_TYPES.UNKNOWN,
      '0.1.0',
      invokeMethod,
      config
    ))
    await utils.db.initialize()
    await jadepool.registerService(consts.SERVICE_NAMES.AGENDA, { processEvery: 1 })
    await jadepool.registerService(consts.SERVICE_NAMES.ASYNC_PLAN, { processEvery: 1 })
  })
  after(async () => {
    const AsyncPlan = jadepool.getModel(consts.MODEL_NAMES.ASYNC_PLAN)
    await AsyncPlan.deleteMany({ _id: { $in: createPlans } })
  })

  it('can create plan', async () => {
    const methodName = 'testMethod'
    const plans = [{
      category: consts.ASYNC_PLAN_CATEGORY.EXECUTE_ACTION,
      method: methodName,
      namespace: null,
      params: { a: 1, b: 2 }
    }]
    let plan = await jadepool.createAsyncPlan(plans, consts.ASYNC_PLAN_MODES.SERIES, consts.ASYNC_PLAN_SOURCES.SYSTEM)
    assert.exists(plan, 'missing plan')
    createPlans.push(plan._id)
    const AsyncPlan = jadepool.getModel(consts.MODEL_NAMES.ASYNC_PLAN)
    let retries = 20
    while (retries-- > 0 && !plan.status) {
      await waitSeconds(1)
      plan = await AsyncPlan.findById(plan._id)
    }
    assert.equal(plan.status, consts.ASYNC_PLAN_STATUS.COMPLETED)
    assert.equal(plan.plans[0].result, JSON.stringify(methodName))
  })

  it('series plans can run', async () => {
    const methodName = 'testMethod'
    const plans = [{
      category: consts.ASYNC_PLAN_CATEGORY.EXECUTE_ACTION,
      method: methodName,
      namespace: null,
      params: { a: 1, b: 2 }
    }, {
      category: consts.ASYNC_PLAN_CATEGORY.EXECUTE_ACTION,
      method: methodName,
      namespace: null,
      params: { b: 1, c: 2 }
    }]
    let plan = await jadepool.createAsyncPlan(plans, consts.ASYNC_PLAN_MODES.SERIES, consts.ASYNC_PLAN_SOURCES.ADMIN, 'username')
    assert.exists(plan, 'missing plan')
    createPlans.push(plan._id)
    const AsyncPlan = jadepool.getModel(consts.MODEL_NAMES.ASYNC_PLAN)
    let retries = 20
    while (retries-- > 0 && !plan.status) {
      await waitSeconds(1)
      plan = await AsyncPlan.findById(plan._id)
    }
    assert.equal(plan.status, consts.ASYNC_PLAN_STATUS.FAILED)
    assert.equal(plan.plans[0].result, JSON.stringify(methodName))
    assert.exists(plan.plans[1].error)
  })

  it('parallel plans can run', async () => {
    const methodName = 'testMethod'
    const plans = [{
      category: consts.ASYNC_PLAN_CATEGORY.EXECUTE_ACTION,
      method: methodName,
      namespace: null,
      params: { a: 1, b: 2 }
    }, {
      category: consts.ASYNC_PLAN_CATEGORY.EXECUTE_ACTION,
      method: methodName,
      namespace: null,
      params: { b: 1, c: 2 }
    }]
    let plan = await jadepool.createAsyncPlan(plans, consts.ASYNC_PLAN_MODES.PARALLEL, consts.ASYNC_PLAN_SOURCES.APP, 'app')
    assert.exists(plan, 'missing plan')
    createPlans.push(plan._id)
    const AsyncPlan = jadepool.getModel(consts.MODEL_NAMES.ASYNC_PLAN)
    let retries = 20
    while (retries-- > 0 && !plan.status) {
      await waitSeconds(1)
      plan = await AsyncPlan.findById(plan._id)
    }
    assert.equal(plan.status, consts.ASYNC_PLAN_STATUS.FAILED)
    assert.equal(plan.plans[0].result, JSON.stringify(methodName))
    assert.exists(plan.plans[1].error)
  })
})
