const path = require('path')
const jp = require('../jadepool')
const BaseService = require('./core')
const consts = require('../consts')
// const logger = require('@jadepool/logger').of('Service', 'ErrorCode')

class ErrorCodeService extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.ERROR_CODE, services)
    /**
     * @type {Map<string, {code: number, category: string, locales: object}>}
     */
    this._errMap = new Map()
  }

  /**
   * 初始化
   * @param {Object} opts
   */
  async initialize (opts) {
    const cwdPath = process.cwd()
    const localePath = opts.localePath || jp.config.errorCodePath
    const filePath = path.resolve(cwdPath, localePath)
    const fileData = path.parse(filePath)

    const lineReader = require('readline').createInterface({ input: require('fs').createReadStream(filePath) })
    /**
     * @type {string[]}
     */
    let titleKeys
    lineReader.on('line', (line) => {
      const valueArray = line.split(',')
      const record = {
        code: undefined,
        category: undefined,
        locales: {}
      }
      if (fileData.ext === '.md') {
        if (!line.startsWith('*')) return
        record.code = parseInt(valueArray[0].substring(2))
        record.locales[consts.SUPPORT_LOCALES.ZH_CN] = valueArray[1].trim()
        record.category = valueArray[2] ? valueArray[2].trim() : undefined
      } else if (fileData.ext === '.csv') {
        // 设置title
        if (!titleKeys) {
          titleKeys = valueArray
          return
        }
        // Title Key
        for (let i = 0; i < valueArray.length; i++) {
          let lineKey = titleKeys[i] || 'default'
          let lineValue = valueArray[i]
          switch (lineKey) {
            case 'code':
              record.code = lineValue
              break
            case 'category':
              record.category = lineValue
              break
            default:
              record.locales[lineKey] = lineValue
              break
          }
        }
      }
      this._errMap.set(record.code.toString(), record)
    })
  }

  getErrObj (code, locale = consts.SUPPORT_LOCALES.ZH_CN) {
    const obj = this._errMap.get(code.toString())
    if (!obj) return { code, status: code }
    const localeMessage = obj.locales[locale] || obj.locales[consts.SUPPORT_LOCALES.ZH_CN]
    return {
      code: obj.code,
      status: obj.code,
      category: obj.category,
      message: localeMessage
    }
  }
}

module.exports = ErrorCodeService
