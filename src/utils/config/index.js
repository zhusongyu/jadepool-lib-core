const _ = require('lodash')
const NBError = require('../../NBError')
const consts = require('../../consts')
const jp = require('../../jadepool')

const applyIgnoreKeys = (types, jsonObj) => {
  let typeArr = types.split(',')
  typeArr = _.intersection(_.keys(jp.config.configMods), typeArr)
  typeArr.forEach(typeKey => {
    // 移除ignores
    _.forEach(jp.config.configMods[typeKey], key => _.unset(jsonObj, key))
  })
  return jsonObj
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

const fetchAllChainNames = () => {
  if (jp.env.server === consts.SERVER_TYPES.MAIN && jp.env.processType === consts.PROCESS.TYPES.BLOCKCHAIN) {
    return jp.env.param ? [ jp.env.param ] : []
  } else {
    return _.keys(jp.config.chain)
  }
}

/**
 * 根据denom获取CoinCfg
 * @param {string} denomOrName
 * @returns {{ name: string, Rate: number, TokenName: string }}
 */
const fetchCoinCfgById = (chainKey, tokenNameOrAssetIdOrContract) => {
  const cfgs = jp.config.coin[chainKey]
  if (!cfgs || !tokenNameOrAssetIdOrContract) return null
  return _.find(cfgs, cfg => {
    return cfg.name === tokenNameOrAssetIdOrContract ||
      cfg.TokenName === tokenNameOrAssetIdOrContract ||
      cfg.Contract === tokenNameOrAssetIdOrContract ||
      cfg.contract === tokenNameOrAssetIdOrContract ||
      cfg.assetId === tokenNameOrAssetIdOrContract
  })
}

const loadCoinCfg = async (chainKey, coinName) => {
  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  const chainDat = await ConfigDat.findOne({
    path: 'chain',
    key: chainKey,
    parent: { $exists: false }
  }).exec()
  if (!chainDat) return null
  const coinDat = await ConfigDat.findOne({
    path: 'tokens',
    key: coinName,
    parent: chainDat._id
  }).exec()
  if (!coinDat) return null
  return Object.assign(coinDat.toMerged(), {
    name: coinName
  })
}

/**
 * 获取实时的区块链配置
 * @param {string} chainKey
 */
const loadChainCfg = async (chainKey) => {
  if (typeof chainKey !== 'string') return chainKey
  // Config in DB
  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  const chainDat = await ConfigDat.findOne({
    path: 'chain',
    key: chainKey,
    parent: { $exists: false }
  }).exec()
  if (!chainDat) return null
  const chainCfg = chainDat.toMerged()
  // 设置额外参数
  chainCfg.id = String(chainDat._id)
  chainCfg.key = chainKey
  return chainCfg
}

/**
 * 获取实时的全部已启用区块链
 */
const loadAllChainNames = async (includeDisabled = false) => {
  // Config in DB
  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  const cfgs = (await ConfigDat.find({
    path: 'chain',
    key: { $ne: '' },
    parent: { $exists: false }
  }).exec()) || []
  return cfgs.filter(cfg => includeDisabled || !cfg.disabled).map(cfg => cfg.key)
}

// ------------------------ 已废弃方法 ------------------------
const fetchCoinCfg = () => { throw new NBError(10001, `unsupported method[fetchCoinCfg]`) }
const fetchAllCoinNames = () => { throw new NBError(10001, `unsupported method[fetchAllCoinNames]`) }
const loadAllCoinNames = () => { throw new NBError(10001, `unsupported method[loadAllCoinNames]`) }

module.exports = {
  applyIgnoreKeys,
  fetchCoinCfgById,
  fetchChainCfg,
  fetchAllChainNames,
  // 实时读取
  loadCoinCfg,
  loadChainCfg,
  loadAllChainNames,
  // 废弃方法
  fetchCoinCfg,
  fetchAllCoinNames,
  loadAllCoinNames
}
