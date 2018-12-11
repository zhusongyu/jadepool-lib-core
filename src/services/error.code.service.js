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
  }

  async initialize () {
    this._errMap = new Map()

    const cwdPath = process.cwd()
    const pt = path.resolve(cwdPath, jp.config.errorCodePath)
    const lineReader = require('readline').createInterface({ input: require('fs').createReadStream(pt) })

    lineReader.on('line', (line) => {
      if (line.startsWith('*')) {
        const linesp = line.split(',')
        const status = parseInt(linesp[0].substring(2))
        const message = linesp[1].trim()
        const category = linesp[2] ? linesp[2].trim() : null

        this._errMap.set(status, category === null ? { status, message } : { status, message, category })
      }
    })

    lineReader.on('close', () => {
      // this._errMap.forEach((value, key, m) => console.log(_.assign(value)))
    })
  }

  getErrObj (code) {
    const obj = this._errMap.get(code)
    return obj || { status: 10001, message: 'system error' }
  }
}

module.exports = ErrorCodeService
