const _ = require('lodash')
const mongoose = require('mongoose')
const consts = require('../consts')
const { fetchConnection } = require('../utils/db')

const Schema = mongoose.Schema
const schema = new Schema({
  // 计划信息
  mode: { // 运行模式
    type: String,
    enum: _.values(consts.ASYNC_PLAN_MODES),
    required: true
  },
  source: { // 启动计划的来源
    type: String,
    enum: _.values(consts.ASYNC_PLAN_SOURCES),
    default: consts.ASYNC_PLAN_SOURCES.SYSTEM,
    required: true
  },
  source_id: { // app为appid, admin为username
    type: String,
    required: false
  },
  refer: { // 引用任务，即为上一次失败的任务
    type: Schema.Types.ObjectId,
    ref: consts.MODEL_NAMES.ASYNC_PLAN
  },
  // 完成结果
  status: {
    type: String,
    enum: _.values(consts.ASYNC_PLAN_STATUS)
  },
  // 任务进度
  finished_steps: {
    type: Number,
    min: 0,
    default: 0,
    required: true
  },
  // 计划任务列表
  plans: [
    {
      // 任务种类
      category: {
        type: String,
        enum: _.values(consts.ASYNC_PLAN_CATEGORY),
        required: true
      },
      // 该字段为选填，即该任务执行的名字空间，通常为区块链Key
      namespace: {
        type: String,
        required: false
      },
      // 该字段必须设置，即为该任务执行的具体内容
      method: {
        type: String,
        required: true
      },
      // 该字段为选填，即为该任务执行内容的参数
      params: Schema.Types.Mixed,
      // EXECUTE_ACTION类型完成条件: result/error被设置
      result: String, // JSON.stringify
      error: String, // JSON.stringify
      // INTERNAL_ORDER类型完成条件：order done
      order: {
        type: Schema.Types.ObjectId,
        ref: consts.MODEL_NAMES.ORDER
      },
      started_at: Date, // 开始运行时间
      finished_at: Date // 结束运行时间
    }
  ],
  // 时间记录相关
  run_at: Date, // 执行计划, 不为null时为新任务
  started_at: Date, // 开始运行时间
  finished_at: Date // 结束运行时间
}, {
  timestamps: { createdAt: 'create_at', updatedAt: 'update_at' }
})

// Admin查询
schema.index({ source: 1, source_id: 1, mode: 1, result: 1 }, { name: 'planSources' })
// 代码查询
schema.index({ started_at: 1, status: 1, finished_at: 1 }, { name: 'planResult' })
schema.index({ run_at: 1 }, { name: 'planRunAt', sparse: true })

const Model = fetchConnection().model(consts.MODEL_NAMES.ASYNC_PLAN, schema)

module.exports = Model
