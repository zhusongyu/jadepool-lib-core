const _ = require('lodash')

/**
 * Jadepol module
 */
class JadepoolModule {
  /**
   * @param {string} name
   */
  constructor (name, parentScope, impl, cfg = {}) {
    if (typeof name !== 'string' || typeof parentPath !== 'string') throw new Error('missiing parameter')

    Object.defineProperties(this, {
      name: { value: name, writable: false, enumerable: true },
      scope: { value: parentScope, writable: false, enumerable: true },
      impl: { value: impl || {}, writable: false, enumerable: false },
      configRaw: { value: _.clone(cfg), writable: false, enumerable: false }
    })
    if (typeof impl === 'object') {
      Object.defineProperty(this, '_invokeMethod', {
        value: typeof impl.methods === 'function' ? impl.methods : function () {},
        writable: false,
        enumerable: false
      })
    }
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
