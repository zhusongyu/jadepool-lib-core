const _ = require('lodash')
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
    jp.config.coins = []
    jp.config.coin = {}
    jp.config.jadepool = {}
    jp.config.node = {}
    jp.config.closer = {}
    // 获取defaultwallet
    const Wallet = jp.getModel(consts.MODEL_NAMES.WALLET)
    const defaultWallet = await Wallet.findOne({ name: consts.DEFAULT_KEY }).exec()
    /**
     * 为配置添加token
     * @param {ConfigDat} parentDat
     * @param {ConfigObject} chainCfg
     * @param {ConfigObject} tokenCfg
     * @param {String} folderName
     * @param {String} baseKey 可选, 同时用于标示是否为基础信息初始化
     */
    const addToken = async (parentDat, chainCfg, tokenCfg, folderName, baseKey) => {
      const coinCfgDat = await loadConfig('tokens', folderName, parentDat)
      if (!coinCfgDat) return
      // Token信息初始化需enabled的token，则直接返回不加载到内存
      if (!baseKey && tokenCfg.enabled.indexOf(folderName) === -1) return

      let coinCfg = coinCfgDat.toMerged()
      const coinName = baseKey || folderName

      const sourceData = defaultWallet.getSourceData(chainCfg.key)
      // coin对象上，打上补丁
      const basicCfg = _.defaults(coinCfg.coin, {
        name: coinName,
        disabled: coinCfg.disabled,
        Chain: chainCfg.Chain
      })
      const jpCfg = _.defaults(coinCfg.jadepool, {
        name: coinName
      })
      let coinPath
      let jpPath
      // 恢复旧版本的config.coin和config.jadepool
      if (!tokenCfg.build.extends || baseKey) {
        // 为早期coin配置制作的补丁
        const DerivativeRoot = defaultWallet.getAddressDerivativePath(chainCfg.ChainIndex, 0, chainCfg.MainIndexOffset || 0)
        jp.config.coin[coinName] = jp.config.coin[coinName] || {}
        _.assign(jp.config.coin[coinName], basicCfg, {
          DerivativeRoot: DerivativeRoot.substring(0, DerivativeRoot.lastIndexOf('/0'))
        })
        coinPath = `coin.${coinName}`
        // 为早期jadepool配置制作的补丁
        jp.config.jadepool[coinName] = jp.config.jadepool[coinName] || {}
        _.assign(jp.config.jadepool[coinName], jpCfg, {
          HotWallet: {
            DerivativePath: defaultWallet.getHotDerivativePath(chainCfg.ChainIndex, 0, chainCfg.MainIndexOffset || 0),
            Source: sourceData.hotSource,
            Mode: sourceData.hotMode,
            Bin: sourceData.hotBin,
            Address: sourceData.hotAddress || ''
          },
          ColdWallet: {
            Source: sourceData.coldSource,
            SeedKey: sourceData.seedKey,
            HSMKey: sourceData.hsmKey,
            Address: sourceData.coldAddress || ''
          }
        })
        jpPath = `jadepool.${coinName}`
      } else {
        // 为早期jadepool配置制作的补丁
        const coinSourceData = defaultWallet.getSourceData(chainCfg.key, coinCfg.name)
        Object.assign(jpCfg, {
          ColdWallet: {
            SeedKey: coinSourceData.seedKey
          }
        })
        const basicKey = tokenCfg.build.extends.coin
        const walletKey = tokenCfg.build.extends.jadepool
        let coinArr = jp.config.coin[basicKey] || []
        let jpArr = jp.config.jadepool[walletKey] || []
        if (coinCfg.coin) {
          let coinIdx = _.findIndex(coinArr, { name: coinCfg.name })
          if (coinIdx === -1) {
            coinIdx = coinArr.length
            coinArr.push(basicCfg)
          } else {
            _.assign(coinArr[coinIdx], basicCfg)
          }
          coinPath = `coin.${basicKey}[${coinIdx}]`
        }
        if (coinCfg.jadepool) {
          let coinIdx = _.findIndex(jpArr, { name: coinCfg.name })
          if (coinIdx === -1) {
            coinIdx = jpArr.length
            jpArr.push(jpCfg)
          } else {
            _.assign(jpArr[coinIdx], jpCfg)
          }
          jpPath = `jadepool.${walletKey}[${coinIdx}]`
        }
        jp.config.coin[basicKey] = coinArr
        jp.config.jadepool[walletKey] = jpArr
      }

      // 当设置tokenCfg.enabled时，即baseKey添加到可用coins
      if (!baseKey) {
        const baseTokenKey = tokenCfg.build.baseKey || tokenCfg.build.base
        const baseCoinPath = `coin.${baseTokenKey}`
        const baseJpPath = `jadepool.${baseTokenKey}`
        const parsedCfg = {}
        parsedCfg.name = coinCfg.name || coinName
        parsedCfg.chain = parsedCfg.Chain = chainCfg.Chain
        parsedCfg.chainKey = chainCfg.key
        parsedCfg.coinCfgPath = [ baseCoinPath ]
        parsedCfg.jpCfgPath = [ baseJpPath ]
        if (coinPath && coinPath !== baseCoinPath) {
          parsedCfg.coinCfgPath.push(coinPath)
        }
        if (jpPath && jpPath !== baseJpPath) {
          parsedCfg.jpCfgPath.push(jpPath)
        }
        jp.config.coins.push(parsedCfg)
      }
      return coinCfg
    }
    // Step.2 加载chains目录
    const fileKeys = await loadConfigKeys('chain')
    for (let i = 0; i < fileKeys.length; i++) {
      const key = fileKeys[i]
      let chainCfgDat = await loadConfig('chain', key)
      if (!chainCfgDat) continue
      let chainCfg = chainCfgDat.toMerged()
      if (_.isEmpty(chainCfg)) continue
      // 跳过区块链已被禁用的货币
      if (chainCfg.disabled) continue
      // 设置基础数据
      chainCfg.id = String(chainCfgDat._id)
      chainCfg.key = key
      // 设置节点数据
      const nodes = _.isArray(chainCfg.node) ? chainCfg.node : [ chainCfg.node ]
      _.forEach(nodes, nodeCfg => {
        jp.config.node[nodeCfg.name] = nodeCfg
      })
      // 设置closer数据
      jp.config.closer[key] = chainCfg.closer

      // --- 读取tokens
      const tokenCfgDat = await loadConfig('tokens', '', chainCfgDat)
      if (!tokenCfgDat) continue
      let tokenCfg = tokenCfgDat.toMerged()
      chainCfg.tokens = tokenCfg

      // 加载基础Token
      const baseTokenKey = tokenCfg.build.baseKey || tokenCfg.build.base
      await addToken(chainCfgDat, chainCfg, tokenCfg, tokenCfg.build.base, baseTokenKey)
      // 加载全部Tokens
      let allTokens = await loadConfigKeys('tokens', chainCfgDat)
      for (let i = 0; i < allTokens.length; i++) {
        await addToken(chainCfgDat, chainCfg, tokenCfg, allTokens[i])
      }
      // 设置到config
      jp.config.chain[key] = chainCfg
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
