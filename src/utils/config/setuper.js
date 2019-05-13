const _ = require('lodash')
const semver = require('semver')
const {
  loadConfig,
  loadConfigKeys,
  setAutoSaveWhenLoad
} = require('./loader')
const consts = require('../../consts')
const jp = require('../../jadepool')

const logger = require('@jadepool/logger').of('Configure')

/**
 * 默认配置加载函数
 * @param {String} moduleName
 * @param {Boolean} needSetConfig 是否需要保持到config中
 */
const configSetupDefault = async (moduleName, needSetConfig = true) => {
  const cfgDat = await loadConfig(moduleName)
  if (!cfgDat) {
    const fileKeys = await loadConfigKeys(moduleName)
    if (fileKeys.length === 0) {
      logger.tag('Missing').warn(`module=${moduleName}`)
      return null
    }
    if (needSetConfig) {
      jp.config[moduleName] = {}
    }
    for (let i = 0; i < fileKeys.length; i++) {
      const key = fileKeys[i]
      let subCfgDat = await loadConfig(moduleName, key)
      if (!subCfgDat) continue
      if (needSetConfig) {
        jp.config[moduleName][key] = subCfgDat.toMerged()
      }
    }
  } else if (needSetConfig) {
    jp.config[moduleName] = cfgDat.toMerged()
  }
}

const configSetupMethods = {
  'chain': async () => {
    // Step.1 一些准备配置，和旧版本配置将不再兼容
    jp.config.chain = {}
    jp.config.coin = {}
    jp.config.jadepool = {}
    // 获取defaultwallet
    const Wallet = jp.getModel(consts.MODEL_NAMES.WALLET)
    const defaultWallet = await Wallet.findOne({ name: consts.DEFAULT_KEY }).exec()
    // Step.2 加载chains目录
    const fileKeys = await loadConfigKeys('chain')
    for (let i = 0; i < fileKeys.length; i++) {
      const key = fileKeys[i]
      // 设置WalletDefaults
      if (!defaultWallet.version || semver.gt(jp.env.version, defaultWallet.version)) {
        let chainCfgDat = await loadConfig('chain', key)
        if (!chainCfgDat) continue
        const chainCfg = chainCfgDat.toMerged()
        const walletDefaults = chainCfg.WalletDefaults || { data: { seedKey: key } }
        await defaultWallet.updateWalletData(key, walletDefaults, !chainCfgDat.disabled)
        logger.tag('Wallet-updated', key).log(JSON.stringify(walletDefaults))
      }

      await defaultWallet.populateChainConfig(key)
      const chainInfo = defaultWallet.getChainInfo(key)
      if (!chainInfo) continue
      // 跳过区块链已被禁用的货币
      if (chainInfo.config.disabled) continue
      const basicCfgs = []
      const jadepoolCfgs = []
      // 加载全部Tokens
      let allTokens = await loadConfigKeys('tokens', chainInfo.config.id)
      allTokens = allTokens.filter(tokenName => tokenName !== '_')
      for (let i = 0; i < allTokens.length; i++) {
        const coinName = allTokens[i]
        await defaultWallet.populateTokenConfig(key, coinName)
        const tokenInfo = defaultWallet.getTokenInfo(key, coinName)
        if (!tokenInfo) continue
        if (chainInfo.status.coinsEnabled.indexOf(coinName) === -1) continue

        const DerivativeRoot = defaultWallet.getAddressDerivativePath(chainInfo.config.ChainIndex, 0, chainInfo.config.MainIndexOffset || 0)
        // coin对象上，打上补丁
        basicCfgs.push(_.defaults(tokenInfo.config.coin, {
          name: coinName,
          Chain: chainInfo.config.Chain,
          DerivativeRoot: DerivativeRoot.substring(0, DerivativeRoot.lastIndexOf('/0'))
        }))
        // 为早期jadepool配置制作的补丁
        jadepoolCfgs.push(_.defaults(tokenInfo.config.jadepool, {
          name: coinName,
          HotWallet: {
            DerivativePath: defaultWallet.getHotDerivativePath(chainInfo.config.ChainIndex, 0, chainInfo.config.MainIndexOffset || 0),
            Source: chainInfo.source.hot,
            Mode: tokenInfo.data.hotMode,
            Bin: tokenInfo.data.hotBin,
            Address: tokenInfo.data.hotAddress || ''
          },
          ColdWallet: {
            Source: chainInfo.source.cold,
            SeedKey: tokenInfo.data.seedKey,
            HSMKey: tokenInfo.data.hsmKey,
            Address: tokenInfo.data.coldAddress || ''
          }
        }))
      }
      // 设置到config
      jp.config.coin[key] = basicCfgs
      jp.config.jadepool[key] = jadepoolCfgs
      jp.config.chain[key] = chainInfo.config
    }
    // 更新版本号
    if (!defaultWallet.version || semver.gt(jp.env.version, defaultWallet.version)) {
      defaultWallet.version = jp.env.version
      // save default wallet
      await defaultWallet.save()
      logger.tag('Wallet').log('version updated')
    }
  }
}

/**
 * 加载并处理配置
 * @param {String} name 名称
 * @param {Boolean} enableAutoSave 自动保存
 */
const setupConfig = async (name, enableAutoSave = false) => {
  if (enableAutoSave) setAutoSaveWhenLoad(true)
  if (typeof configSetupMethods[name] === 'function') {
    await configSetupMethods[name]()
  } else {
    await configSetupDefault(name)
  }
  if (enableAutoSave) setAutoSaveWhenLoad(false)
  logger.diff(`Setup`).log(`name=${name}`)
}

/**
 * 加载全部配置
 */
const setupAll = async () => {
  if (!jp.config.cfgLoads || !_.isArray(jp.config.cfgLoads)) return
  // 常量设置
  jp.config.isTestNet = !jp.env.isProd

  logger.diff('SetupAll').tag('Start').log(`cfgs=${jp.config.cfgLoads.length}`)
  // 仅读取以保证数据库写入
  if (jp.config.cfgInits && jp.config.cfgInits.length > 0) {
    setAutoSaveWhenLoad(true)
    for (let i = 0; i < jp.config.cfgInits.length; i++) {
      const name = jp.config.cfgInits[i]
      await configSetupDefault(name, false)
      logger.tag('Loaded').log(`name=${name}`)
    }
    setAutoSaveWhenLoad(false)
  }
  // 读取并配置config
  if (jp.config.cfgLoads && jp.config.cfgLoads.length > 0) {
    for (let i = 0; i < jp.config.cfgLoads.length; i++) {
      await setupConfig(jp.config.cfgLoads[i], true)
    }
  }
  logger.diff('SetupAll').tag('End').log('OK')
}

module.exports = {
  setupAll,
  setupConfig
}
