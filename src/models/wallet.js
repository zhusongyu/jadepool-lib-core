const _ = require('lodash')
const semver = require('semver')
const mongoose = require('mongoose')
const jp = require('../jadepool')
const consts = require('../consts')
const NBError = require('../NBError')
const cfgloader = require('../utils/config/loader')
const { fetchConnection, AutoIncrement } = require('../utils/db')
const Schema = mongoose.Schema

const tokenDataSchema = new Schema({
  wallet: { // 指向钱包
    type: Schema.Types.ObjectId,
    ref: consts.MODEL_NAMES.WALLET
  },
  chainKey: { type: String, required: true }, // 区块链Key
  name: { type: String, required: true }, // 币种简称, 区块链唯一
  // 私钥源可选配置，将覆盖chain默认config
  data: Schema.Types.Mixed,
  // 状态配置
  status: {
    depositDisabled: { type: Boolean, default: false },
    withdrawDisabled: { type: Boolean, default: false }
  },
  // 动态调整的配置
  config: {
    coin: Schema.Types.Mixed,
    jadepool: Schema.Types.Mixed
  }
})
tokenDataSchema.index({ wallet: 1, chainKey: 1, name: 1 }, { name: 'tokenByWallet', unique: true })
// 定义Schema
const WalletToken = fetchConnection(consts.DB_KEYS.CONFIG).model(consts.MODEL_NAMES.WALLET_TOKEN, tokenDataSchema)

const walletChainSchema = new Schema({
  wallet: { // 指向钱包
    type: Schema.Types.ObjectId,
    ref: consts.MODEL_NAMES.WALLET
  },
  chainKey: { type: String, required: true }, // 区块链Key
  // 私钥源
  source: {
    hot: { type: String, required: true, enum: _.values(consts.PRIVKEY_SOURCES), default: consts.PRIVKEY_SOURCES.SEED },
    cold: { type: String, required: true, enum: _.values(consts.PRIVKEY_SOURCES), default: consts.PRIVKEY_SOURCES.SEED }
  },
  // 必选配置
  data: Schema.Types.Mixed,
  // 状态配置
  status: {
    /** 该区块链是否被禁用 */
    enabled: { type: Boolean, default: true },
    /** 可用的coinNames */
    coinsEnabled: [ String ]
  },
  // 钱包中的币种状态信息
  coins: [
    { type: Schema.Types.ObjectId, ref: consts.MODEL_NAMES.WALLET_TOKEN }
  ]
})
walletChainSchema.index({ wallet: 1, chainKey: 1 }, { name: 'chainKeyByWallet', unique: true })
// 定义Schema
const WalletChain = fetchConnection(consts.DB_KEYS.CONFIG).model(consts.MODEL_NAMES.WALLET_CHAIN, walletChainSchema)

const schema = new Schema({
  name: { type: String, required: true, unique: true }, // 钱包的唯一名称
  desc: String, // 钱包描述，辅助信息
  version: String, // default wallet可设置版本，自动更新也将按照版本号来
  // 核心信息
  mainIndex: { type: Number, required: true, default: 0, min: 0 },
  // 充值地址衍生路径为 m/44'/{chainIndex}'/{mainIndex}'/0/{addressIndex}
  addrIndex: { type: Number, required: true, default: 0, min: 0 },
  // 钱包中的区块链状态信息
  chains: [
    { type: Schema.Types.ObjectId, ref: consts.MODEL_NAMES.WALLET_CHAIN }
  ]
}, {
  timestamps: { createdAt: 'create_at', updatedAt: 'update_at' }
})

schema.plugin(AutoIncrement, { inc_field: 'mainIndex', id: 'wallet_counters' })

schema.index({ name: 1 }, { name: 'uniqueName', unique: true })

const Wallet = fetchConnection(consts.DB_KEYS.CONFIG).model(consts.MODEL_NAMES.WALLET, schema)

/**
 * 设置并获取下一个Address的index
 * @returns {number}
 */
Wallet.prototype.nextAddressIndex = async function () {
  const doc = await Wallet.findOneAndUpdate(
    { _id: this._id },
    { $inc: { addrIndex: 1 } },
    { new: true }
  ).exec()
  return doc ? doc.addrIndex : -1
}

/**
 * update from config
 * @param {{ key: string, disabled: boolean, WalletDefaults: Object }[]} chainDefaults
 */
Wallet.prototype.updateFromConfig = async function (chainDefaults) {
  // no need update
  if (this.version && semver.lte(jp.env.version, this.version)) return null
  // set all chains' data
  let ids = []
  for (const item of chainDefaults) {
    ids.push(await _ensureWalletChain(this._id, item.key, item.WalletDefaults, !item.disabled))
  }
  this.chains = ids
  this.version = jp.env.version
  // save wallet
  await this.save()
  return this
}

/**
 * set data with defaults
 * @param {string} chainKey blockchain key
 * @param {object} defaultData 默认配置
 * @param {boolean} enabled
 * @param {boolean} isSave save or not
 */
const _ensureWalletChain = async function (walletId, chainKey, defaultData, enabled) {
  // ensure sourceType available
  const eumTypes = _.values(consts.PRIVKEY_SOURCES)
  const hotSource = [_.get(defaultData, 'source.hot')].filter(v => eumTypes.indexOf(v) !== -1)[0]
  const coldSource = [_.get(defaultData, 'source.cold')].filter(v => eumTypes.indexOf(v) !== -1)[0]

  const query = { wallet: walletId, chainKey }
  let walletChain = await WalletChain.findOne(query).select('_id data').exec()
  // 设置数据
  const defaultSetObj = _.defaults(_.clone(defaultData || {}), { data: { seedKey: chainKey } })
  const updateObj = {
    $set: {
      data: walletChain ? _.defaults(_.clone(walletChain.data), defaultSetObj.data) : defaultSetObj.data
    },
    $setOnInsert: Object.assign({
      source: {
        hot: hotSource || consts.PRIVKEY_SOURCES.SEED,
        cold: coldSource || consts.PRIVKEY_SOURCES.SEED
      },
      status: {
        enabled: enabled,
        coinsEnabled: defaultSetObj.coinsEnabled || []
      }
    }, query)
  }
  // set coins docs
  const coins = defaultData.coins || []
  const coinDocIds = []
  for (const defaultsCoinData of coins) {
    if (!defaultsCoinData) continue
    const tokenQuery = { wallet: walletId, chainKey, name: defaultsCoinData.name }
    const oldOne = await WalletToken.findOne(tokenQuery).select('_id data').exec()
    const doc = await WalletToken.findOneAndUpdate(tokenQuery, {
      $set: {
        data: oldOne ? _.defaults(_.clone(oldOne.data), defaultsCoinData.data) : defaultsCoinData.data
      }
    }, { upsert: true, new: true }).select('_id').exec()
    coinDocIds.push(doc._id)
  }
  // add coins
  if (coinDocIds.length > 0) {
    updateObj.$addToSet = { coins: { $each: coinDocIds } }
  }
  const theDoc = await WalletChain.findOneAndUpdate(query, updateObj, { upsert: true, new: true }).select('_id').exec()
  return theDoc._id
}

const _setAnyData = async function (walletId, chainKey, coinName, field, data) {
  const baseQuery = { wallet: walletId, chainKey }
  const walletChain = await WalletToken.findOne(baseQuery).exec()
  let query = _.clone(baseQuery)
  let doc
  if (coinName !== undefined) {
    query.name = coinName
    doc = await WalletToken.findOne(query).exec()
  } else {
    doc = walletChain
  }
  const oldData = _.get(doc ? doc.toObject() : {}, field)
  const newData = _.isObject(oldData) ? Object.assign(oldData, data) : data
  if (coinName !== undefined) {
    const theDoc = await WalletToken.findOneAndUpdate(query, {
      $set: { [field]: newData }
    }, { upsert: true, new: true }).select('_id').exec()
    // 保证coins
    if (walletChain.coins.indexOf(theDoc._id) === -1) {
      await WalletChain.updateOne(baseQuery, {
        $addToSet: { coins: theDoc._id }
      }).exec()
    }
  } else {
    await WalletChain.updateOne(baseQuery, {
      $set: { [field]: newData }
    }).exec()
  }
}

/**
 * set chain's enabled coins
 * @param {string} chainKey blockchain key
 * @param {object} status 状态配置
 */
Wallet.prototype.setChainStatus = async function (chainKey, status) {
  await _setAnyData(this._id, chainKey, undefined, 'status', status)
  return this
}
/**
 * set token enabled status
 * @param {string} chainKey blockchain key
 * @param {string} coinName coin unique name
 * @param {object} status 状态配置
 */
Wallet.prototype.setTokenStatus = async function (chainKey, coinName, status) {
  await _setAnyData(this._id, chainKey, coinName, 'status', status)
  return this
}
/**
 * set token config mods
 */
Wallet.prototype.setConfigMods = async function (chainKey, coinName, mods) {
  await _setAnyData(this._id, chainKey, coinName, 'config', mods)
  return this
}
/**
 * set source
 */
Wallet.prototype.setSource = async function (chainKey, target, type) {
  if (target !== 'hot' && target !== 'cold') {
    throw new NBError(10002, `source target: ${target}`)
  }
  if (!_.includes(_.values(consts.PRIVKEY_SOURCES), type)) {
    throw new NBError(10002, `source type: ${type}`)
  }
  await _setAnyData(this._id, chainKey, undefined, `source.${target}`, type)
  return this
}
/**
 * set SourceData in exists chainData
 * @param {string} chainKey blockchain key
 * @param {string|undefined} coin specific coin scope or chain scope
 * @param {any} sourceData all data of private key source including caching data
 */
Wallet.prototype.setSourceData = async function (chainKey, coinName, sourceData) {
  sourceData = sourceData || {}
  sourceData.cachedAt = new Date()
  await _setAnyData(this._id, chainKey, coinName, 'data', sourceData)
  return this
}

/**
 * 获取币种相关的钱包信息
 */
Wallet.prototype.getSourceData = async function (chainKey, coinName) {
  const baseQuery = { wallet: this._id, chainKey }
  const walletChain = await WalletChain.findOne(baseQuery).exec()
  let data = walletChain ? _.clone(walletChain.data) : {}
  if (coinName !== undefined && coinName !== null) {
    const walletToken = await WalletToken.findOne(Object.assign({ name: coinName }, baseQuery)).exec()
    data = Object.assign(data, walletToken ? _.clone(walletToken.data) : {})
  }
  return data
}

/**
 * 加载区块链相关的配置信息
 */
Wallet.prototype.populateChainConfig = async function (chainKey) {
  if (!this.populatedCache) this.populatedCache = new Map()
  const walletKey = chainKey + '_wallet'
  const doc = await WalletChain.findOne({ wallet: this._id, chainKey }).exec()
  if (doc) {
    this.populatedCache.set(walletKey, doc.toObject())
  }
  const cfgKey = chainKey + '_config'
  const chain = await cfgloader.loadConfig('chain', chainKey)
  if (chain) {
    this.populatedCache.set(cfgKey, chain.toMerged())
  }
  return this
}

/**
 * 加载币种相关的配置信息
 */
Wallet.prototype.populateTokenConfig = async function (chainKey, coinName) {
  const cfgChainKey = chainKey + '_config'
  // load chainInfo first
  if (!this.populatedCache || !this.populatedCache.has(cfgChainKey)) {
    await this.populateChainConfig(chainKey)
  }
  const chain = this.populatedCache.get(cfgChainKey)
  if (chain) {
    const tokenWalletKey = `${chainKey}.${coinName}_wallet`
    const doc = await WalletToken.findOne({ wallet: this._id, chainKey, name: coinName })
    if (doc) this.populatedCache.set(tokenWalletKey, doc.toObject())

    const tokenCfgKey = `${chainKey}.${coinName}_config`
    const tokenDat = await cfgloader.loadConfig('tokens', coinName, { id: chain.id, path: 'chain', key: chain.key })
    if (tokenDat) this.populatedCache.set(tokenCfgKey, tokenDat.toMerged())
  }
  return this
}

/**
 * 获取区块链相关的配置信息
 */
Wallet.prototype.getChainInfo = function (chainKey) {
  if (!this.populatedCache) throw new NBError(10001, `missing populated cache`)
  const walletKey = chainKey + '_wallet'
  const cfgKey = chainKey + '_config'
  const chainData = this.populatedCache.get(walletKey)
  if (!chainData) throw new NBError(10001, `failed to find chain: ${chainKey}`)

  return Object.assign({}, chainData, {
    config: _.clone(this.populatedCache.get(cfgKey))
  })
}

Wallet.prototype._getTokenInfo = function (chainKey, coinName) {
  const walletKey = chainKey + '_wallet'
  const chainData = this.populatedCache.get(walletKey)
  if (!chainData) throw new NBError(10001, `failed to find chain: ${chainKey}`)

  const result = {
    name: coinName,
    data: _.clone(chainData.data),
    status: {}
  }
  const tokenWalletKey = `${chainKey}.${coinName}_wallet`
  const coinData = this.populatedCache.get(tokenWalletKey)
  if (coinData) {
    result.data = Object.assign(result.data, coinData.data ? _.clone(coinData.data) : {})
    result.status = coinData.status
    result.config = coinData.config
  }
  return result
}

/**
 * 获取币种相关基本信息
 */
Wallet.prototype.getTokenInfoWithoutConfigDat = function (chainKey, coinName) {
  if (!this.populatedCache) throw new NBError(10001, `missing populated cache`)
  return this._getTokenInfo(chainKey, coinName)
}

/**
 * 获取币种相关的配置信息
 */
Wallet.prototype.getTokenInfo = function (chainKey, coinName, withPatch = false) {
  if (!this.populatedCache) throw new NBError(10001, `missing populated cache`)
  const result = this._getTokenInfo(chainKey, coinName)

  const walletKey = chainKey + '_wallet'
  const cfgKey = chainKey + '_config'
  const tokenCfgKey = `${chainKey}.${coinName}_config`
  const chainData = this.populatedCache.get(walletKey)
  const chainCfg = this.populatedCache.get(cfgKey)
  const tokenCfg = this.populatedCache.get(tokenCfgKey)
  // 缺少配置则返回残缺版tokenInfo
  if (!chainCfg || !tokenCfg) throw new NBError(10001, `token config without population`)

  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  const cfg = ConfigDat.mergeConfigObj(_.clone(tokenCfg), result.config)
  // 打上老版的数据补丁
  if (withPatch) {
    const DerivativeRoot = this.getAddressDerivativePath(chainCfg.ChainIndex, 0, chainCfg.MainIndexOffset || 0)
    // coin对象上，打上补丁
    _.defaults(cfg.coin, {
      name: coinName,
      Chain: chainCfg.Chain,
      DerivativeRoot: DerivativeRoot.substring(0, DerivativeRoot.lastIndexOf('/0'))
    })
    // 为早期jadepool配置制作的补丁
    _.defaults(cfg.jadepool, {
      name: coinName,
      HotWallet: {
        DerivativePath: this.getHotDerivativePath(chainCfg.ChainIndex, 0, chainCfg.MainIndexOffset || 0),
        Source: chainData.source.hot,
        Mode: result.data.hotMode,
        Bin: result.data.hotBin,
        Address: result.data.hotAddress || ''
      },
      ColdWallet: {
        Source: chainData.source.cold,
        SeedKey: result.data.seedKey,
        HSMKey: result.data.hsmKey,
        Address: result.data.coldAddress || ''
      }
    })
  }
  // 设置为最终config
  result.config = cfg
  // 设置shortcut
  result.shortcut = {
    chainKey: chainKey,
    chain: chainCfg.Chain,
    coreType: chainCfg.CoreType,
    tokenEnabled: chainData.status.coinsEnabled.indexOf(coinName) !== -1,
    depositWithdrawEnabled: !result.status.withdrawDisabled && !result.status.depositDisabled,
    type: cfg.coin && cfg.coin.Type,
    rate: cfg.coin && cfg.coin.Rate
  }
  return result
}

/**
 * 获取热主地址的衍生路径
 * 衍生路径规则为 m/44'/{chainIndex}'/{accountIndex}'/1/{hotIndex}
 * @param {number} chainIndex 区块链Index
 * @param {number} [hotIndex=0] 热主地址的序号
 * @param {number} [accountOffset=0] 当该coin占用了相同的chainIndex，则需要使用offset来错开位置。取值范围为[0-99]
 * @returns {string}
 */
Wallet.prototype.getHotDerivativePath = function (chainIndex, hotIndex = 0, accountOffset = 0) {
  if (typeof chainIndex !== 'number' || typeof hotIndex !== 'number') throw new NBError(10002, `wrong parameters`)
  const accountIndex = this.mainIndex * 100 + accountOffset
  return `m/44'/${chainIndex}'/${accountIndex}'/1/${hotIndex}`
}

/**
 * 获取外部地址的衍生路径
 * 衍生路径规则为 m/44'/{chainIndex}'/{accountIndex}'/0/{addrIndex}
 * @param {number} chainIndex 区块链Index
 * @param {number} [addrIndex=undefined] 地址序号
 * @param {number} [accountOffset=0] 当该coin占用了相同的chainIndex，则需要使用offset来错开位置
 * @returns {string}
 */
Wallet.prototype.getAddressDerivativePath = function (chainIndex, addrIndex = undefined, accountOffset = 0) {
  addrIndex = addrIndex || this.addrIndex
  if (typeof chainIndex !== 'number' || typeof addrIndex !== 'number') throw new NBError(10002, `wrong parameters`)
  const accountIndex = this.mainIndex * 100 + accountOffset
  return `m/44'/${chainIndex}'/${accountIndex}'/0/${addrIndex}`
}

module.exports = {
  Wallet,
  WalletChain,
  WalletToken
}
