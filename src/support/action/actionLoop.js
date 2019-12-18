const _ = require('lodash')
const NBError = require('../NBError')
const utils = require('../../utils')
const BaseAction = require('./action')

const logger = require('@jadepool/logger').of('Action', 'Loop')

class Action extends BaseAction {
  /**
   * @param {string} fieldToCheck
   * @param {BaseAction} actionToRun
   */
  constructor (ctx, fieldToCheck, actionToRun) {
    super('loop', ctx)
    this._fieldToCheck = fieldToCheck || 'default'
    if (!(actionToRun instanceof BaseAction)) {
      throw new NBError(10001, `actionToRun should be action`)
    }
    this._actionToRun = actionToRun
  }
  /**
   * @type {any[]}
   */
  get items () { return this.ctx.get(this._fieldToCheck) }

  /**
   * 确保blackboard中存在以下字段：
   */
  async doBeforeExec () {
    const arr = this.ctx.get(this._fieldToCheck)
    return _.isArray(arr) && arr.length > 0
  }

  /**
   * blackboard 将更新以下字段：
   * - this._fieldToCheck + '_item' 当前运行时设置的单位
   * 运行中检测
   * - this._fieldToCheck + '_break' 当前运行时检测到break，则停止运行
   */
  async doExec () {
    const logKey = this.ctx.logKey + `$${this._fieldToCheck}`
    const itemKey = this._fieldToCheck + '_item'
    const loopBreak = this._fieldToCheck + '_break'
    let isOk = true
    const startAt = Date.now()
    const logProgress = [20, 40, 60, 80]
    // 按顺序执行action
    let i
    const len = this.items.length
    logger.tag(logKey).debug(`for.action=${this._actionToRun.name},times=${len}`)
    for (i = 0; i < len; i++) {
      while (this._actionToRun.isExecuting) {
        await utils.waitForSeconds(0.1)
      }
      this.ctx.set(itemKey, this.items[i])
      await this._actionToRun.exec()
      // progress log
      const progress = Math.floor((i + 1) / len * 100)
      const progressLv = Math.floor(progress / 20)
      if (logProgress[progressLv] || progress >= 95) {
        logProgress[progressLv] = null
        logger.tag(logKey).debug(`action.run=${i + 1}/${len},progress=${progress}%`)
      }
      if (this.ctx.get(loopBreak)) {
        isOk = false
        logger.tag(logKey).debug(`action.break!`)
        break
      }
    } // end for
    const usedTime = Date.now() - startAt
    if (usedTime >= 10000) {
      logger.tag(logKey).warn(`cost=${usedTime / 1000}s`)
    }
    return isOk
  }
}

Action.default = Action
module.exports = Action
