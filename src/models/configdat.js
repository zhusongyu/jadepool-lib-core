const _ = require('lodash')
const mongoose = require('mongoose')
const consts = require('../consts')
const { fetchConnection } = require('../utils/db')

const Schema = mongoose.Schema
const schema = new Schema({
  server: { // 服务端名称
    type: String,
    enum: _.values(consts.SERVER_TYPES),
    default: consts.SERVER_TYPES.MAIN,
    required: true
  },
  version: { // 当前配置适用的版本，新版配置将根据该字段来刷新origin字段
    type: String,
    required: true
  },
  parent: { // 该配置内容的核心父级，通常为大类别例如区块链分类等
    type: Schema.Types.ObjectId,
    ref: 'configdat'
  },
  customized: { // 判断该字段是否为客户自定义配置
    type: Boolean,
    default: false
  },
  dirty: { // 设置true将强制加载origin数据
    type: Boolean,
    default: false
  },
  path: { // 该配置内容在配置文件中的父路径。若存在parent，则是相对parent所在的文件夹路径
    type: String,
    require: true
  },
  key: { // 该配置内容在配置文件中的key，同时也是配置文件的文件夹名，为空即为当前path
    type: String,
    default: ''
  },
  origin: { // 保存JSON.stringify，从原始配置文件中读取的config数据
    type: String,
    required: true
  },
  modified: { // 可修改选项，保存JSON.stringify，被修改的配置
    type: String,
    default: null
  },
  disabled: { // 可选，可修改选项，该配置内容是否被禁用
    type: Boolean
  }
}, {
  timestamps: { createdAt: 'create_at', updatedAt: 'update_at' }
})

schema.index({ create_at: -1 })
schema.index({ create_at: -1, path: 1, key: 1 })

schema.index({ server: 1, path: 1, key: 1, parent: 1 })
schema.index({ path: 1, key: 1, parent: 1 }, { unique: true })

const ConfigDat = fetchConnection('config').model('configdat', schema)

ConfigDat.prototype.applyModify = function (jsonToSave) {
  try {
    const oldCfg = this.modified ? JSON.parse(this.modified) : {}
    this.modified = JSON.stringify(mergeConfigObj(oldCfg, jsonToSave))
  } catch (err) {}
  return this
}

ConfigDat.prototype.toMerged = function () {
  let cfgJson = this.origin ? JSON.parse(this.origin) : {}
  if (this.modified) {
    cfgJson = mergeConfigObj(cfgJson, JSON.parse(this.modified))
  }
  // 设置disabled
  if (typeof this.disabled !== 'undefined') {
    cfgJson.disabled = this.disabled
  }
  return cfgJson
}

ConfigDat.prototype.geneTemplate = function () {
  const mergecCfg = this.toMerged()
  if (!mergecCfg) return null
  const template = mergecCfg.template || mergecCfg.tokenTemplate
  if (!template) return null
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
 * 优化并处理修改对象
 * @param {Object} configObj config对象
 * @param {Object} obj 修改对象
 * @param {String} path 递归路径
 * @returns 最终生成对象
 */
const handleConfigObj = (configObj, obj, path) => {
  let ret = {}
  for (const key in obj) {
    const valuePath = path ? `${path}.${key}` : key
    const value = obj[key]
    // saveMods将仅处理对象数组
    if (_.isArray(value)) {
      const originArr = _.get(configObj, valuePath)
      const resultArr = []
      for (let i = 0; i < value.length; i++) {
        const arrData = value[i]
        const arrDataPath = `${valuePath}[${i}]`
        if (!arrData) continue // 无视空对象
        const originData = originArr[i]
        if (!originData || !originData.name) continue // 无视无名对象
        if (_.isObject(arrData)) {
          resultArr.push(_.assign({ name: originData.name }, handleConfigObj(configObj, arrData, arrDataPath)))
        }
      }
      ret[key] = resultArr
    } else if (_.isObject(value)) {
      ret[key] = handleConfigObj(configObj, value, valuePath)
    } else {
      ret[key] = value
    }
  }
  return ret
}

/**
 * 应用配置对象
 * @param {Object} configObj config对象
 * @param {Object} modObj 修改对象
 * @param {String} path 递归路径
 */
const mergeConfigObj = (configObj, modObj, path, onlyMergeExists = false) => {
  for (const key in modObj) {
    const valuePath = path ? `${path}.${key}` : key
    const isExists = _.has(configObj, valuePath)
    const value = modObj[key]
    // 还原对象数组
    if (_.isArray(value)) {
      let originTargetArr = _.get(configObj, valuePath)
      // 若新对象不为array，则对老对象进行覆盖
      if (!_.isArray(originTargetArr)) {
        originTargetArr = []
      }
      // 对于字符串型，进行直接覆盖处理
      if (_.find(value, arrData => _.isString(arrData)) || value.length === 0) {
        originTargetArr = value
      } else {
        // 以下为对象型Array的特殊处理
        for (let i = 0; i < value.length; i++) {
          const arrData = value[i]
          if (!_.isObject(arrData)) continue
          // 若为object类型，arrData中必须含有name
          if (!arrData.name) continue
          // 找到原来的设置
          const mergeTarget = _.find(originTargetArr, { name: arrData.name })
          if (mergeTarget) {
            mergeConfigObj(mergeTarget, arrData, undefined, onlyMergeExists)
          } else if (!onlyMergeExists) {
            originTargetArr.push(arrData)
          }
        }
      }
      if (!onlyMergeExists || isExists) {
        _.set(configObj, valuePath, originTargetArr)
      }
    } else if (_.isObject(value)) {
      mergeConfigObj(configObj, value, valuePath, onlyMergeExists)
    } else {
      if (!onlyMergeExists || isExists) {
        _.set(configObj, valuePath, value)
      }
    }
  }
  return configObj
}

module.exports = Object.assign(ConfigDat, {
  handleConfigObj,
  mergeConfigObj
})
