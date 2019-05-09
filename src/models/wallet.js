const _ = require('lodash')
const mongoose = require('mongoose')
const jp = require('../jadepool')
const consts = require('../consts')
const NBError = require('../NBError')
const cfgloader = require('../utils/config/loader')
const { fetchConnection, AutoIncrement } = require('../utils/db')
const Schema = mongoose.Schema

const SourceData = new Schema({
  /** 当source为seed时，需要设置 */
  seedKey: String,
  /** 当source为hsm时，需要设置 */
  hsmKey: String,
  // 缓存，可供比较变化，最后一次设置进去
  hotAddress: String,
  coldAddress: String,
  cachedAt: Date
})

const CoinData = new Schema({
  name: { type: String, required: true }, // 币种简称, 区块链唯一
  // 私钥源可选配置，将覆盖chain默认config
  data: SourceData,
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

const ChainData = new Schema({
  chainKey: { type: String, required: true }, // 区块链Key
  // 私钥源
  source: {
    hot: { type: String, required: true, enum: _.values(consts.PRIVKEY_SOURCES), default: consts.PRIVKEY_SOURCES.SEED },
    cold: { type: String, required: true, enum: _.values(consts.PRIVKEY_SOURCES), default: consts.PRIVKEY_SOURCES.SEED }
  },
  // 必选配置
  data: SourceData,
  // 状态配置
  status: {
    /** 该区块链是否被禁用 */
    enabled: { type: Boolean, default: true },
    /** 可用的coinNames */
    coinsEnabled: [ String ]
  },
  // 钱包中的币种状态信息
  coins: [ CoinData ]
})

const schema = new Schema({
  name: { type: String, required: true, unique: true }, // 钱包的唯一名称
  desc: String, // 钱包描述，辅助信息
  version: String, // default wallet可设置版本，自动更新也将按照版本号来
  // 核心信息
  mainIndex: { type: Number, required: true, default: 0, min: 0 },
  // 充值地址衍生路径为 m/44'/{chainIndex}'/{mainIndex}'/0/{addressIndex}
  addrIndex: { type: Number, required: true, default: 0, min: 0 },
  // 钱包中的区块链状态信息
  chains: [ ChainData ] // end chains
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
 * set data with defaults
 * @param {string} chainKey blockchain key
 * @param {object} walletData 默认配置
 * @param {boolean} isSave save or not
 */
Wallet.prototype.updateWalletData = async function (chainKey, walletData, isSave = true) {
  // ensure sourceType available
  const eumTypes = _.values(consts.PRIVKEY_SOURCES)
  const hotSource = [_.get(walletData, 'source.hot')].filter(v => eumTypes.indexOf(v) !== -1)[0]
  const coldSource = [_.get(walletData, 'source.cold')].filter(v => eumTypes.indexOf(v) !== -1)[0]
  // build save object
  const i = _.findIndex(this.chains || [], { chainKey })
  if (i === -1) {
    this.chains.push({
      chainKey,
      source: {
        hot: hotSource || consts.PRIVKEY_SOURCES.SEED,
        cold: coldSource || consts.PRIVKEY_SOURCES.SEED
      },
      data: walletData.data,
      status: {
        enabled: true,
        coinsEnabled: walletData.coinsEnabled || []
      },
      coins: walletData.coins || []
    })
  } else {
    const objToSave = _.clone(this.chains[i])
    if (hotSource) _.set(objToSave, 'source.hot', hotSource)
    if (coldSource) _.set(objToSave, 'source.cold', coldSource)
    if (walletData.data) _.set(objToSave, 'data', walletData.data)
    _.forEach(walletData.coins || [], defaultsCoinData => {
      const saveCoinData = _.find(objToSave.coins || [], { name: defaultsCoinData.name })
      if (saveCoinData) {
        saveCoinData.data = defaultsCoinData.data
      }
    })
    this.chains.set(i, objToSave)
  }
  // 保存
  if (isSave) {
    await this.save()
  }
  return this
}

/**
 * set any data
 * @param {string} chainKey blockchain key
 * @param {string} coinName coin unique name
 * @param {string} field
 * @param {object} data
 * @param {boolean} isSave
 */
Wallet.prototype.setAnyData = async function (chainKey, coinName, field, data) {
  const i = _.findIndex(this.chains || [], { chainKey })
  if (i === -1) throw new NBError(40410, `chain: ${chainKey}`)
  if (coinName !== undefined) {
    const chainData = this.chains[i]
    let coinIdx = -1
    coinIdx = _.findIndex(chainData.coins || [], c => c.name === coinName)
    if (coinIdx !== -1) {
      const pathKey = `chains.${i}.coins.${coinIdx}.${field}`
      this.set(pathKey, Object.assign({}, this.get(pathKey), data))
    } else {
      chainData.coins.push({ name: coinName, [field]: data })
    }
  } else {
    const pathKey = `chains.${i}.${field}`
    this.set(pathKey, Object.assign({}, this.get(pathKey), data))
  }
  // save to db
  await this.save()
  return this
}

/**
 * set chain's enabled coins
 * @param {string} chainKey blockchain key
 * @param {object} status 状态配置
 */
Wallet.prototype.setChainStatus = async function (chainKey, status) {
  return this.setAnyData(chainKey, undefined, 'status', status)
}
/**
 * set token enabled status
 * @param {string} chainKey blockchain key
 * @param {string} coinName coin unique name
 * @param {object} status 状态配置
 */
Wallet.prototype.setTokenStatus = async function (chainKey, coinName, status) {
  return this.setAnyData(chainKey, coinName, 'status', status)
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
  return this.setAnyData(chainKey, coinName, 'data', sourceData)
}

/**
 * 获取币种相关的钱包信息
 */
Wallet.prototype.getSourceData = function (chainKey, coinName) {
  const chainData = _.find(this.chains || [], { chainKey })
  if (!chainData) return null
  const coinData = _.find(chainKey.coins || [], c => c.name === coinName)
  return Object.assign({
    source: chainData.source
  }, chainData.data, coinData ? coinData.data : {})
}

/**
 * 获取区块链相关的配置信息
 */
Wallet.prototype.loadChainInfo = async function (chainKey) {
  const chainData = _.find(this.chains || [], { chainKey })
  if (!chainData) return null
  const chain = await cfgloader.loadConfig('chain', chainKey)
  return Object.assign({
    config: Object.assign({
      id: chain._id,
      key: chainKey
    }, chain.toMerged())
  }, _.pick(chainData, ['chainKey', 'source', 'data', 'status']))
}

/**
 * 获取币种相关的配置信息
 */
Wallet.prototype.loadTokenInfo = async function (chainKey, coinName) {
  const chainData = _.find(this.chains || [], { chainKey })
  if (!chainData) return null
  const result = {
    name: coinName,
    data: _.clone(chainData.data),
    status: {}
  }
  const coinData = _.find(chainKey.coins || [], c => c.name === coinName)
  if (coinData) {
    result.data = Object.assign(result.data, coinData.data || {})
    result.status = _.clone(coinData.status || {})
  }
  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  const chain = await cfgloader.loadConfig('chain', chainKey)
  const token = await cfgloader.loadConfig('tokens', coinName, chain)
  if (!chain || !token) return null
  let cfg = ConfigDat.mergeConfigObj(token.toMerged(), coinData && coinData.config ? coinData.config : {})
  // 通过全局条件修改config
  if (jp.config.configWatchers) {
    _.forEach(jp.config.configWatchers, watcherCfg => {
      if (['coin', 'jadepool'].indexOf(watcherCfg.path) === -1) return
      const targetObj = cfg[watcherCfg.path]
      // 找到需要修改的目标
      if (typeof watcherCfg.where === 'string' && coinName !== watcherCfg.where) return
      if (typeof watcherCfg.where === 'object' && watcherCfg.where !== null && _.filter([targetObj], watcherCfg.where).length === 0) return
      // 根据conds进行参数修改
      _.forIn(watcherCfg.cond, (valueArr, key) => {
        const method = valueArr[0]
        if (!method) return
        if (targetObj[key] === undefined) return
        if (method === '$min' && typeof targetObj[key] === 'number') {
          const compVal = typeof valueArr[1] === 'number' ? (valueArr[1] || 0)
            : (typeof valueArr[1] === 'string' ? _.get(targetObj, valueArr[1], 0) : 0)
          targetObj[key] = Math.max(targetObj[key], compVal)
        } else if (method === '$max' && typeof targetObj[key] === 'number') {
          const compVal = typeof valueArr[1] === 'number' ? (valueArr[1] || Number.MAX_VALUE)
            : (typeof valueArr[1] === 'string' ? _.get(targetObj, valueArr[1], Number.MAX_VALUE) : Number.MAX_VALUE)
          targetObj[key] = Math.min(targetObj[key], compVal)
        } else if (method === '$toLower' && typeof targetObj[key] === 'string') {
          targetObj[key] = _.toLower(targetObj[key])
        } else if (method === '$toUpper' && typeof targetObj[key] === 'string') {
          targetObj[key] = _.toUpper(targetObj[key])
        }
      }) // end conds forIn
    }) // end watchers
  }
  // 设置为最终config
  result.config = cfg
  // 设置shortcut
  const chainCfg = chain.toMerged()
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

module.exports = Wallet
