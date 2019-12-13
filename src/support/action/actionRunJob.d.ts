import Context from './context';
import Action from './action';

declare class ActionRunJob extends Action {
  /**
   * 根据 blackboard 中的参数启动 job
   * @param ctx 上下文
   */
  constructor (ctx: Context);
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
