const assert = require('chai').assert
const { jadepool, consts, utils, Task } = require('../../')
const _ = require('lodash')
const logger = require('@jadepool/logger').of('Service', 'Test Job Queue')

const TestData = { name: 'send-email', subName: 'send-email', data: { a: 1 }, options: { jobId: 'uuid' } }

class TestClass extends Task {
  async onInit () {
    await utils.db.initialize()
  }

  async onHandle (job) {
    if (job) {
      let queueSrv = getJobQueueSrv()
      let queue = await queueSrv.fetchQueue(TestData.name)
      let jobContent = await queue.getJob(TestData.options.jobId)
      logger.info(`compare jobqueue to original data status: ${_.isEqual(TestData.data, jobContent.data)}`)
    }
  }
}

const config = {
  mongo: {
    default: 'mongodb://localhost:27017/jadepool-BN-dev',
    config: 'mongodb://localhost:27017/jadepool-cfg-dev'
  },
  redis: {
    default: 'redis://127.0.0.1:6379'
  }
}

function getJobQueueSrv () {
  return jadepool.getService(consts.SERVICE_NAMES.JOB_QUEUE)
}

describe('Services: jobqueue', function () {
  this.timeout(30000)

  before(async () => {
    await jadepool.initialize(new jadepool.Context(
      consts.SERVER_TYPES.API,
      '0.1.0',
      undefined,
      config
    ))
    await utils.redis.initialize()
    await utils.db.initialize()
    await jadepool.registerService(consts.SERVICE_NAMES.JOB_QUEUE, { tasks: [] })
  })

  it('add a job to jobqueue', async () => {
    let obj = { name: 'test', data: { a: 1 }, options: { jobId: 'uuid' } }
    let queueSrv = getJobQueueSrv()
    await queueSrv.add(obj)
    let queue = await queueSrv.fetchQueue(obj.name)
    let job = await queue.getJob(obj.options.jobId)
    assert(_.isEqual(job.data, obj.data))
  })

  it('add a task to jobqueue', async () => {
    let testClass = new TestClass()
    let queueSrv = getJobQueueSrv()
    queueSrv.initialize({ name: 'send-email', tasks: [{ instance: testClass, name: 'send-email' }] })
    await queueSrv.add(TestData)
    let num = await queueSrv.runningJobs('send-email')
    assert(num === 1)
    let queue = await queueSrv.fetchQueue(TestData.name)
    let job = await queue.getJob(TestData.options.jobId)
    assert(_.isEqual(job.data, TestData.data))
  })
})
