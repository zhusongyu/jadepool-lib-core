const NBError = require('../../NBError')
const consts = require('../../consts')
const jp = require('../../jadepool')

const loadCoinCfg = async (chainKey, coinName) => {
  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  let chainDat
  if (typeof chainKey !== 'string' && typeof chainKey.toMerged === 'function') {
    chainDat = chainKey
  } else {
    chainDat = await ConfigDat.findOne({
      path: 'chain',
      key: chainKey,
      parent: { $exists: false }
    }).exec()
  }
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
/**
 * 获取实时的可用coinNames
 * @param {string} chainKey
 */
const loadAllCoinNames = async (chainKey, includeDisabled = false) => {
  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  let chainDat
  if (typeof chainKey !== 'string' && typeof chainKey.toMerged === 'function') {
    chainDat = chainKey
  } else {
    chainDat = await ConfigDat.findOne({
      path: 'chain',
      key: chainKey,
      parent: { $exists: false }
    }).exec()
  }
  if (!chainDat) return []
  const cfgs = (await ConfigDat.find({
    path: 'tokens',
    key: { $nin: ['', '_'] },
    parent: chainDat._id
  }).exec()) || []
  return cfgs.filter(cfg => includeDisabled || !cfg.disabled).map(cfg => cfg.key)
}

// ------------------------ 已废弃方法 ------------------------
const deprecatedMethod = function (methodName) {
  return () => { throw new NBError(10001, `unsupported method[${methodName}]`) }
}

module.exports = {
  // 实时读取
  loadCoinCfg,
  loadChainCfg,
  loadAllCoinNames,
  loadAllChainNames,
  // 废弃方法
  fetchCoinCfg: deprecatedMethod('fetchCoinCfg'),
  fetchAllCoinNames: deprecatedMethod('fetchAllCoinNames'),
  fetchCoinCfgById: deprecatedMethod('fetchCoinCfgById'),
  fetchChainCfg: deprecatedMethod('fetchChainCfg'),
  fetchAllChainNames: deprecatedMethod('fetchAllChainNames')
}
