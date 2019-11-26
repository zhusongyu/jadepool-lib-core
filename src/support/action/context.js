const NBError = require('../NBError')

class ActionContext {
  constructor (data) {
    /**
     * @type {Map<String, any>}
     */
    const blackboard = new Map()
    for (const key in data) {
      if (data.hasOwnProperty(key) && typeof key === 'string') {
        blackboard.set(key, data[key])
      }
    }
    this.blackboard = blackboard
  }
  async destroy () {
    this.blackboard.clear()
    await this.onDestroy()
  }
  /**
   * get value in blockboard
   * @param {string} name
   */
  get (name, defaultValue) {
    return this.blackboard.get(name) || defaultValue
  }
  /**
   * set value in blockboard
   * @param {string} name
   * @param {any} value
   */
  set (name, value) {
    if (typeof value !== 'undefined') {
      this.blackboard.set(name, value)
    }
  }

  get logKey () { return 'ActionContext' }
  /**
   * 若返回false则初始化失败
   * @returns {Promise<boolean>}
   */
  async initialize () {
    throw new NBError(20205, 'missing initiialize implement.')
  }
  async onDestroy () {
    // NOTHING
  }
}

ActionContext.default = ActionContext
module.exports = ActionContext
