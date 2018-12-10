const jp = require('../jadepool')
const consts = require('../consts')

const logger = require('@jadepool/logger').of('Service', 'Script')

class Service extends jp.BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.SCRIPT, services)
  }

  /**
   * @param {Object} opts 参数
   * @param {String|Function} [opts.onStartup] 初始化脚本
   * @param {String|Function} [opts.onExit] 退出脚本
   */
  async initialize (opts) {
    this.opts = opts
    // 启动脚本
    await this.runScript('onStartup')
  }

  /**
   * 该Service的优雅退出函数
   * @returns {Promise}
   */
  async onDestroy () {
    // 退出脚本
    await this.runScript('onExit')
  }

  /**
   * @param {String} name 脚本名
   */
  async runScript (name) {
    const scriptParam = this.opts[name]
    if (!scriptParam) return

    logger.diff('Run').log(`name.begin=${name}`)
    let scriptFunc
    if (typeof scriptParam === 'function') {
      scriptFunc = scriptParam
    } else if (typeof scriptParam === 'string') {
      scriptFunc = jp.invokeMethod.bind(jp, scriptParam)
    } else {
      return
    }
    let result
    try {
      result = await scriptFunc()
    } catch (err) {}
    logger.diff('Run').log(`name.end=${name}`)
    return result
  }
}

module.exports = Service
