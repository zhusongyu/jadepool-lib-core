const _ = require('lodash')

/**
 * Jadepol module
 */
class JadepoolModule {
  /**
   * @param {string} name
   */
  constructor (name, parentScope, impl, cfg = {}) {
    if (typeof name !== 'string' || typeof parentScope !== 'string') throw new Error('missing parameter')

    Object.defineProperties(this, {
      name: { value: name, writable: false, enumerable: true },
      scope: { value: parentScope, writable: false, enumerable: true },
      impl: { value: impl || {}, writable: false, enumerable: false },
      configRaw: { value: _.clone(cfg), writable: false, enumerable: false },
      _invokeMethod: {
        value: typeof impl === 'object' && impl !== null && typeof impl.methods === 'function' ? impl.methods : function () {},
        writable: false,
        enumerable: false
      }
    })
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
