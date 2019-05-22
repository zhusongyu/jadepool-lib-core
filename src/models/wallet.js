const _ = require('lodash')
const semver = require('semver')
const mongoose = require('mongoose')
const jp = require('../jadepool')
const consts = require('../consts')
const NBError = require('../NBError')
const cfgloader = require('../utils/config/loader')
const { fetchConnection, AutoIncrement } = require('../utils/db')
const Schema = mongoose.Schema

const CoinData = new Schema({
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

const ChainData = new Schema({
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
 * update from config
 * @param {string[]} chains 区块key或configdats
 */
Wallet.prototype.updateFromConfig = async function (chains) {
  // no need update
  if (this.version && semver.lte(jp.env.version, this.version)) return null
  // set WalletDefaults
  const chainDats = (await Promise.all(chains.map(async chain => {
    if (typeof chain === 'string') {
      return cfgloader.loadConfig('chain', chain)
    } else if (typeof chain.toMerged === 'function') {
      return Promise.resolve(chain)
    } else {
      return Promise.resolve()
    }
  }))).filter(dat => !!dat)
  // set all chains' data
  for (let i = 0; i < chainDats.length; i++) {
    const chainCfgDat = chainDats[i]
    const chainKey = chainCfgDat.key
    const chainCfg = chainCfgDat.toMerged()
    const walletDefaults = chainCfg.WalletDefaults || { data: { seedKey: chainKey } }
    await this._fillDefaultData(chainKey, walletDefaults, !chainCfgDat.disabled, false)
  }
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
Wallet.prototype._fillDefaultData = async function (chainKey, defaultData, enabled, isSave = true) {
  // ensure sourceType available
  const eumTypes = _.values(consts.PRIVKEY_SOURCES)
  const hotSource = [_.get(defaultData, 'source.hot')].filter(v => eumTypes.indexOf(v) !== -1)[0]
  const coldSource = [_.get(defaultData, 'source.cold')].filter(v => eumTypes.indexOf(v) !== -1)[0]
  // build save object
  const i = _.findIndex(this.chains || [], { chainKey })
  if (i === -1) {
    this.chains.push({
      chainKey,
      source: {
        hot: hotSource || consts.PRIVKEY_SOURCES.SEED,
        cold: coldSource || consts.PRIVKEY_SOURCES.SEED
      },
      data: defaultData.data,
      status: {
        enabled: enabled,
        coinsEnabled: defaultData.coinsEnabled || []
      },
      coins: defaultData.coins || []
    })
  } else {
    const chainData = this.chains[i]
    if (!chainData.get('source.hot') && hotSource) {
      chainData.set('source.hot', hotSource)
    }
    if (!chainData.get('source.cold') && coldSource) {
      chainData.set('source.cold', coldSource)
    }
    if (defaultData.data) {
      chainData.data = _.defaults(_.clone(chainData.data), defaultData.data)
    }
    if (chainData.get('status.enabled') === undefined && enabled !== undefined) {
      chainData.set('status.enabled', enabled)
    }
    _.forEach(defaultData.coins || [], defaultsCoinData => {
      const saveCoinData = _.find(chainData.coins || [], { name: defaultsCoinData.name })
      if (saveCoinData) {
        saveCoinData.data = _.defaults(_.clone(saveCoinData.data), defaultsCoinData.data)
      }
    })
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
Wallet.prototype._setAnyData = async function (chainKey, coinName, field, data) {
  const i = _.findIndex(this.chains || [], { chainKey })
  if (i === -1) throw new NBError(40410, `chain: ${chainKey}`)
  if (coinName !== undefined) {
    const chainData = this.chains[i]
    let coinIdx = -1
    coinIdx = _.findIndex(chainData.coins || [], c => c.name === coinName)
    if (coinIdx !== -1) {
      const pathKey = `chains.${i}.coins.${coinIdx}.${field}`
      const oldData = _.clone(this.get(pathKey))
      this.set(pathKey, Object.assign(oldData, data))
    } else {
      chainData.coins.push({ name: coinName, [field]: data })
    }
  } else {
    const pathKey = `chains.${i}.${field}`
    const oldData = _.clone(this.get(pathKey))
    this.set(pathKey, Object.assign(oldData, data))
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
  return this._setAnyData(chainKey, undefined, 'status', status)
}
/**
 * set token enabled status
 * @param {string} chainKey blockchain key
 * @param {string} coinName coin unique name
 * @param {object} status 状态配置
 */
Wallet.prototype.setTokenStatus = async function (chainKey, coinName, status) {
  return this._setAnyData(chainKey, coinName, 'status', status)
}
/**
 * saet token config mods
 */
Wallet.prototype.setConfigMods = async function (chainKey, coinName, mods) {
  return this._setAnyData(chainKey, coinName, 'config', mods)
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
  return this._setAnyData(chainKey, coinName, 'data', sourceData)
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
 * 加载区块链相关的配置信息
 */
Wallet.prototype.populateChainConfig = async function (chainKey) {
  const chainData = _.find(this.chains || [], { chainKey })
  if (chainData) {
    if (!this._chainInfoCache) this._chainInfoCache = new Map()
    const chain = await cfgloader.loadConfig('chain', chainKey)
    if (chain) {
      this._chainInfoCache.set(chainKey, Object.assign({
        id: chain._id,
        key: chainKey
      }, chain.toMerged()))
    }
  }
  return this
}

/**
 * 加载币种相关的配置信息
 */
Wallet.prototype.populateTokenConfig = async function (chainKey, coinName) {
  const chainData = _.find(this.chains || [], { chainKey })
  if (chainData) {
    // load chainInfo first
    if (!this._chainInfoCache || !this._chainInfoCache.has(chainKey)) {
      await this.populateChainInfo(chainKey)
    }
    const chain = this._chainInfoCache.get(chainKey)
    // load tokenInfo now
    if (chain) {
      if (!this._tokenInfoCache) this._tokenInfoCache = new Map()
      const tokenDat = await cfgloader.loadConfig('tokens', coinName, chain.id)
      if (tokenDat) this._tokenInfoCache.set(`${chainKey}.${coinName}`, tokenDat.toMerged())
    }
  }
  return this
}

/**
 * 获取区块链相关的配置信息
 */
Wallet.prototype.getChainInfo = function (chainKey) {
  const chainData = _.find(this.chains || [], { chainKey })
  if (!chainData) {
    throw new NBError(10001, `failed to find chain: ${chainKey}`)
  }
  return {
    chainKey,
    source: chainData.source && chainData.source.toObject(),
    status: chainData.status && chainData.status.toObject(),
    data: _.clone(chainData.data),
    config: this._chainInfoCache && _.clone(this._chainInfoCache.get(chainKey))
  }
}

Wallet.prototype._getTokenInfo = function (chainData, coinName) {
  if (!chainData) throw new NBError(10001, `failed to missing chainData, for ${coinName}`)
  const result = {
    name: coinName,
    data: _.clone(chainData.data),
    status: {}
  }
  const coinData = _.find(chainData.coins || [], c => c.name === coinName)
  if (coinData) {
    result.data = Object.assign(result.data, coinData.data ? _.clone(coinData.data) : {})
    result.status = coinData.status && coinData.status.toObject()
    result.config = coinData.config && coinData.config.toObject()
  }
  return result
}

/**
 * 获取币种相关基本信息
 */
Wallet.prototype.getTokenInfoWithoutConfigDat = function (chainKey, coinName) {
  const chainData = _.find(this.chains || [], { chainKey })
  return this._getTokenInfo(chainData, coinName)
}

/**
 * 获取币种相关的配置信息
 */
Wallet.prototype.getTokenInfo = function (chainKey, coinName, withPatch = false) {
  const chainData = _.find(this.chains || [], { chainKey })
  const result = this._getTokenInfo(chainData, coinName)

  const chainCfg = this._chainInfoCache && this._chainInfoCache.get(chainKey)
  const tokenCfg = this._tokenInfoCache && this._tokenInfoCache.get(`${chainKey}.${coinName}`)
  // 缺少配置则返回残缺版tokenInfo
  if (!chainCfg || !tokenCfg) {
    throw new NBError(10001, `token config without population`)
  }

  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  const cfg = ConfigDat.mergeConfigObj(_.clone(tokenCfg), result.config)
  // 通过全局条件修改config
  if (jp.config.configWatchers) {
    _.forEach(jp.config.configWatchers, watcherCfg => {
      if (!_.includes(['coin', 'jadepool'], watcherCfg.path)) return
      const targetObj = cfg[watcherCfg.path]
      if (!targetObj) return
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

module.exports = Wallet
