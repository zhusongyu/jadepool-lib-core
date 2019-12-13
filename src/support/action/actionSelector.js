const NBError = require('../NBError')
const BaseAction = require('./action')

const logger = require('@jadepool/logger').of('Action', 'Selector')

class Action extends BaseAction {
  /**
   * @param {string} fieldToCheck
   */
  constructor (ctx, fieldToCheck, defaultResult = false) {
    super('selector', ctx)
    this._fieldToCheck = fieldToCheck || 'default'
    /**
     * @type {Map<string, action.Action>}
     */
    this._selectorActions = new Map()
    /**
     * 未找到合适目标时的返回值
     */
    this._defaultResult = !!defaultResult
  }

  /**
   * 添加条件选项
   * @param {any} fieldValue
   * @param {action.Action} action
   */
  addCaseValue (fieldValue, one) {
    if (!(one instanceof BaseAction)) {
      throw new NBError(10001, `action should be instanceof Action`)
    }
    this._selectorActions.set(fieldValue, one)
    return this
  }

  /**
   * 选择并执行一个匹配的 action
   * 若未选择到，则返回 false
   */
  async doExec () {
    const fieldValue = this.ctx.get(this._fieldToCheck)
    const subAction = this._selectorActions.get(fieldValue)
    if (subAction !== undefined && (subAction instanceof BaseAction)) {
      return subAction.exec()
    } else {
      logger.debug(`no matching [${this._fieldToCheck}]: ${fieldValue}`)
      return this._defaultResult
    }
  }
}

Action.default = Action
module.exports = Action
