const assert = require('chai').assert
const _ = require('lodash')
process.env.LOGGER_LEVEL = 'WARN'
const { jadepool, consts } = require('../..')

const invokeMethod = async function (method, namespace, params) {
  if (params.c) {
    throw new Error()
  }
  return method
}

describe('Services: consul', function () {
  const config = {}
  const name = 'test'
  const port = 1111
  before(async () => {
    await jadepool.initialize(new jadepool.Context(
      consts.SERVER_TYPES.UNKNOWN,
      '0.1.0',
      invokeMethod,
      config
    ))
    await jadepool.consulSrv.deregisterService(name)
  })
  after(async () => {
  })
  it('register service', async () => {
    await jadepool.consulSrv.registerService(name, port)
    const list = await jadepool.consulSrv.listServices(name)
    assert.equal(list[0].host, '127.0.0.1', 'host should be same')
    assert.equal(list[0].port, port, 'port should be same')
  })
  it('deregister service', async () => {
    await jadepool.consulSrv.deregisterService(name, port)
    const list = await jadepool.consulSrv.listServices(name)
    assert.isTrue(_.isEmpty(list), 'service list should be [] after deregister')
  })
})
