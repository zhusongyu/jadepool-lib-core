import Context from './context';
import Action from './action';

declare class ActionSelector extends Action {
  /**
   * 根据 fieldToCheck 执行相应的 action
   * @param ctx 上下文
   * @param fieldToCheck 检测的目标 key
   * @param defaultResult 未找到合适目标时的返回值
   */
  constructor (ctx: Context, fieldToCheck: string, defaultResult?: boolean);
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
