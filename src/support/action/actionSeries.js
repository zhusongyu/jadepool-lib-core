const Action = require('./action')

const logger = require('@jadepool/logger').of('Action', 'Series')

class ActionSeries extends Action {
  /**
   * @param {Action[]} actions
   */
  constructor (ctx, actions) {
    super('series', ctx)
    /**
     * @type {Action[]}
     */
    this._actions = []
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      if (action instanceof Action) {
        this._actions.push(action)
      }
    } // end for
  }

  async doExec () {
    let isOk = true
    // 按顺序执行action
    let i
    const len = this._actions.length
    for (i = 0; i < len; i++) {
      const action = this._actions[i]
      if (action.isExecuting) {
        isOk = false
        break
      }
      isOk = isOk && (await action.exec())
      logger.debug(`ctx=${this.ctx.logKey},action.run=${i + 1}/${len},curr.name=${action.name}`)
      if (!isOk) break
    } // end for
    if (len !== i) {
      logger.debug(`ctx=${this.ctx.logKey},action.break=${i}/${len}`)
    }
    return isOk
  }
}

ActionSeries.default = ActionSeries
module.exports = ActionSeries
