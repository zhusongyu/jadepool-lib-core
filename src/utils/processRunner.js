const uuid = require('uuid')
const EventEmitter = require('events').EventEmitter
const cp = require('child_process')

const logger = require('@jadepool/logger').of('ProcessRunner')

class ProcessRunner {
  constructor (name, execPath, env) {
    this._name = name
    this._execPath = execPath
    this._env = env
    this._requests = new Map()
    this._forkChildProcess()
    // 父进程退出时杀死所有子进程
    const processExit = (code) => {
      let pid
      if (this._ins) {
        pid = this._ins.pid
        this._ins.removeAllListeners()
        this._ins.kill()
      }
      logger.tag(this._name, `(${pid})exit`).log(`code=${code}`)
    }
    process.once('SIGQUIT', processExit)
    process.once('SIGTERM', processExit)
    process.once('SIGINT', processExit)
  }

  /**
   * @returns {cp.ChildProcess}
   */
  get childInstance () {
    if (!this._ins || !this._ins.connected) {
      this._forkChildProcess()
    }
    return this._ins
  }

  _forkChildProcess () {
    this._ins = cp.fork(this._execPath, [], {
      cwd: this._execPath,
      env: this._env
    })
    this._ins.on('exit', (code, signal) => {
      logger.tag(this._name, `(${this._ins.pid})exit`).log(`code=${code},signal=${signal}`)
      if (code !== 0) {
        this._forkChildProcess()
      }
    })
    this._ins.on('message', result => {
      if (!result.id) return
      const emitter = this._requests.get(result.id)
      if (!emitter) return
      if (result.error) {
        emitter.emit('error', result.error)
      } else {
        emitter.emit('response', result.result)
      }
    })
    logger.tag(this._name, `forked`).log(`pid=${this._ins.pid}`)
    return this._ins
  }

  /**
   * 发起请求
   * @param {string} method
   * @param {any[]} params
   */
  async request (method, params) {
    const reqData = { id: uuid.v4(), method, params }
    const emitter = new EventEmitter()
    this._requests.set(reqData.id, emitter)
    // 移除Emitter依赖
    const cleanup = () => {
      emitter.removeAllListeners()
      this._requests.delete(reqData.id)
    }
    // 发起并等待请求
    const n = this.childInstance
    return new Promise((resolve, reject) => {
      // 超时定义
      const timeoutMs = 2 * 1000
      const timeout = setTimeout(() => reject(new Error('timeout')), timeoutMs)
      // 发起请求
      n.send(reqData)
      // 监听回调
      emitter.once('response', data => {
        clearTimeout(timeout)
        resolve(data)
      })
      emitter.once('error', data => {
        clearTimeout(timeout)
        reject(data)
      }) // reject将自动throw error
    }).then(result => {
      cleanup()
      return result
    }).catch(err => {
      cleanup()
      return Promise.reject(err)
    })
  }
}

module.exports = ProcessRunner
