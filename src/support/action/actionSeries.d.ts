import Context from './context';
import Action from './action';

declare class ActionSeries extends Action {
  constructor (ctx: Context, actions: Action[]);
  /**
   * 重载执行内容
   */
  doExec(): Promise<boolean>
}

export = ActionSeries;
