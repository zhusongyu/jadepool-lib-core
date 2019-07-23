const {
  loadConfig,
  loadConfigKeys,
  setAutoSaveWhenLoad
} = require('./loader')
const jp = require('../../jadepool')

const logger = require('@jadepool/logger').of('Configure')

/**
 * 默认配置加载函数
 * @param {String} moduleName
 * @param {Boolean} needSetConfig 是否需要保持到config中
 */
const configSetupDefault = async (moduleName) => {
  const cfgDat = await loadConfig(moduleName)
  if (!cfgDat) {
    const fileKeys = await loadConfigKeys(moduleName)
    if (fileKeys.length === 0) {
      logger.tag('Missing').warn(`module=${moduleName}`)
      return null
    }
    for (let i = 0; i < fileKeys.length; i++) {
      await loadConfig(moduleName, fileKeys[i])
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
  await configSetupDefault(name)
  if (enableAutoSave) setAutoSaveWhenLoad(false)
  logger.diff(`Setup`).log(`name=${name}`)
}

/**
 * 加载全部配置
 */
const setupAll = async () => {
  // 仅读取以保证数据库写入
  if (jp.config.cfgInits && jp.config.cfgInits.length > 0) {
    logger.diff('SetupAll').tag('Start').log(`cfgs=${jp.config.cfgInits.length}`)
    setAutoSaveWhenLoad(true)
    for (let i = 0; i < jp.config.cfgInits.length; i++) {
      const name = jp.config.cfgInits[i]
      await configSetupDefault(name, false)
      logger.tag('Loaded').log(`name=${name}`)
    }
    setAutoSaveWhenLoad(false)
    logger.diff('SetupAll').tag('End').log('OK')
  }
}

module.exports = {
  setupAll,
  setupConfig
}
