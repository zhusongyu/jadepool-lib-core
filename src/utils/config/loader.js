const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const semver = require('semver')
const config = require('config')
const jp = require('../../jadepool')

// 环境配置
let enableAutoSaveWhenLoad = false

/**
 * 设置是否自动保存
 * @param {boolean} value
 */
const setAutoSaveWhenLoad = value => {
  enableAutoSaveWhenLoad = !!value
}

/**
 * 从数据库中读取配置，若该配置不存在，则从文件中读取并保存到数据库
 * @param {String} cfgPath 目录名
 * @param {String} key 子目录名
 * @param {ConfigDat} parent
 * @returns {{toMerged: Function, geneTemplate: Function, applyModify: Function, save: Function}}
 */
const loadConfig = async (cfgPath, key = '', parent = null, forceSelf = false) => {
  const query = { path: cfgPath, key }
  if (parent) {
    query.parent = parent
  } else {
    query.parent = { $exists: false }
  }
  if (forceSelf) {
    query.server = jp.env.server
  }
  const ConfigDat = jp.models.ConfigDat
  let cfgDat = await ConfigDat.findOne(query).populate('parent').exec()
  if ((enableAutoSaveWhenLoad && (!cfgDat || semver.gt(jp.env.version, cfgDat.version))) ||
    (!jp.env.isProd && cfgDat && cfgDat.dirty)) {
    // 读取文件配置
    const cwdPath = process.cwd()
    let cfgFilePath = path.resolve(cwdPath, 'config')
    if (parent) {
      cfgFilePath = path.resolve(cfgFilePath, parent.path, parent.key)
    }
    cfgFilePath = path.resolve(cfgFilePath, cfgPath || '', key || '')
    // 不存在文件配置，说明这个是自定义的配置
    if (!fs.existsSync(cfgFilePath)) {
      if (!cfgDat) return null
      // 若为自定义配置且存在parent，则说明origin为parent的template
      if (cfgDat.customized && cfgDat.parent) {
        // 重置origin为parent的template
        const templateJson = cfgDat.parent.geneTemplate()
        if (templateJson) {
          // 设置配置内容
          cfgDat.origin = JSON.stringify(templateJson)
        }
      }
    } else {
      const cfgJson = config.util.loadFileConfigs(cfgFilePath)
      if (!cfgDat && (!cfgJson || _.isEmpty(cfgJson))) return null
      // 设置新配置
      if (!cfgDat) {
        cfgDat = new ConfigDat({
          server: jp.env.server,
          path: cfgPath,
          key
        })
        if (parent) cfgDat.parent = parent
        // 初始化disabled
        if (typeof cfgJson.disabled === 'boolean') {
          cfgDat.disabled = cfgJson.disabled
        }
      }
      // 设置配置内容
      cfgDat.origin = JSON.stringify(cfgJson)
    }
    // 设置配置版本
    cfgDat.version = jp.env.version
    cfgDat.dirty = false
    await cfgDat.save()
  }
  return cfgDat
}

/**
 * 从数据库中读取path相同的全部配置，同时也从文件夹中读取全部路径
 * @param {String} cfgPath
 * @param {ConfigDat} parent
 */
const loadConfigKeys = async (cfgPath, parent = null) => {
  const query = {
    path: cfgPath,
    key: { $ne: '' }
  }
  if (parent) { query.parent = parent }

  // Config in DB
  const ConfigDat = jp.models.ConfigDat
  const cfgs = (await ConfigDat.find(query).exec()) || []
  let namesInDBs = _.map(cfgs, 'key')
  // Config in Files
  const cwdPath = process.cwd()
  let cfgFilePath = path.resolve(cwdPath, 'config')
  if (parent) {
    cfgFilePath = path.resolve(cfgFilePath, parent.path, parent.key)
  }
  let targetPath = path.resolve(cfgFilePath, cfgPath)
  let nameInFolders = []
  if (fs.existsSync(targetPath)) {
    nameInFolders = fs.readdirSync(targetPath).filter(fileName => fileName.indexOf('.') === -1)
  }
  // 返回系列Keys
  return _.union(namesInDBs, nameInFolders)
}

/**
 * 保存配置修改
 * @param {String} cfgPath 目录名
 * @param {String} key 子目录名
 * @param {Object} modJson 配置修改Json，需Merge
 * @param {Object} disabled 是否禁用
 * @param {ConfigDat} parent
 * @returns {ConfigDat}
 */
const saveConfig = async (cfgPath, key, modJson, disabled = undefined, parent = null) => {
  let needSave = false
  let cfgDat = await loadConfig(cfgPath, key, parent)
  if (!cfgDat) {
    // 创建全新的ConfigDat
    const data = {
      server: jp.env.server,
      version: jp.env.version,
      customized: true,
      path: cfgPath,
      key,
      origin: '{}'
    }
    cfgDat = new jp.models.ConfigDat(data)
    if (parent) {
      cfgDat.parent = parent
      // 设置origin为parent的template
      const templateJson = parent.geneTemplate()
      if (templateJson) {
        // 设置配置内容
        cfgDat.origin = JSON.stringify(templateJson)
      }
    }
    needSave = true
  }
  // 设置disabled
  if (disabled !== undefined) {
    cfgDat.disabled = !!disabled
    needSave = true
  }
  // 设置修改数据
  if (modJson) {
    cfgDat.applyModify(modJson)
    needSave = true
  }
  // 保存
  if (needSave) {
    await cfgDat.save()
  }
  return cfgDat
}

module.exports = {
  // Methods
  setAutoSaveWhenLoad,
  loadConfig,
  loadConfigKeys,
  saveConfig
}
