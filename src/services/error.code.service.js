const path = require('path')
const { promisify } = require('util')
const jp = require('../jadepool')
const BaseService = require('./core')
const consts = require('../consts')
const redis = require('../utils/redis')

const logger = require('@jadepool/logger').of('Service', 'ErrorCode')

const REDIS_ERROR_CODE_PREFIX = 'JADEPOOL_SERVICE:ERROR_CODE:'

class ErrorCodeService extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.ERROR_CODE, services)
  }

  /**
   * 初始化
   * @param {Object} opts
   * @param {Boolean} [opts.isHost=false]
   * @param {String} [opts.localePath=undefined]
   */
  async initialize (opts) {
    const redisClientKey = 'ErrorCodeRedisClient'
    // 确保redis配置正常, 若无法获取该方法将throw error
    this.redisClient = redis.fetchClient(redisClientKey)
    await new Promise(resolve => this.redisClient.once('state_change', resolve))

    // 从文件中读取error code, 并写入redis
    if (opts.isHost) {
      const cwdPath = process.cwd()
      const localePath = opts.localePath || jp.config.errorCodePath
      const filePath = path.resolve(cwdPath, localePath)
      const fileData = path.parse(filePath)

      const lineReader = require('readline').createInterface({ input: require('fs').createReadStream(filePath) })
      let counter = 0
      /**
       * @type {string[]}
       */
      let titleKeys
      lineReader.on('line', (line) => {
        const valueArray = line.split(',')
        const record = {
          code: undefined,
          category: 'default'
        }
        if (fileData.ext === '.md') {
          if (!line.startsWith('*')) return
          record.code = parseInt(valueArray[0].substring(2))
          record.category = valueArray[2] ? valueArray[2].trim() : undefined
          record[consts.SUPPORT_LOCALES.ZH_CN] = valueArray[1].trim()
        } else if (fileData.ext === '.csv') {
          // 设置title
          if (!titleKeys) {
            titleKeys = valueArray
            return
          }
          // Title Key
          for (let i = 0; i < valueArray.length; i++) {
            let lineKey = titleKeys[i] || 'default'
            record[lineKey] = valueArray[i]
          }
        }
        // Set to redis
        const key = REDIS_ERROR_CODE_PREFIX + record.code
        this.redisClient.HMSET(key, record)
        counter++
      })
      // wait for readline
      await new Promise(resolve => lineReader.once('close', resolve))
      logger.info(`total.errors=${counter}`)
    }
  }

  async getErrorInfo (code, locale = consts.SUPPORT_LOCALES.ZH_CN) {
    const ret = { code, message: '' }
    if (!this.redisClient.connected) {
      logger.warn(`redisClient is not connected`)
      return ret
    }
    const hmgetAsync = promisify(this.redisClient.HMGET).bind(this.redisClient)
    const key = REDIS_ERROR_CODE_PREFIX + code

    const defaultLocale = consts.SUPPORT_LOCALES.ZH_CN
    const fields = ['category', locale]
    if (locale !== defaultLocale) {
      fields.push(defaultLocale)
    }
    const results = await hmgetAsync(key, fields)
    if (!results || results.length === 0) return ret
    ret.code = typeof code === 'string' ? parseInt(code) : code
    ret.category = results[0]
    ret.message = results[1] || results[2]
    return ret
  }
}

module.exports = ErrorCodeService
