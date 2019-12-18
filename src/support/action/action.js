const NBError = require('../NBError')

const ContextBase = require('./context')

const logger = require('@jadepool/logger').of('Action')

class Action {
  constructor (name, ctx) {
    this['_name'] = typeof name === 'string' ? name : 'default'
    if (!(ctx instanceof ContextBase)) {
      throw new NBError(10001, `ctx should be instanceof ContextBase.`)
    }
    this['_ctx'] = ctx
    this['_isExecuting'] = false
  }
  /**
   * @type {String}
   */
  get name () { return this._name }
  /**
   * @type {ContextBase}
   */
  get ctx () { return this._ctx }
  /**
   * @type {boolean}
   */
  get isExecuting () { return this._isExecuting }

  /**
   * 运行Action
   * @returns {Promise<boolean>}
   */
  async exec () {
    if (this.isExecuting) return false
    this['_isExecuting'] = true
    let isOk = false
    // --- before ---
    try {
      isOk = await this.doBeforeExec()
    } catch (err) {
      logger.tag('Before-exec').error(err)
    }
    // failed to exec before but ok
    if (isOk) {
      // --- do ---
      try {
        isOk = await this.doExec()
      } catch (err) {
        isOk = false
        logger.tag('Exec').error(err)
      }
      // --- after ---
      try {
        if (isOk) {
          await this.doAfterSuccess()
        } else {
          await this.doAfterFailure()
        }
      } catch (err) {
        logger.tag('After-exec').error(err)
      }
    }
    this['_isExecuting'] = false
    return isOk
  }

  // ------- Methods can be overrided -------
  /**
   * 该函数内仅查询不可作出修改
   */
  async doBeforeExec () {
    // YOU SHOULD ENSURE SOME VARIBLES IN BLOCKBOARD
    return true
  }
  /**
   * 该函数内可以有所修改
   */
  async doExec () {
    throw new NBError(20205, `method[doExec] need to be overrided`)
  }
  async doAfterSuccess () {
    // NOTHING
  }
  async doAfterFailure () {
    // NOTHING
  }
}

Action.default = Action
module.exports = Action
