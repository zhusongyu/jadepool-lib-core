const _ = require('lodash')
const cluster = require('cluster')
const consts = require('../consts')

// 强行设置可调用不安全的HTTPS
if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}
// 默认环境为dev
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'dev'
}

/**
 * 构建Env对象
 * @param {string} serverType
 * @param {string} version
 */
module.exports = function buildEnvObject (serverType, version) {
  // 根据process.env生成envOpts
  const envOpts = Object.keys(process.env).filter(key => {
    return /^jp_/i.test(key)
  }).reduce(function (obj, key) {
    // camel-case
    var prop = _.camelCase(key.substring(3))

    // coerce string value into JS value
    var val = process.env[key]
    if (/^(yes|on|true|enabled)$/i.test(val)) val = true
    else if (/^(no|off|false|disabled)$/i.test(val)) val = false
    else if (val === 'null') val = null
    else if (/^\d+$/i.test(val) && !isNaN(parseInt(val))) val = parseInt(val)

    obj[prop] = val
    return obj
  }, {
    script: require.main.filename || process.env.JP_SCRIPT, // 可通过环境变量 JP_SCRIPT 覆盖
    host: '127.0.0.1', // 可通过环境变量 JP_HOST 覆盖，本服务使用的host
    defaultConsul: 'http://127.0.0.1:8500', // 可通过环境 JP_DEFAULT_CONSUL 覆盖，服务发现的host地址
    defaultMongo: '127.0.0.1:27017', // 可通过环境变量 JP_DEFAULT_MONGO 覆盖
    defaultRedis: '127.0.0.1:6379', // 可通过环境变量 JP_DEFAULT_REDIS 覆盖
    secret: 'JadePoolSeCreT', // 可通过环境变量 JP_SECRET 覆盖，用于内部私钥
    mode: undefined, // 可通过环境变量 JP_MODE 覆盖
    param: undefined, // 可通过环境变量 JP_PARAM 覆盖
    autoStart: true, // 可通过环境变量 JP_AUTO_START 覆盖, 设置后worker将自动启动
    multiWorkers: false // 可通过环境变量 JP_MULTI_WORKERS 覆盖，设置是否支持多同链多Worker模式
  })

  // 设置process相关变量
  let launchMode, processType
  if (cluster.isMaster && (!envOpts.mode || envOpts.mode === 'app')) {
    if (!envOpts.param || envOpts.param === 'master') {
      launchMode = consts.PROCESS.LAUNCH_MODES.MASTER
      processType = consts.PROCESS.TYPES.ROUTER
    } else {
      launchMode = consts.PROCESS.LAUNCH_MODES.AGENT
      processType = consts.PROCESS.TYPES.ROUTER_SUB
    }
  } else {
    launchMode = consts.PROCESS.LAUNCH_MODES.WORKER
    if (envOpts.param === 'general') {
      processType = consts.PROCESS.TYPES.GENERAL
    } else {
      processType = consts.PROCESS.TYPES.BLOCKCHAIN
    }
  }
  // 进程参数
  const processPrefix = envOpts.param ? envOpts.param.toLowerCase() + '.' : ''
  const processKey = `${processType}-${serverType}-${processPrefix}${process.pid}`
  const instanceId = process.env.NODE_APP_INSTANCE || process.env.NODE_INSTANCE_ID || '0'

  return _.assign({
    name: process.env.NODE_ENV,
    instanceId: parseInt(instanceId),
    isProd: process.env.NODE_ENV === 'production',
    eccEnabled: ['staging', 'production'].indexOf(process.env.NODE_ENV) > -1,
    server: serverType,
    version: version,
    launchMode,
    processKey,
    processType,
    processPrefix
  }, envOpts)
}
