const _ = require('lodash')
const config = require('config')
const NBError = require('../NBError')
const consts = require('../../consts')
const jp = require('../../jadepool')

const fetchCallbackUrl = (category, customUrl) => {
  let url = _.get(config, `callback.${category}`)
  let debugUrl = _.get(config, `callback.debug`)
  url = (url || customUrl) || debugUrl
  return url
}

const applyIgnoreKeys = (types, jsonObj) => {
  let typeArr = types.split(',')
  typeArr = _.intersection(_.keys(config.configMods), typeArr)
  typeArr.forEach(typeKey => {
    // 移除ignores
    _.forEach(config.configMods[typeKey], key => _.unset(jsonObj, key))
  })
  return jsonObj
}

const _coinCfgCache = new Map()
const _chainCfgCache = new Map()

const fetchCoinCfg = (coinName, useCached = false) => {
  const parsedCfg = _.find(config.coins, { name: coinName })
  if (!parsedCfg) {
    throw new NBError(20000, `coin: ${coinName}`)
  }
  if (!useCached || !_coinCfgCache.has(coinName)) {
    const basicCfg = _.assign({}, ..._.map(parsedCfg.coinCfgPath, path => _.get(config, path)))
    const result = {
      name: coinName,
      chain: parsedCfg.chain,
      chainKey: parsedCfg.chainKey,
      rate: basicCfg.Rate,
      disabled: basicCfg.disabled,
      basic: basicCfg,
      jadepool: _.assign({}, ..._.map(parsedCfg.jpCfgPath, path => _.get(config, path)))
    }
    _coinCfgCache.set(coinName, result)
  }
  return _coinCfgCache.get(coinName)
}

const fetchChainCfg = (nameOrKeyOrCoreType) => {
  if (!_chainCfgCache.has(nameOrKeyOrCoreType)) {
    let chainCfg = _.find(config.chain, { Chain: nameOrKeyOrCoreType })
    if (!chainCfg) {
      chainCfg = _.find(config.chain, { key: nameOrKeyOrCoreType })
    }
    if (!chainCfg) {
      chainCfg = _.find(config.chain, { CoreType: nameOrKeyOrCoreType })
    }
    if (!chainCfg) {
      return null
    }
    _chainCfgCache.set(nameOrKeyOrCoreType, chainCfg)
  }
  return _chainCfgCache.get(nameOrKeyOrCoreType)
}

const fetchAllCoinNames = (chainKey) => {
  const allChains = !chainKey ? fetchAllChainNames() : [ chainKey ]
  return _.reduce(allChains, (allCoins, chainKey) => {
    return _.concat(allCoins, _.map(_.filter(config.coins, { Chain: fetchChainCfg(chainKey).Chain }), 'name'))
  }, [])
}

const fetchAllChainNames = () => {
  switch (jp.env.processType) {
    case consts.PROCESS.TYPES.BLOCKCHAIN: return jp.env.param ? [ jp.env.param ] : []
    case consts.PROCESS.TYPES.ROUTER: return _.keys(config.chain)
    default: return []
  }
}

module.exports = {
  applyIgnoreKeys,
  fetchCallbackUrl,
  fetchCoinCfg,
  fetchChainCfg,
  fetchAllCoinNames,
  fetchAllChainNames
}
