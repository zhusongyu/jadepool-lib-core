const _ = require('lodash')
const mongoose = require('mongoose')
const consts = require('../consts')
const { fetchConnection } = require('../utils/db')

const schema = new mongoose.Schema({
  level: {
    type: String,
    enum: _.values(consts.WARN_LEVEL),
    default: consts.WARN_LEVEL.WARNING,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  module: {
    type: String,
    required: false
  },
  message: {
    type: String,
    required: true
  }
}, {
  timestamps: { createdAt: 'create_at', updatedAt: 'update_at' }
})

schema.index({ create_at: -1 })

schema.index({ level: 1 })
schema.index({ level: 1, category: 1, module: 1 })

const Warning = fetchConnection().model(consts.MODEL_NAMES.WARNING, schema)
Warning.prototype.toClientObject = function () {
  const obj = this.toObject()
  obj.id = String(obj._id)
  delete obj._id
  return obj
}
module.exports = Warning
