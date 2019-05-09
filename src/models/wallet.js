const _ = require('lodash')
const mongoose = require('mongoose')
const jp = require('../jadepool')
const consts = require('../consts')
const NBError = require('../NBError')
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
    {
      chainKey: { type: String, required: true }, // 区块链Key
      hotSource: { type: String, required: true, enum: _.values(consts.PRIVKEY_SOURCES), default: consts.PRIVKEY_SOURCES.SEED },
      coldSource: { type: String, required: true, enum: _.values(consts.PRIVKEY_SOURCES), default: consts.PRIVKEY_SOURCES.SEED },
      // 私钥源必选配置
      data: SourceData,
      /** 该区块链是否被禁用 */
      disabled: Boolean,
      /** 可用的coinNames */
      coinsEnabled: [ String ],
      // 钱包中的币种状态信息
      coins: [
        {
          name: { type: String, required: true }, // 币种简称, 唯一
          // 私钥源可选配置，将覆盖chain默认config
          data: SourceData,
          // 动态调整的配置
          config: {
            depositDisabled: Boolean,
            withdrawDisabled: Boolean,
            basic: Schema.Types.Mixed,
            jadepool: Schema.Types.Mixed
          }
        }
      ]
    }
  ] // end chains
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
 * set SourceType and data
 * @param {string} chainKey blockchain key
 * @param {object} walletDefaults 默认配置
 * @param {string} walletDefaults.hotSource hot wallet private key source
 * @param {string} walletDefaults.coldSource cold wallet private key source
 * @param {{seedKey?: string, hsmKey?: string}} walletDefaults.data source config
 * @param {any[]} walletDefaults.coins coins
 * @param {boolean} isSave save or not
 */
Wallet.prototype.setSources = async function (chainKey, walletDefaults, isSave = true) {
  // ensure sourceType available
  const eumTypes = _.values(consts.PRIVKEY_SOURCES)
  if (eumTypes.indexOf(walletDefaults.hotSource) === -1) throw new NBError(10002, `invalid parameter hotSource`)
  if (eumTypes.indexOf(walletDefaults.coldSource) === -1) throw new NBError(10002, `invalid parameter coldSource`)
  // build save object
  const dataToSave = Object.assign({ chainKey }, walletDefaults)
  const i = _.findIndex(this.chains || [], { chainKey })
  if (i === -1) {
    this.chains.push(dataToSave)
  } else {
    this.chains.set(i, dataToSave)
  }
  // 保存
  if (isSave) {
    await this.save()
  }
  return this
}

/**
 * set SourceData in exists chainData
 * @param {string} chainKey blockchain key
 * @param {string|undefined} coin specific coin scope or chain scope
 * @param {any} sourceData all data of private key source including caching data
 */
Wallet.prototype.setSourceData = async function (chainKey, coinName, sourceData) {
  const i = _.findIndex(this.chains || [], { chainKey })
  if (i === -1) throw new NBError(40410, `chain: ${chainKey}`)
  sourceData = sourceData || {}
  sourceData.cachedAt = new Date()
  let coinIdx = -1
  if (coinName !== undefined) {
    coinIdx = _.findIndex(this.chains[i].coins || [], c => c.name === coinName)
  }
  // set source data
  let pathKey = `chains.${i}`
  if (coinIdx !== -1) {
    pathKey += `.coins.${coinIdx}`
  }
  pathKey += '.data'
  // overrid latest
  this.set(pathKey, Object.assign({}, this.get(pathKey), sourceData))
  await this.save()
  return this
}

/**
 * 获取币种相关的钱包信息
 */
Wallet.prototype.getSourceData = function (chainKey, coinName) {
  const chainData = _.find(this.chains || [], { chainKey })
  if (!chainData) return null
  const coinData = _.find(chainKey.coins || [], c => c.name === coinName)
  return Object.assign({
    hotSource: chainData.hotSource,
    coldSource: chainData.coldSource
  }, chainData.data, coinData ? coinData.data : {})
}

/**
 * 获取区块链相关的配置信息
 */
Wallet.prototype.loadChainInfo = async function (chainKey) {
  const chainData = _.find(this.chains || [], { chainKey })
  if (!chainData) return null
  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  const chain = await ConfigDat.findOne({ path: 'chain', key: chainKey, parent: { $exists: false } }).exec()
  return {
    chainKey,
    disabled: chainData.disabled,
    hotSource: chainData.hotSource,
    coldSource: chainData.coldSource,
    coinsEnabled: chainData.coinsEnabled,
    data: _.clone(chainData.data),
    config: chain.toMerged()
  }
}

/**
 * 获取币种相关的配置信息
 */
Wallet.prototype.loadTokenInfo = async function (chainKey, coinName) {
  const chainData = _.find(this.chains || [], { chainKey })
  if (!chainData) return null
  const result = {
    name: coinName,
    data: _.clone(chainData.data)
  }
  const coinData = _.find(chainKey.coins || [], c => c.name === coinName)
  if (coinData) {
    result.data = Object.assign(result.data, coinData.data || {})
  }
  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  const chain = await ConfigDat.findOne({ path: 'chain', key: chainKey, parent: { $exists: false } }).exec()
  const token = await ConfigDat.findOne({ path: 'tokens', key: coinName, parent: chain._id }).exec()
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
