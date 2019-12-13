import Context from './context';
import Action from './action';

declare class ActionMapValue extends Action {
  constructor (ctx: Context, fieldToCheck: string);
  item: any
  /**
   * map item's value to context's key
   * @param itemKeyField field in item object
   * @param contextFieldName field map to context
   */
  mapValue (itemKeyField: string, contextFieldName: string): ActionMapValue
  /**
   * 重载执行内容
   */
  doExec(): Promise<boolean>
}

export = ActionMapValue;
