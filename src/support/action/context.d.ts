
declare class ActionContext {
  constructor(data);
  destroy(): Promise<void>
  /**
   * get value in blockboard
   */
  get<T>(name: string, defaultValue: T): T;
  /**
   * set value in blockboard
   */
  set<T>(name: string, value: T): void;
  /**
   * 该上下文log
   */  
  logKey: string
  // ================= 需要重载的函数 =================
  /**
   * 必须重载
   */
  initialize (): Promise<void>
  /**
   * 可选
   */
  onDestroy (): Promise<void>
}

export = ActionContext;
