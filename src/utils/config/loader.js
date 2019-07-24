const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const semver = require('semver')
const jp = require('../../jadepool')
const consts = require('../../consts')
const NBError = require('../../NBError')

const logger = require('@jadepool/logger').of('Configure')

// 环境配置
const CONFIG_ROOT_PATH = path.resolve(process.cwd(), 'config')
let enableAutoSaveWhenLoad = false

/**
 * 设置是否自动保存
 * @param {boolean} value
 */
const setAutoSaveWhenLoad = value => {
  enableAutoSaveWhenLoad = !!value
}

/**
 * @type {Map<string, string>}
 */
const aliasMap = new Map()
/**
 * 设置path + key的别名目录
 * 对于loadConfig来说，只取最后一个被设置的别名目录
 * 对于loadConfigKeys来说，别名目录 + config目录下的结果都将累加到最终结果
 * @param {string} cfgPath
 * @param {string} key
 * @param {string} aliasPath
 */
const setAliasConfigPath = (cfgPath, key, aliasPath) => {
  if (fs.existsSync(aliasPath)) {
    aliasMap.set(`${cfgPath}.${key}`, aliasPath)
  }
}

/**
 * 获取path + key的全部别名目录
 * @param {string} cfgPath
 * @param {string} key
 * @param {any} parent
 */
const getConfigPaths = (cfgPath, key, parent = null) => {
  const paths = []
  const aliasKey = `${cfgPath}.${key}`
  if (aliasMap.has(aliasKey)) {
    paths.push(aliasMap.get(aliasKey))
  }
  let parentPath = CONFIG_ROOT_PATH
  if (parent && parent.path && parent.key) {
    let parentKey = `${parent.path}.${parent.key}`
    if (aliasMap.has(parentKey)) {
      parentPath = aliasMap.get(parentKey)
    } else {
      parentPath = path.resolve(CONFIG_ROOT_PATH, parent.path, parent.key)
    }
  }
  parentPath = path.resolve(parentPath, cfgPath)
  paths.push(key ? path.resolve(parentPath, key) : parentPath)
  return paths
}

/**
 * 获取Template
 */
const geneTemplate = async (parent) => {
  const mergedCfg = parent.toMerged()
  if (!mergedCfg) return null
  let template = {}
  if (mergedCfg.tokenTemplates) {
    const templateDat = await loadConfig('tokenTemplates', '')
    if (!templateDat) {
      logger.warn(`failed to load tokenTemplates`)
      return null
    }
    const tokenTemplateDefs = templateDat.toMerged()
    _.forEach(mergedCfg.tokenTemplates, value => {
      if (_.isString(value)) {
        template[value] = _.clone(tokenTemplateDefs[value])
      } else if (_.isObject(value) && value.path && value.rule) {
        template[value.path] = _.clone(value.rule)
      }
    })
  } else if (mergedCfg.template) {
    template = mergedCfg.template
  } else {
    template = mergedCfg
  }
  if (_.isEmpty(template)) return null
  const cfgJson = {}
  _.forEach(template, (value, key) => {
    let defaultVal
    if (typeof value.default !== 'undefined') {
      defaultVal = value.default
    } else if (value.json === true) {
      defaultVal = {}
    } else if (value.type === 'number') {
      defaultVal = 0
    } else if (value.type === 'string') {
      defaultVal = ''
    } else if (value.type === 'boolean') {
      defaultVal = false
    } else {
      defaultVal = null
    }
    _.set(cfgJson, key, defaultVal)
  })
  return cfgJson
}

/**
 * 从数据库中读取配置，若该配置不存在，则从文件中读取并保存到数据库
 * @param {String} cfgPath 目录名
 * @param {String} key 子目录名
 * @param {any} parent
 * @returns {Promise<{toMerged: Function, applyModify: Function, save: Function}>}
 */
const loadConfig = async (cfgPath, key = '', parent = null) => {
  const query = { path: cfgPath, key }
  if (parent) {
    query.parent = parent._id || parent.id || parent
  } else {
    query.parent = { $exists: false }
  }

  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  let cfgDat = await ConfigDat.findOne(query).exec()
  if ((enableAutoSaveWhenLoad && (!cfgDat || semver.gt(jp.env.version, cfgDat.version))) ||
    (!jp.env.isProd && cfgDat && cfgDat.dirty)) {
    let parentDat
    if (query.parent) {
      parentDat = await ConfigDat.findById(query.parent).exec()
    }
    // 读取文件配置
    let cfgFilePaths = getConfigPaths(cfgPath, key, parentDat)
    let cfgFilePath = cfgFilePaths[0]
    // 不存在文件配置，说明这个是自定义的配置
    if (!fs.existsSync(cfgFilePath)) {
      if (!cfgDat) return null
      // 若为自定义配置且存在parent，则说明origin为parent的template
      if (cfgDat.customized && cfgDat.parent) {
        // 重置origin为parent的template
        const templateJson = await geneTemplate(parentDat)
        if (templateJson) {
          // 设置配置内容
          cfgDat.origin = JSON.stringify(templateJson)
        }
      }
    } else {
      let cfgJson
      try {
        cfgJson = jp.config.util.loadFileConfigs(cfgFilePath)
      } catch (err) {
        logger.warn(`failed to load: ${cfgFilePath}. Error=${err && err.message}`)
      }
      if (!cfgDat && (!cfgJson || _.isEmpty(cfgJson))) return null
      // 设置新配置
      if (!cfgDat) {
        cfgDat = new ConfigDat({
          server: jp.env.server,
          path: cfgPath,
          key
        })
        if (parent) cfgDat.parent = parent._id || parent.id || parent
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
 * @param {any} parent
 * @returns {Promise<string[]>}
 */
const loadConfigKeys = async (cfgPath, parent = null, includeDisabled = true) => {
  const query = {
    path: cfgPath,
    key: { $ne: '' }
  }
  if (parent) {
    query.parent = parent._id || parent.id || parent
  } else {
    query.parent = { $exists: false }
  }

  // Config in DB
  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  const cfgs = (await ConfigDat.find(query).exec()) || []
  let namesInDBs = cfgs.filter(cfg => includeDisabled || !cfg.disabled).map(cfg => cfg.key)
  if (!includeDisabled) return namesInDBs
  // Config in Files
  let cfgFilePaths = getConfigPaths(cfgPath, '', parent)
  // 返回系列Keys
  return _.reduce(cfgFilePaths, (allNames, currPath) => {
    if (fs.existsSync(currPath)) {
      let nameInFolders = fs.readdirSync(currPath).filter(fileName => fileName.indexOf('.') === -1)
      allNames = _.union(allNames, nameInFolders)
    }
    return allNames
  }, namesInDBs)
}

/**
 * 保存配置修改
 * @param {String} cfgPath 目录名
 * @param {String} key 子目录名
 * @param {Object} modJson 配置修改Json，需Merge
 * @param {Object} disabled 是否禁用
 * @param {any} parent
 * @returns {Promise<{toMerged: Function, applyModify: Function, save: Function}>}
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
    const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
    cfgDat = new ConfigDat(data)
    if (parent) {
      cfgDat.parent = parent
      await cfgDat.populate('parent').execPopulate()
      // 设置origin为parent的template
      const templateJson = await geneTemplate(cfgDat.parent)
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

/**
 * 从数据库中删除配置，该配置必须是customized的配置
 * @param {String} cfgPath 目录名
 * @param {String} key 子目录名
 * @param {any} parent
 * @returns {Promise<boolean>}
 */
const deleteConfig = async (cfgPath, key = '', parent = null) => {
  const query = {
    path: cfgPath,
    key
  }
  if (parent) {
    query.parent = parent
  } else {
    query.parent = { $exists: false }
  }
  const ConfigDat = jp.getModel(consts.MODEL_NAMES.CONFIG_DATA)
  let cfgDat = await ConfigDat.findOne(query).exec()
  if (!cfgDat) {
    throw new NBError(10001, `failed to find config data`)
  }
  if (cfgDat.server !== jp.env.server) {
    throw new NBError(10001, `server not match`)
  }
  if (!cfgDat.customized) {
    throw new NBError(10001, `Only customized config can be deleted`)
  }
  // 查询并删除ConfigDat
  query.server = jp.env.server
  query.customized = true
  await ConfigDat.deleteOne(query).exec()
  return true
}

module.exports = {
  // Methods
  setAutoSaveWhenLoad,
  setAliasConfigPath,
  loadConfig,
  loadConfigKeys,
  deleteConfig,
  saveConfig
}
