const fs = require('fs')
const BaseService = require('./core')
const consts = require('../consts')
const ProcessRunner = require('../utils/processRunner')

// const logger = require('@jadepool/logger').of('Service', 'Process')

class Service extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.CHILD_PROCESS, services)
  }

  /**
   * 初始化
   * @param {Object} opts
   */
  async initialize (opts) {
    /**
     * @type {Map<string, ProcessRunner>}
     */
    this.children = new Map()
  }

  /**
   * 该Service的优雅退出函数
   * @param signal 退出信号
   */
  async onDestroy (signal) {
    // 父进程退出时杀死所有子进程
    await Promise.all([...this.children].map(async keypair => keypair[1].onDestroy(signal)))
  }

  /**
   * 创建或获取一个常驻的子进程
   */
  forkNamedProcess (name, execPath, env) {
    let cp = this.children.get(name)
    if (!cp) {
      if (typeof execPath !== 'string') return null
      if (!fs.existsSync(execPath)) return null
      cp = new ProcessRunner(name, execPath, env)
      this.children.set(name, cp)
    }
    return cp
  }

  /**
   * 调用子进程方法(jsonrpc形式)
   */
  async requestChild (name, method, params) {
    let cp = this.children.get(name)
    if (!cp) return null
    return cp.request(method, params)
  }
}

module.exports = Service
