const _ = require('lodash')
const url = require('url')
const mongoose = require('mongoose')
const AutoIncrement = require('mongoose-sequence')(mongoose)
const jp = require('../jadepool')
const consts = require('../consts')

const logger = require('@jadepool/logger').of('MongoDB Connector')

// mongoose Promise setup
mongoose.Promise = global.Promise

// 通用Mongo连接配置
const mongoOptions = {
  reconnectTries: Number.MAX_VALUE,
  reconnectInterval: 10 * 1000,
  autoReconnect: true,
  useNewUrlParser: true
}
const connMap = new Map()

const getUri = (dbKey = consts.DEFAULT_KEY) => {
  let mongoUrl
  // 从config配置中读取mongo
  if (jp.config.mongo) {
    if (_.isString(jp.config.mongo)) {
      mongoUrl = jp.config.mongo
    } else if (_.isObject(jp.config.mongo)) {
      mongoUrl = jp.config.mongo[dbKey] || jp.config.mongo[consts.DEFAULT_KEY]
    }
  }
  // dev环境中，若无法获得地址则使用默认数据
  if (!mongoUrl && !jp.env.isProd) {
    mongoUrl = `mongodb://${jp.env.defaultMongo}/jadepool-${jp.env.name}`
  }
  // 报错
  if (!mongoUrl) {
    const err = new Error()
    logger.error(`Missing mongo url for ${dbKey}`, err)
    throw err
  }
  return mongoUrl
}

/**
 * 初始化默认数据库连接
 * @param {String} dbKey 数据库关键字
 */
const initialize = async () => {
  // 连接默认配置
  try {
    const mongoUrl = getUri(consts.DEFAULT_KEY)
    await mongoose.connect(mongoUrl, mongoOptions)
    const urlObj = new url.URL(mongoUrl)
    logger.tag('Connected').log(`url.host=${urlObj.host},url.path=${urlObj.pathname}`)
  } catch (err) {
    logger.tag('Initialization-failed').error(err)
  }
}

/**
 * 获取数据库连接
 * @param {String} dbKey
 * @param {Function} callback
 * @returns {mongoose.Connection && {then:Function, catch:Function}}
 */
const fetchConnection = (dbKey = consts.DEFAULT_KEY) => {
  if (dbKey === consts.DEFAULT_KEY) {
    return mongoose
  }
  let conn = connMap.get(dbKey)
  if (!conn) {
    // 新建连接
    conn = mongoose.createConnection(getUri(dbKey), mongoOptions)
    connMap.set(dbKey, conn)
  }
  return conn
}

// 导出方法
module.exports = {
  initialize,
  getUri,
  fetchConnection,
  // 导出类
  mongoose,
  AutoIncrement
}
