const _ = require('lodash')
const mongoose = require('mongoose')
const consts = require('../consts')
const jp = require('../jadepool')
const { fetchConnection } = require('../utils/db')
const Schema = mongoose.Schema

const schema = new Schema({
  id: { type: String, required: true, unique: true },
  alias: String, // 别名
  desc: String,
  wallet: { // 指向钱包
    type: Schema.Types.ObjectId,
    ref: consts.MODEL_NAMES.WALLET
  },
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
  },
  // 软删除配置
  state: {
    type: String,
    enum: ['used', 'blocked', 'deleted'],
    default: 'used'
  },
  // 软删除
  delete_at: Date
}, {
  timestamps: { createdAt: 'create_at', updatedAt: 'update_at' }
})

schema.index({ id: 1 }, { name: 'uniqueIndex', unique: true })
schema.index({ wallet: 1, state: 1 }, { name: 'walletIndex' })

const AppConfig = fetchConnection(consts.DB_KEYS.CONFIG).model(consts.MODEL_NAMES.APPLICATION, schema)

/**
 * 设置wallet
 */
AppConfig.prototype.setWallet = async function (wallet) {
  const walletId = wallet._id || Schema.Types.ObjectId(wallet)
  const Wallet = jp.getModel(consts.MODEL_NAMES.WALLET)
  const w = await Wallet.findById(walletId).exec()
  if (!w) return this
  // set and save
  this.wallet = walletId
  await this.save()
  return this
}

/**
 * 获取该app指向的Wallet信息
 */
AppConfig.prototype.getWallet = async function () {
  const Wallet = jp.getModel(consts.MODEL_NAMES.WALLET)
  let wallet
  if (this.wallet) {
    wallet = await Wallet.findById(this.wallet).exec()
  } else {
    wallet = await Wallet.findOne({ name: consts.DEFAULT_KEY }).exec()
  }
  return wallet
}

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
