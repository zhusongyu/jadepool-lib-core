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

describe('Services: async plan', function () {
  this.timeout(30000)
  const createdIds = []

  before(async () => {
    await jadepool.initialize(new jadepool.Context(
      consts.SERVER_TYPES.UNKNOWN,
      '0.1.0',
      invokeMethod,
      config
    ))
    await utils.db.initialize()
  })
  after(async () => {
    const Activities = jadepool.getModel(consts.MODEL_NAMES.ACTIVITY)
    await Activities.deleteMany({ _id: { $in: createdIds } })
  })

  it('can create api logs', async () => {
    let activity = await jadepool.activitySrv.startApiLog('global', 'test', 'user', 'admin', { method: 'hello', params: [] })
    assert.equal(activity.category, consts.ACTIVITY_CATEGORY.API_INVOKE)
    assert.equal(activity.module, 'global')
    assert.equal(activity.name, 'test')
    assert.equal(activity.operator, 'user')
    assert.equal(activity.operator_role, 'admin')
    activity = await jadepool.activitySrv.pushActivityLogParams(activity._id, ['log1'])
    assert.sameMembers(activity.log_params, ['log1'])
    activity = await jadepool.activitySrv.finishApiLog(activity._id, { result: true }, ['end'])
    assert.exists(activity.output.record_at)
    assert.sameMembers(activity.log_params, ['log1', 'end'])
  })

  it('can create user activity', async () => {
    let activity = await jadepool.activitySrv.createUserActivity('global', 'test', 'user', 'admin', ['log1'])
    assert.equal(activity.category, consts.ACTIVITY_CATEGORY.USER)
    assert.sameMembers(activity.log_params, ['log1'])
  })

  it('can create system activity', async () => {
    let activity = await jadepool.activitySrv.createSystemActivity('global', 'test', 'BTC', ['log1'])
    assert.equal(activity.category, consts.ACTIVITY_CATEGORY.SYSTEM)
    assert.sameMembers(activity.log_params, ['log1'])
  })
})
