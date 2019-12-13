const _ = require('lodash')
const BaseAction = require('./action')

class Action extends BaseAction {
  /**
   * @param {string} fieldToCheck
   */
  constructor (ctx, fieldToCheck) {
    super('map_value', ctx)
    this._fieldToCheck = fieldToCheck || 'default'
    /**
     * @type {Map<string, string>}
     */
    this._mapper = new Map()
  }
  /**
   * @type {any}
   */
  get item () { return this.ctx.get(this._fieldToCheck) || {} }

  /**
   * @param {string} itemKeyField field in item object
   * @param {string|boolean} contextFieldName field map to context
   */
  mapValue (itemKeyField, contextFieldName = true) {
    if (_.isString(itemKeyField)) {
      this._mapper.set(itemKeyField, _.isString(contextFieldName) ? contextFieldName : itemKeyField)
    }
    return this
  }

  /**
   * 确保blackboard中存在以下字段：
   */
  async doBeforeExec () {
    return _.isObject(this.item) && !_.isEmpty(this.item)
  }

  /**
   * blackboard 将更新以下字段：
   * - 通过 mapValue 注册的 contextFieldName
   */
  async doExec () {
    const item = this.item
    for (const kvpair of this._mapper) {
      this.ctx.set(kvpair[1], item[kvpair[0]])
    }
    return true
  }
}

Action.default = Action
module.exports = Action
