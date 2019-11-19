const _ = require('lodash')
const assert = require('chai').assert
const { promisify } = require('util')
// set log level to avoid jadepool log
// process.env.LOGGER_LEVEL = 'WARN'
const { jadepool, consts, utils } = require('../../')

const config = {
  mongo: {
    default: 'mongodb://localhost:27017/jadepool-BN-dev',
    config: 'mongodb://localhost:27017/jadepool-cfg-dev'
  },
  redis: {
    default: 'redis://127.0.0.1:6379'
  }
}

function getMQSrv () {
  return jadepool.getService(consts.SERVICE_NAMES.MSG_QUEUE)
}

describe('Services: msg queue', () => {
  const MSG_KEY = 'TEST_MQ_KEY'
  const MSG_STREAM_KEY = 'TEST_MQ_KEY_STREAM'
  const MSG_UNIQUE_KEY = 'TEST_MQ_KEY_UNIQUE_IDS'
  const MSG_GROUP_1 = 'TestCaseGroup1'
  const MSG_GROUP_2 = 'TestCaseGroup2'

  before(async () => {
    await jadepool.initialize(new jadepool.Context(
      consts.SERVER_TYPES.UNKNOWN,
      '0.1.0',
      undefined,
      config
    ))
    await utils.redis.initialize()
    await jadepool.registerService(consts.SERVICE_NAMES.MSG_QUEUE)
  })
  after(async () => {
    const redisClient = utils.redis.fetchClient()
    redisClient.del(MSG_STREAM_KEY, MSG_UNIQUE_KEY)
  })

  describe('Add messages to STREAM', () => {
    const cases = [
      {
        category: 'NO uid',
        msgs: _.range(100).map(i => ({ id: i })),
        group: MSG_GROUP_1,
        added: 100
      },
      {
        category: 'With uid batch1',
        msgs: [
          { uid: '1', id: 1 },
          { uid: '2', id: 2 },
          { uid: '2', id: 2 }
        ],
        group: [MSG_GROUP_2].toString(),
        added: 102
      },
      {
        category: 'With uid batch2',
        msgs: [
          { uid: '1', id: 1 },
          { uid: '3', id: 3 }
        ],
        group: [MSG_GROUP_1, MSG_GROUP_2].toString(),
        added: 103
      }
    ]

    cases.forEach(item => {
      it(item.category, async () => {
        const srv = getMQSrv()
        await srv.addMessages(MSG_KEY, item.msgs, { group: item.group, maxLen: 1000 })

        const redisClient = utils.redis.fetchClient()
        const xlenAsync = promisify(redisClient.XLEN).bind(redisClient)
        const len = await xlenAsync(MSG_STREAM_KEY)
        assert.equal(len, item.added, 'stream should be ok.')
      })
    })
  }) // end add messages

  describe('Consume messages from STREAM', () => {
    const cases = [
      {
        group: MSG_GROUP_1,
        totalAmt: 101,
        concurrency: 5,
        consumeAmt: 10,
        pendingAmt: 5 * 10 / 2
      },
      {
        group: MSG_GROUP_2,
        totalAmt: 3,
        concurrency: 2,
        consumeAmt: 10,
        pendingAmt: 2
      }
    ]
    _.forEach(cases, item => {
      it(item.group, async () => {
        const srv = getMQSrv()
        const succeed = []
        const failure = []
        await Promise.all(_.map(_.range(item.concurrency), async i => {
          await srv.consumeMessages(MSG_KEY, item.group, data => {
            return parseInt(data.id) % 2 === 0
          }, {
            msgCount: item.consumeAmt,
            onSucceed: (result, msg) => succeed.push(msg),
            onFailure: (msg) => failure.push(msg)
          })
        }))
        const total = Math.min(item.concurrency * item.consumeAmt, item.totalAmt)
        const half = Math.floor(total / 2)
        assert.equal(succeed.length, half, 'hash result is ok')
        assert.equal(failure.length, total - half, 'hash result is failed')
        const redisClient = utils.redis.fetchClient()
        const xinfoAsync = promisify(redisClient.XINFO).bind(redisClient)
        const groups = await xinfoAsync('GROUPS', MSG_STREAM_KEY)
        const theGroup = groups.find(group => group[1] === item.group)
        assert.equal(theGroup[5], item.pendingAmt, 'pending amount should be same.')
      })
    })
  })
})
