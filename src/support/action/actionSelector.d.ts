import Context from './context';
import Action from './action';

declare class ActionSelector extends Action {
  constructor (ctx: Context, fieldToCheck: string);
  /**
   * 添加条件选项
   * @param fieldValue
   * @param action
   */
  addCaseValue (fieldValue: string, action: Action): ActionSelector
  /**
   * 重载执行内容
   */
  doExec(): Promise<boolean>
}

export = ActionSelector;
