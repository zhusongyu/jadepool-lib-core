const assert = require('chai').assert
process.env.LOGGER_LEVEL = 'WARN'
const { jadepool, consts, utils } = require('../..')
const config = {
  mongo: {
    default: 'mongodb://localhost:27017/jadepool-BN-dev',
    admin: 'mongodb://localhost:27017/jadepool-admin-dev',
    config: 'mongodb://localhost:27017/jadepool-cfg-dev'
  }
}

describe('Config', () => {
  before(async () => {
    await jadepool.initialize(new jadepool.Context(consts.SERVER_TYPES.UNKNOWN, '0.1.0', undefined, config))
  })

  it('loadCoinCfg', async () => {
    const coinCfg = await utils.config.loadCoinCfg('ETH', 'ETH')
    assert.equal(coinCfg.name, 'ETH')
    assert.equal(coinCfg.chain, 'Ethereum')
    assert.typeOf(coinCfg.tokenEnabled, 'boolean')
    assert.typeOf(coinCfg.depositWithdrawEnabled, 'boolean')
    assert.typeOf(coinCfg.basic, 'object')
    assert.typeOf(coinCfg.jadepool, 'object')
  })

  it('loadChainCfg', async () => {
    const chainCfg = await utils.config.loadChainCfg('ETH')
    console.log(chainCfg)
    assert.typeOf(chainCfg.id, 'string')
    assert.equal(chainCfg.key, 'ETH')
    assert.equal(chainCfg.Chain, 'Ethereum')
  })

  it('loadAllCoinNames', async () => {
    const coinNames = await utils.config.loadAllCoinNames()
    assert.isArray(coinNames)
  })

  it('loadAllChainNames', async () => {
    const chainNames = await utils.config.loadAllChainNames()
    assert.isArray(chainNames)
  })
})
