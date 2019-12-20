const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const { promisify, format } = require('util')
const redis = require('./redis')
const NBError = require('../support/NBError')
const consts = require('../consts')

const logger = require('@jadepool/logger').of('Utils', 'CSVLocales')

const LOCALE_REDIS_CLIENT = 'LocaleCodeRedisClient'
const DEFAULT_LOCALE_REDIS_KEY = 'JADEPOOL_SERVICE:LOCALES:'

async function getRedisClient () {
  // 确保redis配置正常, 若无法获取该方法将throw error
  const redisClient = redis.fetchClient(LOCALE_REDIS_CLIENT)
  if (!redisClient.connected) {
    await new Promise(resolve => redisClient.once('state_change', resolve))
    if (!redisClient.connected) {
      throw new NBError(50000, `failed to connect redis for ${LOCALE_REDIS_CLIENT}`)
    }
  }
  return redisClient
}

const csvLocales = {
  /**
   * 将 locale 加载到 redis
   * @param {string} localeFilePath
   */
  async loadCsvLocales (localeFilePath, redisKeyPrefix = DEFAULT_LOCALE_REDIS_KEY) {
    const redisClient = await getRedisClient()

    const cwdPath = process.cwd()
    const filePath = path.resolve(cwdPath, localeFilePath)
    if (!fs.existsSync(filePath)) {
      throw new NBError(10001, `missing file at ${localeFilePath}.`)
    }
    const fileData = path.parse(filePath)
    if (fileData.ext !== '.csv') {
      throw new NBError(10001, `only support .csv for locale file.`)
    }

    const lineReader = require('readline').createInterface({ input: fs.createReadStream(filePath) })
    const mergeKeys = {}
    let counter = 0
    /**
     * @type {string[]}
     */
    let titleKeys
    lineReader.on('line', (line) => {
      const valueArray = line.split(',')
      // 设置title
      if (!titleKeys) {
        titleKeys = valueArray
        // build grouped key
        for (const key of valueArray) {
          const grouped = key.split('_')
          if (grouped.length === 2) {
            const groupName = grouped[0]
            mergeKeys[groupName] = mergeKeys[groupName] || []
            mergeKeys[groupName].push(grouped[1])
          }
        }
        return
      }
      const record = {
        code: undefined,
        category: consts.DEFAULT_KEY
      }
      // Title Key
      for (let i = 0; i < valueArray.length; i++) {
        let lineKey = titleKeys[i] || consts.DEFAULT_KEY
        record[lineKey] = valueArray[i]
      }
      // apply merged key
      _.each(mergeKeys, (mergeFields, key) => {
        record[key] = _.map(mergeFields || [], oneField => record[oneField]).filter(v => !!v).join('.')
      })
      // only add records with code
      if (record.code !== undefined) {
        // Set to redis
        const key = redisKeyPrefix + record.code
        redisClient.HMSET(key, record)
        counter++
      }
    })
    // wait for readline
    await new Promise(resolve => lineReader.once('close', resolve))
    logger.info(`locale.prefix=${redisKeyPrefix},items.total=${counter}`)
  },
  /**
   * 从 redis 中获取 locale 信息
   */
  async getLocaleData (code, params = [], locale = consts.SUPPORT_LOCALES.ZH_CN, redisKeyPrefix = DEFAULT_LOCALE_REDIS_KEY) {
    const redisClient = await getRedisClient()

    const ret = { code, message: '' }
    const hmgetAsync = promisify(redisClient.HMGET).bind(redisClient)
    const key = redisKeyPrefix + code

    const defaultLocale = consts.SUPPORT_LOCALES.ZH_CN
    const fields = ['category', locale]
    if (locale !== defaultLocale) {
      fields.push(defaultLocale)
    }
    const results = await hmgetAsync(key, fields)
    // if not found, return empty
    if (!results || results.length === 0) return ret
    // 设置返回结果
    ret.category = results[0]
    const codeNum = _.toNumber(code)
    if (_.isNumber(codeNum)) {
      ret.code = codeNum
    }
    let message = results[1] || results[2]
    if (params.length !== 0) {
      // replace printf like
      message = format(message, ...params)
      // replace i18n msg
      for (let i = 0; i < params.length; i++) {
        message = message.replace(`{${i}}`, params[i])
      }
    }
    ret.message = message
    return ret
  }
}

module.exports = csvLocales
