import Context from './context';
import Action from './action';

declare class ActionLoop extends Action {
  /**
   * Loop 中 blackboard 将更新以下字段：
   * - fieldToCheck + '_item' 当前运行时设置的单位
   * 运行中检测
   * - fieldToCheck + '_break' 当前运行时检测到break，则停止运行
   * @param ctx 上下文
   * @param fieldToCheck 检测的目标 key
   * @param actionToRun 循环执行的 action 
   */
  constructor (ctx: Context, fieldToCheck: string, actionToRun: Action);
  items: any[]
  /**
   * 重载执行内容
   */
  doExec(): Promise<boolean>
}

export = ActionLoop;
