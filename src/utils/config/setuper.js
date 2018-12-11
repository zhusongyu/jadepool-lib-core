const _ = require('lodash')
const {
  loadConfig,
  loadConfigKeys,
  setAutoSaveWhenLoad
} = require('./loader')
const { fetchAllCoinNames } = require('./index')
const jp = require('../../jadepool')

const logger = require('@jadepool/logger').of('Configure')

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

  const basicCfg = _.defaults(coinCfg.coin, {
    name: coinCfg.name || coinName,
    disabled: coinCfg.disabled,
    Chain: chainCfg.Chain
  })
  const jpCfg = _.defaults(coinCfg.jadepool, {
    name: coinCfg.name || coinName
  })
  let coinPath
  let jpPath
  // 恢复旧版本的config.coin和config.jadepool
  if (!tokenCfg.build.extends || baseKey) {
    if (coinCfg.coin) {
      jp.config.coin[coinName] = jp.config.coin[coinName] || {}
      _.assign(jp.config.coin[coinName], basicCfg)
    }
    if (coinCfg.jadepool) {
      jp.config.jadepool[coinName] = jp.config.jadepool[coinName] || {}
      _.assign(jp.config.jadepool[coinName], jpCfg)
    }
    coinPath = `coin.${coinName}`
    jpPath = `jadepool.${coinName}`
  } else {
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
    // 设置默认配置
    const taskCfg = (await loadConfig('task')).toMerged()
    const configWatchers = _.values((await loadConfig('configWatchers')).toMerged())

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
      chainCfg.key = key
      // 设置节点数据
      const nodes = _.isArray(chainCfg.node) ? chainCfg.node : [ chainCfg.node ]
      _.forEach(nodes, nodeCfg => {
        jp.config.node[nodeCfg.name] = nodeCfg
      })
      // 设置closer数据
      jp.config.closer[key] = chainCfg.closer
      // 设置task数据
      if (!chainCfg.agenda || _.isEmpty(chainCfg.agenda)) {
        // 若cfg.agenda不存在，则赋予默认值
        chainCfg.agenda = taskCfg.chainsDefault
      }
      _.set(jp.config, `task.chains.${key}`, chainCfg.agenda)
      // 设置tokenWatchers
      chainCfg.tokenWatchers = _.concat(chainCfg.tokenWatchers || [], configWatchers)

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
  },
  'callback': async () => {
    await configSetupDefault('callback')
    // 设置debugCallback打补丁
    jp.config.debugCallback = _.get(jp.config, `callback.debug`)
  },
  'configMods': async () => {
    await configSetupDefault('configMods')
    // 补充设置
    let coinNames = fetchAllCoinNames()
    const ERC20N = jp.config.coin.ERC20 ? _.range(jp.config.coin.ERC20.length) : []
    _.forEach(jp.config.configMods, (val, key) => {
      if (!_.isArray(val)) return
      val = replaceStrings(val, '{cointype}', coinNames)
      if (ERC20N.length > 0) val = replaceStrings(val, '{erc20n}', ERC20N)
      jp.config.configMods[key] = val
    })
  },
  'mods': async () => {
    // 直接加载mods修改
    const modsDat = await loadConfig('mods')
    if (modsDat) {
      jp.models.ConfigDat.mergeConfigObj(jp.config, modsDat.toMerged(), undefined, true)
      logger.tag('Dynamic Mods').log('applied')
    }
    // 根据watchers的条件修改config
    _.forIn(jp.config.chain, chainCfg => {
      const chainTokenWatchers = chainCfg.tokenWatchers || []
      const tokenCfg = chainCfg.tokens
      // 按币种检测
      _.forEach(chainTokenWatchers, watcherCfg => {
        if (['coin', 'jadepool'].indexOf(watcherCfg.path) === -1) return
        const rootCfg = jp.config[watcherCfg.path]
        // 列举全部的代币
        let targets
        if (tokenCfg.build.extends) {
          targets = rootCfg[tokenCfg.build.extends[watcherCfg.path]] || []
        } else {
          targets = _.map(tokenCfg.enabled, tokenName => rootCfg[tokenName])
        }
        // 找到需要修改的目标
        switch (true) {
          case (typeof watcherCfg.where === 'string'):
            targets = _.filter(targets, one => one.name === watcherCfg.where)
            break
          case (typeof watcherCfg.where === 'object'):
            targets = _.filter(targets, watcherCfg.where)
            break
        }
        // 根据conds进行参数修改
        _.forIn(watcherCfg.cond, (valueArr, key) => {
          const method = valueArr[0]
          if (!method) return
          _.forEach(targets, targetObj => {
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
          }) // end targets forEach
        }) // end conds forIn
      }) // end watchers
    }) // end chains
  }
}

// 进行configMods调整
const replaceStrings = (strArr, searchStr, valueArray) => {
  let result = []
  for (let i = 0; i < strArr.length; i++) {
    const str = strArr[i]
    if (str.indexOf(searchStr) !== -1) {
      _.forEach(valueArray, cointype => {
        result.push(_.replace(str, searchStr, cointype))
      })
    } else {
      result.push(str)
    }
  }
  return result
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
  jp.config.isTestNet = (process.env.NODE_ENV !== 'production')

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
