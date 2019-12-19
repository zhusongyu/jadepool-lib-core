const _ = require('lodash')
const mongoose = require('mongoose')
const consts = require('../consts')
const { fetchConnection } = require('../utils/db')

const schema = new mongoose.Schema({
  category: {
    type: String,
    enum: _.values(consts.ACTIVITY_CATEGORY),
    required: true,
    default: consts.ACTIVITY_CATEGORY.API_INVOKE
  },
  module: {
    type: String,
    required: true,
    default: consts.DEFAULT_KEY
  },
  // Action名称，通常resource权限为名称关键
  name: {
    type: String,
    required: true
  },
  // 记录 activity 日志编号
  log_code: {
    type: Number,
    required: true,
    default: -1,
    min: -1
  },
  log_params: [ String ], // 记录 activity 的日志参数
  // 操作者，可以是某个 User 或者某个 AppId 或者某个授权用户 或者某个事件
  operator: { type: String, required: true },
  // 操作者操作时的 role name
  operator_role: { type: String, required: true },
  // 操作行为记录
  input: {
    method: String, // 操作方法名
    params: String, // 操作参数 JSON记录
    model: String, // 操作对象（可选，需为数据库对象名）
    // 请求发起的时间戳
    record_at: {
      type: Number,
      default: Date.now()
    }
  },
  output: {
    result: String, // 操作结果，JSON记录
    error: String, // 操作错误，JSON记录
    // 返回结果的时间戳
    record_at: Number
  }
}, {
  timestamps: { createdAt: 'create_at', updatedAt: 'update_at' }
})

// 快速查询
schema.index({ category: 1, module: 1, name: 1 }, { name: 'groupByName' })
// Admin查询
schema.index({ category: 1, create_at: -1, name: 1, operator: 1 }, { name: 'queryName' })

const Model = fetchConnection().model(consts.MODEL_NAMES.ACTIVITY, schema)

module.exports = Model
