import Context from './context';

declare class Action {
  constructor(name: string, ctx: Context);
  /**
   * Action 名称
   */
  name: string;
  /**
   * 上下文
   */
  ctx: Context;
  /**
   * 是否执行状态中
   */
  isExecuting: boolean;
  /**
   * 执行 Action
   */
  exec(): Promise<boolean>;
  // ------- Methods can be overrided -------
  /**
   * 必须重载
   */
  doExec(): Promise<boolean>
  /**
   * 该函数内仅查询不可作出修改
   */
  doBeforeExec(): Promise<boolean>;
  /**
   * 成功
   */
  doAfterSuccess(): Promise<void>;
  /**
   * 失败
   */
  doAfterFailure(): Promise<void>;
}

export = Action;
