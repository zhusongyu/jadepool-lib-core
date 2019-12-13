import Context from './context';
import Action from './action';

declare class ActionRunJob extends Action {
  constructor (ctx: Context, fieldToCheck: string);
  /**
   * job name
   */
  jobName: string
  /**
   * job messages
   */
  msgs: {uid: string}[]
  /**
   * job delay time
   */
  delay: number
  /**
   * job priority
   */
  priority: number
  /**
   * 重载执行内容
   */
  doExec(): Promise<boolean>
}

export = ActionRunJob;
