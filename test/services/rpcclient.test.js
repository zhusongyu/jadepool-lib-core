const assert = require('chai').assert
const express = require('express')
const bodyParser = require('body-parser')
process.env.LOGGER_LEVEL = 'WARN'
const { jadepool, consts, utils } = require('../../')

const config = {
  mongo: {
    default: 'mongodb://localhost:27017/jadepool-BN-dev',
    config: 'mongodb://localhost:27017/jadepool-cfg-dev'
  }
}
describe('Services: rpcclient', () => {
  let srv
  before(async () => {
    await jadepool.initialize(new jadepool.Context(
      consts.SERVER_TYPES.UNKNOWN,
      '0.1.0',
      undefined,
      config
    ))
    srv = await jadepool.registerService(consts.SERVICE_NAMES.JSONRPC)
  })

  describe('Mode: HTTP', () => {
    const httpPort = 9549
    const URL = `http://127.0.0.1:${httpPort}`
    let http
    before(() => {
      http = express()
      http.use(bodyParser.json())
      http.post('/', async (req, res) => {
        let resdata = {
          jsonrpc: '2.0',
          id: req.body.id
        }
        switch (req.body.method) {
          case 'same':
            resdata.result = req.body
            break
          case 'sig':
            let body = req.body
            let extra = body.extra
            delete body.extra
            let valid = await utils.crypto.verifyInternal(body, undefined, extra.sig, extra)
            resdata.result = { valid }
            break
          case 'test1':
            resdata.result = { foo: 1 }
            break
          case 'test2':
            resdata.error = { code: 110, meesage: 'test error' }
            break
          case 'test3':
            resdata.id = resdata.id + '1'
            break
        }
        res.json(resdata)
      })
      http.listen(httpPort)
    })

    it('can send rpc method', async () => {
      const result = await srv.requestJSONRPC(URL, 'test1', { foo: 'bar' })
      assert(result.foo === 1, `result should be exists`)
    })

    it('can send rpc method with same response of request', async () => {
      const result = await srv.requestJSONRPC(URL, 'same', { foo: 'bar' })
      assert(result.jsonrpc === '2.0', `jsonrpc should be 2.0`)
      assert(typeof result.id === 'string', `id should be string`)
      assert(result.params.foo === 'bar', `params should be exist`)
      assert(result.method === 'same', `method should be exist`)
      assert(result.extra && typeof result.extra.sig === 'string', `extra should be exist`)
    })

    it('can send rpc method with validated extra', async () => {
      const result = await srv.requestJSONRPC(URL, 'sig', { foo: 'bar' })
      assert(result.valid, `extra should be validated`)
    })

    it('can send rpc method with error', async () => {
      let result
      let error
      try {
        result = await srv.requestJSONRPC(URL, 'test2', { foo: 'bar' })
      } catch (err) {
        error = err
      }
      assert(result === undefined, `result should be not exist`)
      assert(error && error.code === 110, `error should be exists`)
    })

    it('can send rpc method with id error', async () => {
      let result
      let error
      try {
        result = await srv.requestJSONRPC(URL, 'test3', { foo: 'bar' })
      } catch (err) {
        error = err
      }
      assert(result === undefined, `result should be not exist`)
      assert(error && error.code === 21011, `error should be exists`)
    })
  })
})
