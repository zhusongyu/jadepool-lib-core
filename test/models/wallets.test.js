const assert = require('chai').assert
const { jadepool, consts, utils } = require('../../')

const config = {
  mongo: {
    default: 'mongodb://localhost:27017/jadepool-BN-dev',
    config: 'mongodb://localhost:27017/jadepool-cfg-dev'
  }
}

const walletName = 'TestWallet'

before(async () => {
  await jadepool.initialize(new jadepool.Context(
    consts.SERVER_TYPES.UNKNOWN,
    '0.1.0',
    undefined,
    config
  ))
  await utils.db.initialize()
  // 设置mongoose参数
  utils.db.mongoose.set('useFindAndModify', false)
  utils.db.mongoose.set('useCreateIndex', true)

  const Wallet = jadepool.getModel(consts.MODEL_NAMES.WALLET)
  const wallet = new Wallet({
    name: walletName,
    desc: 'Jadepool wallet',
    addrIndex: 0,
    chains: []
  })
  await wallet.save()
})

after(async () => {
  const Wallet = jadepool.getModel(consts.MODEL_NAMES.WALLET)
  const WalletChain = jadepool.getModel(consts.MODEL_NAMES.WALLET_CHAIN)
  const WalletToken = jadepool.getModel(consts.MODEL_NAMES.WALLET_TOKEN)
  const doc = await Wallet.findOneAndDelete({ name: walletName }).exec()
  await WalletChain.deleteMany({ wallet: doc._id }).exec()
  await WalletToken.deleteMany({ wallet: doc._id }).exec()
})

describe('Models: wallets', function () {
  it('#getHotDerivativePath', async () => {
    const Wallet = jadepool.getModel(consts.MODEL_NAMES.WALLET)
    const wallet = await Wallet.findOne({ name: walletName }).exec()
    const path = wallet.getHotDerivativePath(0, 0)
    assert.equal(`m/44'/0'/${wallet.mainIndex * 100}'/1/0`, path)
  })
  it('#getAddressDerivativePath', async () => {
    const Wallet = jadepool.getModel(consts.MODEL_NAMES.WALLET)
    const wallet = await Wallet.findOne({ name: walletName }).exec()
    const path = wallet.getAddressDerivativePath(0, 0)
    assert.equal(`m/44'/0'/${wallet.mainIndex * 100}'/0/0`, path)
  })
  it('#updateFromConfig', async () => {
    const Wallet = jadepool.getModel(consts.MODEL_NAMES.WALLET)
    const wallet = await Wallet.findOne({ name: walletName }).exec()
    // 更新chaincfg
    const fileKeys = await utils.configLoader.loadConfigKeys('chain')
    const chains = (await Promise.all(fileKeys.map(async key => utils.configLoader.loadConfig('chain', key))))
      .filter(dat => !!dat)
      .map(item => item.toMerged())
    await wallet.updateFromConfig(chains)
    assert.equal(wallet.chains.length, chains.length, `chains added`)
  })
  it('#nextAddressIndex', async () => {
    const Wallet = jadepool.getModel(consts.MODEL_NAMES.WALLET)
    const wallet = await Wallet.findOne({ name: walletName }).exec()
    const newIdx = await wallet.nextAddressIndex()
    assert.equal(newIdx, 1)
  })
  it('#setChainStatus', async () => {
    const Wallet = jadepool.getModel(consts.MODEL_NAMES.WALLET)
    const wallet = await Wallet.findOne({ name: walletName }).exec()
    const testCases = [
      { chainKey: 'VeChain', coins: ['VET', 'VTHO'] },
      { chainKey: 'Cybex', coins: ['CYB'] },
      { chainKey: 'BTC', coins: ['BTC', 'USDT'] },
      { chainKey: 'ETH', coins: ['ETH'] }
    ]
    await Promise.all(testCases.map(async data => {
      await wallet.setChainStatus(data.chainKey, { enabled: true, coinsEnabled: data.coins })
    }))
    await wallet.populate('chains').execPopulate()
    testCases.forEach(test => {
      const chainData = wallet.chains.find(chain => chain.chainKey === test.chainKey)
      assert.exists(chainData)
      assert.deepEqual(chainData.status.coinsEnabled, test.coins)
    })
  })
  it('#setTokenStatus', async () => {
    const Wallet = jadepool.getModel(consts.MODEL_NAMES.WALLET)
    const wallet = await Wallet.findOne({ name: walletName }).exec()
    const testCases = [
      { chainKey: 'VeChain', coinName: 'VET', status: { depositDisabled: false, withdrawDisabled: true } },
      { chainKey: 'Cybex', coinName: 'CYB', status: { depositDisabled: true, withdrawDisabled: false } },
      { chainKey: 'BTC', coinName: 'VET', status: { depositDisabled: false, withdrawDisabled: true } },
      { chainKey: 'BTC', coinName: 'USDT', status: { depositDisabled: true, withdrawDisabled: false } },
      { chainKey: 'VeChain', coinName: 'VTHO', status: { depositDisabled: false, withdrawDisabled: false } },
      { chainKey: 'ETH', coinName: 'VET', status: { depositDisabled: true, withdrawDisabled: true } }
    ]
    await Promise.all(testCases.map(async data => {
      await wallet.setTokenStatus(data.chainKey, data.coinName, data.status)
    }))
    await wallet.populate('chains').execPopulate()
    for (const test of testCases) {
      const chainData = wallet.chains.find(chain => chain.chainKey === test.chainKey)
      assert.exists(chainData)
      await chainData.populate('coins').execPopulate()
      const coinData = chainData.coins.find(coin => coin.name === test.coinName)
      assert.exists(coinData)
      assert.deepEqual(coinData.status.toObject(), test.status)
    }
  })
  it('#setConfigMods', async () => {
    const Wallet = jadepool.getModel(consts.MODEL_NAMES.WALLET)
    const wallet = await Wallet.findOne({ name: walletName }).exec()

    const testCases = [
      { chainKey: 'VeChain', coinName: 'VET', config: { coin: { GasLimit: 20000 }, jadepool: { SweepTo: 10000 } } },
      { chainKey: 'Cybex', coinName: 'CYB', config: { coin: { Rate: 1e8 }, jadepool: { SweepTo: 10000 } } }
    ]
    await Promise.all(testCases.map(async data => {
      await wallet.setConfigMods(data.chainKey, data.coinName, data.config)
    }))
    await wallet.populate('chains').execPopulate()
    for (const test of testCases) {
      const chainData = wallet.chains.find(chain => chain.chainKey === test.chainKey)
      assert.exists(chainData)
      await chainData.populate('coins').execPopulate()
      const coinData = chainData.coins.find(coin => coin.name === test.coinName)
      assert.exists(coinData)
      assert.deepEqual(coinData.config.toObject(), test.config)
    }
  })
  it('#setSource', async () => {
    const Wallet = jadepool.getModel(consts.MODEL_NAMES.WALLET)
    const wallet = await Wallet.findOne({ name: walletName }).exec()
    const testCases = [
      { chainKey: 'VeChain', source: 'hot', type: consts.PRIVKEY_SOURCES.SEED_DB },
      { chainKey: 'VeChain', source: 'cold', type: consts.PRIVKEY_SOURCES.SEED },
      { chainKey: 'Cybex', source: 'hot', type: consts.PRIVKEY_SOURCES.HSM_PURE },
      { chainKey: 'BTC', source: 'cold', type: consts.PRIVKEY_SOURCES.HSM_DEEP },
      { chainKey: 'ETH', source: 'hot', type: consts.PRIVKEY_SOURCES.SEED }
    ]
    await Promise.all(testCases.map(async data => {
      await wallet.setSource(data.chainKey, data.source, data.type)
    }))
    await wallet.populate('chains').execPopulate()
    testCases.forEach(test => {
      const chainData = wallet.chains.find(chain => chain.chainKey === test.chainKey)
      assert.exists(chainData)
      assert.equal(chainData.source[test.source], test.type)
    })
  })
  it('#setSourceData', async () => {
    const Wallet = jadepool.getModel(consts.MODEL_NAMES.WALLET)
    const wallet = await Wallet.findOne({ name: walletName }).exec()
    const testCases = [
      { chainKey: 'VeChain', coinName: undefined, data: { a: 1 }, result: { a: 1 } },
      { chainKey: 'VeChain', coinName: 'VET', data: { b: 2 }, result: { a: 1, b: 2 } },
      { chainKey: 'VeChain', coinName: 'VET', data: { c: 2 }, result: { a: 1, b: 2, c: 2 } },
      { chainKey: 'Cybex', coinName: undefined, data: { c: 3 }, result: { c: 3 } },
      { chainKey: 'BTC', coinName: 'USDT', data: { d: 4 }, result: { d: 4 } }
    ]
    await Promise.all(testCases.map(async data => {
      await wallet.setSourceData(data.chainKey, data.coinName, data.data)
    }))
    for (const test of testCases) {
      const data = await wallet.getSourceData(test.chainKey, test.coinName)
      assert.exists(data)
      for (const key in test.result) {
        assert.equal(test.result[key], data[key])
      }
    }
  })
  it('#populateChainConfig', async () => {
    const Wallet = jadepool.getModel(consts.MODEL_NAMES.WALLET)
    const wallet = await Wallet.findOne({ name: walletName }).exec()
    const testCases = [
      { chainKey: 'VeChain' },
      { chainKey: 'BTC' }
    ]
    await Promise.all(testCases.map(async data => {
      await wallet.populateChainConfig(data.chainKey)
    }))
    for (const test of testCases) {
      const data = await wallet.getChainInfo(test.chainKey)
      assert.equal(data.chainKey, test.chainKey)
      assert.exists(data.config)
    }
  })
  it('#populateTokenConfig', async () => {
    const Wallet = jadepool.getModel(consts.MODEL_NAMES.WALLET)
    const wallet = await Wallet.findOne({ name: walletName }).exec()
    const testCases = [
      { chainKey: 'VeChain', coinName: 'VET' },
      { chainKey: 'BTC', coinName: 'BTC' },
      { chainKey: 'BTC', coinName: 'USDT' }
    ]
    await Promise.all(testCases.map(async data => {
      await wallet.populateTokenConfig(data.chainKey, data.coinName)
    }))
    for (const test of testCases) {
      let data = await wallet.getTokenInfoWithoutConfigDat(test.chainKey, test.coinName)
      assert.equal(data.name, test.coinName)
      data = await wallet.getTokenInfo(test.chainKey, test.coinName)
      assert.equal(data.name, test.coinName)
      assert.exists(data.config)
      assert.exists(data.shortcut)
    }
  })
})
