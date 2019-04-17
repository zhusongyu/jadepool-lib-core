const _ = require('lodash')
const mongoose = require('mongoose')
const consts = require('../consts')
const { fetchConnection } = require('../utils/db')
const Schema = mongoose.Schema

const schema = new Schema({
  id: { type: String, required: true, unique: true },
  desc: String,
  // 应用权限信息
  resouces: [
    {
      action: { type: String, required: true },
      permission: {
        type: String,
        enum: ['', 'r', 'rw'],
        required: true
      }
    }
  ],
  // 瑶池认可的应用公钥
  accepts: [
    {
      category: {
        type: String,
        enum: ['ecc'],
        required: true,
        default: 'ecc'
      },
      key: { type: String, required: true },
      encode: { type: String, required: true }
    }
  ],
  // 应用回调地址
  callbacks: {
    type: Object,
    default: () => ({})
  },
  // 因为额外数据
  data: {
    type: Schema.Types.Mixed,
    default: () => ({})
  }
}, {
  timestamps: { createdAt: 'create_at', updatedAt: 'update_at' }
})

schema.index({ id: 1 }, { name: 'uniqueIndex', unique: true })

const AppConfig = fetchConnection(consts.DB_KEYS.CONFIG).model(consts.MODEL_NAMES.APPLICATION, schema)

/**
 * 验证是否具有某权限
 * @param {string} action 权限名
 * @param {''|'r'|'rw'} permission 权限类型
 * @return {boolean}
 */
AppConfig.prototype.checkPermission = function (action, permission) {
  const rule = _.find(this.resouces || [], { action })
  if (rule) {
    return rule.permission.indexOf(permission) >= 0
  } else {
    return false
  }
}
/**
 * 返回全部可接受的公钥
 * @return {Buffer[]}
 */
AppConfig.prototype.getPublicKeys = function () {
  return (this.accepts || []).map(obj => Buffer.from(obj.key, obj.encode))
}
/**
 * 获取category对应的callback url
 * @param {string} category
 * @returns {string|undefined}
 */
AppConfig.prototype.getCallbackUrl = function (category) {
  return _.get(this.callbacks || {}, category) || undefined
}
/**
 * 获取App参数
 * @param {string} path
 * @returns {string}
 */
AppConfig.prototype.getData = function (path) {
  return _.get(this.data || {}, path) || ''
}

module.exports = AppConfig
