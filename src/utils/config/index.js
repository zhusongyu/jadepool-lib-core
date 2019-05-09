const _ = require('lodash')
const NBError = require('../../NBError')
const consts = require('../../consts')
const jp = require('../../jadepool')
const { mongoose } = require('../db')

const applyIgnoreKeys = (types, jsonObj) => {
  let typeArr = types.split(',')
  typeArr = _.intersection(_.keys(jp.config.configMods), typeArr)
  typeArr.forEach(typeKey => {
    // 移除ignores
    _.forEach(jp.config.configMods[typeKey], key => _.unset(jsonObj, key))
  })
  return jsonObj
}

const _coinCfgCache = new Map()

const fetchCoinCfg = (coinName, useCached = false) => {
  const parsedCfg = _.find(jp.config.coins, { name: coinName })
  if (!parsedCfg) {
    throw new NBError(20000, `coin: ${coinName}`)
  }
  if (!useCached || !_coinCfgCache.has(coinName)) {
    const basicCfg = _.assign({}, ..._.map(parsedCfg.coinCfgPath, path => _.get(jp.config, path)))
    const result = {
      name: coinName,
      chain: parsedCfg.chain,
      chainKey: parsedCfg.chainKey,
      type: basicCfg.Type,
      rate: basicCfg.Rate,
      tokenEnabled: true,
      depositWithdrawEnabled: !basicCfg.disabled,
      basic: basicCfg,
      jadepool: _.assign({}, ..._.map(parsedCfg.jpCfgPath, path => _.get(jp.config, path))),
      /** @deprecated */
      disabled: basicCfg.disabled,
      /** @deprecated */
      enabled: !basicCfg.disabled
    }
    _coinCfgCache.set(coinName, result)
  }
  return _coinCfgCache.get(coinName)
}

const fetchChainCfg = (nameOrKeyOrCoreType) => {
  let chainCfg = _.find(jp.config.chain, { key: nameOrKeyOrCoreType })
  if (!chainCfg) {
    chainCfg = _.find(jp.config.chain, { Chain: nameOrKeyOrCoreType })
  }
  if (!chainCfg) {
    chainCfg = _.find(jp.config.chain, { CoreType: nameOrKeyOrCoreType })
  }
  return chainCfg
}

const fetchAllCoinNames = (chainKey) => {
  const allChains = !chainKey ? fetchAllChainNames() : [ chainKey ]
  return _.reduce(allChains, (allCoins, chainKey) => {
    return _.concat(allCoins, _.map(_.filter(jp.config.coins, { Chain: fetchChainCfg(chainKey).Chain }), 'name'))
  }, [])
}

const fetchAllChainNames = () => {
  if (jp.env.server === consts.SERVER_TYPES.MAIN && jp.env.processType === consts.PROCESS.TYPES.BLOCKCHAIN) {
    return jp.env.param ? [ jp.env.param ] : []
  } else {
    return _.keys(jp.config.chain)
  }
}

/**
 * 获取实时的币种配置
 * @param {string|object} chain
 * @param {string} coinName
 */
const loadCoinCfg = async (chain, coinName) => {
  if (coinName === undefined && typeof chain === 'string') {
    [ chain, coinName ] = chain.split('.')
  }
  const chainCfg = await loadChainCfg(chain)
  if (!chainCfg || !chainCfg.tokens) {
    throw new NBError(10001, `failed to load chain: ${chain}/${coinName}`)
  }
  // Config in DB
  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  const queryBase = { path: 'tokens', parent: mongoose.Types.ObjectId(chainCfg.id) }
  const coinDat = await ConfigDat.findOne(Object.assign({ key: coinName }, queryBase)).exec()
  if (!coinDat) {
    throw new NBError(20000, `coin: ${coinName}`)
  }
  const coinCfg = coinDat.toMerged()
  // 判断是否加载基础类
  if (chainCfg.tokens.build.extends) {
    const baseCoinDat = await ConfigDat.findOne(Object.assign({ key: chainCfg.tokens.build.base }, queryBase)).exec()
    if (baseCoinDat) {
      const baseCoinCfg = baseCoinDat.toMerged()
      coinCfg.coin = _.merge({}, baseCoinCfg.coin, coinCfg.coin)
      coinCfg.jadepool = _.merge({}, baseCoinCfg.jadepool, coinCfg.jadepool)
    }
  }
  // 构造 result
  return {
    name: coinName,
    chain: chainCfg.Chain,
    chainKey: chainCfg.key,
    // 状态标记
    tokenEnabled: chainCfg.tokens.enabled.indexOf(coinName) !== -1,
    depositWithdrawEnabled: !coinCfg.coin.disabled,
    // Coin数据
    basic: coinCfg.coin,
    type: coinCfg.coin.Type,
    rate: coinCfg.coin.Rate,
    // Jadepool数据
    jadepool: coinCfg.jadepool
  }
}

/**
 * 获取实时的区块链配置
 * @param {string} chainKey
 */
const loadChainCfg = async (chainKey) => {
  if (typeof chainKey !== 'string') return chainKey
  // Config in DB
  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  const query = { path: 'chain', key: chainKey }
  const chainDat = await ConfigDat.findOne(query).exec()
  if (!chainDat) return null
  const chainCfg = chainDat.toMerged()
  // 设置额外参数
  chainCfg.id = String(chainDat._id)
  chainCfg.key = chainKey
  // 设置tokens配置
  const tokensDat = await ConfigDat.findOne({ path: 'tokens', key: '', parent: chainDat }).exec()
  if (tokensDat) {
    chainCfg.tokens = tokensDat.toMerged()
  }
  return chainCfg
}

/**
 * 获取实时的全部已启用的币种名称
 * @param {string} [chainKey=undefined]
 */
const loadAllCoinNames = async (chainKey) => {
  // Config in DB
  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  const query = {
    path: 'chain',
    key: typeof chainKey === 'string' ? chainKey : { $ne: '' }
  }
  const cfgs = (await ConfigDat.find(query).exec()) || []
  const enabledChains = cfgs.filter(cfg => !cfg.disabled)
  const coinNamesArr = await Promise.all(enabledChains.map(async (chainDat) => {
    const tokensDat = await ConfigDat.findOne({ path: 'tokens', key: '', parent: chainDat }).exec()
    if (!tokensDat) return []
    const tokensCfg = tokensDat.toMerged()
    return (tokensCfg.enabled || []).map(name => `${chainDat.key}.${name}`)
  }))
  return _.flatten(coinNamesArr)
}

/**
 * 获取实时的全部已启用区块链
 */
const loadAllChainNames = async () => {
  // Config in DB
  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)

  const query = { path: 'chain', key: { $ne: '' } }
  const cfgs = (await ConfigDat.find(query).exec()) || []
  return cfgs.filter(cfg => !cfg.disabled).map(cfg => cfg.key)
}

module.exports = {
  applyIgnoreKeys,
  fetchCoinCfg,
  fetchChainCfg,
  fetchAllCoinNames,
  fetchAllChainNames,
  // 实时读取
  loadCoinCfg,
  loadChainCfg,
  loadAllCoinNames,
  loadAllChainNames
}
