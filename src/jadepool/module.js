const fs = require('fs')
const path = require('path')

/**
 * Jadepol module
 */
class JadepoolModule {
  /**
   * @param {string} name
   */
  constructor (name, parentPath, parentScope, impl) {
    if (typeof name !== 'string' || typeof parentPath !== 'string') throw new Error('missiing parameter')

    Object.defineProperties(this, {
      name: { value: name, writable: false, enumerable: true },
      parentPath: { value: parentPath, writable: false, enumerable: true },
      parentScope: { value: parentScope, writable: false, enumerable: true }
    })
    const cfgPath = path.resolve(parentPath, name, 'config')
    if (fs.existsSync(cfgPath)) {
      Object.defineProperty(this, 'configPath', { value: cfgPath, writable: false, enumerable: true })
    }
    if (typeof impl === 'object') {
      Object.defineProperty(this, '_invokeMethod', {
        value: typeof impl.methods === 'function' ? impl.methods : function () {},
        writable: false,
        enumerable: false
      })
    }
  }

  get configRaw () {
    const cfgPath = this.configPath
    if (typeof cfgPath !== 'string') return {}
    const jp = require('.')
    return jp.config && jp.config.util ? jp.config.util.loadFileConfigs(cfgPath) : {}
  }

  /**
   * 模块方法调用
   */
  async invokeMethod () {
    return this._invokeMethod.apply(this, arguments)
  }
}

JadepoolModule.default = JadepoolModule
module.exports = JadepoolModule
