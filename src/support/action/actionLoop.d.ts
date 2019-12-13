import Context from './context';
import Action from './action';

declare class ActionLoop extends Action {
  constructor (ctx: Context, fieldToCheck: string, actionToRun: Action);
  items: any[]
  /**
   * 重载执行内容
   */
  doExec(): Promise<boolean>
}

export = ActionLoop;
