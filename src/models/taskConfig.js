const _ = require('lodash')
const mongoose = require('mongoose')
const consts = require('../consts')
const { fetchConnection } = require('../utils/db')

const schema = new mongoose.Schema({
  name: { type: String, require: true },
  server: {
    type: String,
    enum: _.values(consts.SERVER_TYPES),
    required: true
  },
  jobtype: {
    type: String,
    enum: _.values(consts.JOB_TYPES),
    default: 'every',
    require: true
  },
  seconds: {
    type: Number,
    default: -1
  },
  cron: {
    type: String,
    default: null
  },
  data: Object,
  // 状态参数
  working: { type: Boolean, default: false },
  paused: { type: Boolean, default: false }
}, {
  timestamps: { createdAt: 'create_at', updatedAt: 'update_at' }
})

schema.index({ create_at: -1 })
schema.index({ server: 1, working: -1 })
schema.index({ name: 1 })
schema.index({ server: 1, name: 1 }, { unique: true })

const TaskConfig = fetchConnection().model(consts.MODEL_NAMES.TASK_CONFIG, schema)
module.exports = TaskConfig
