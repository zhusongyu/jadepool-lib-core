const assert = require('chai').assert
process.env.LOGGER_LEVEL = 'WARN'
const { jadepool, consts, utils } = require('../..')

const testUrlOk = 'https://www.baidu.com'
const testUrlFailed = 'http://www.dfsfa2fas.com'
const config = {
  chain: {
    'BTC': {
      key: 'BTC',
      node: [
        { name: 'BTC', TestNet: testUrlOk, MainNet: testUrlOk },
        { name: 'USDT', TestNet: testUrlOk, MainNet: testUrlOk }
      ]
    },
    'ETH': {
      key: 'ETH',
      node: [
        { name: 'ETH', TestNet: [testUrlOk], MainNet: [testUrlOk] }
      ]
    }
  }
}

describe('Utils: apiEndpoint', () => {
  before(async () => {
    await jadepool.initialize(new jadepool.Context(
      consts.SERVER_TYPES.UNKNOWN,
      '0.1.0',
      undefined,
      config
    ))
  })
  it('request Normal', async () => {
    const endpoint = utils.api.createApiEndpoint('test1', [testUrlOk])
    const data = await endpoint.get('')
    assert.isTrue(endpoint.connected)
    assert.isString(data)
  })
  it('request Index 2 ok', async () => {
    const endpoint = utils.api.createApiEndpoint('test2', [testUrlFailed, testUrlOk], { timeout: 2000 })
    const data = await endpoint.get('')
    assert.isTrue(endpoint.connected)
    assert.isString(data)
    assert.equal(endpoint.endpointUrl, testUrlOk)
  })
  it('request failed', async () => {
    const endpoint = utils.api.createApiEndpoint('test3', [testUrlFailed, testUrlFailed], { timeout: 1000 })
    try {
      await endpoint.get('')
    } catch (err) {
      assert.isNotEmpty(err)
    }
    assert.isFalse(endpoint.connected)
  })
  it('request With ChainKey 1', async () => {
    const endpoint = await utils.api.getChainNodeEndpoint('BTC')
    const data = await endpoint.get('')
    assert.isTrue(endpoint.connected)
    assert.isString(data)
  })
  it('request With ChainKey 2', async () => {
    const endpoint = await utils.api.getChainNodeEndpoint('BTC', 'USDT')
    const data = await endpoint.get('')
    assert.isTrue(endpoint.connected)
    assert.isString(data)
  })
  it('request With ChainKey 3', async () => {
    const endpoint = await utils.api.getChainNodeEndpoint('ETH')
    const data = await endpoint.get('')
    assert.isTrue(endpoint.connected)
    assert.isString(data)
  })
})
