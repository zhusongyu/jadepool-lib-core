/**
 * Jadepool module
 */
declare class JadepoolModule {
  /**
   * @param name module name
   * @param parentScope module scope
   * @param impl module implment
   */
  constructor (name: string, parentScope: string, impl: object, cfg?: object);
  /**
   * module name
   */
  public name: string;
  /**
   * module scope
   */
  public scope: string;
  /**
   * raw config from folder
   */
  public configRaw: object;
	/**
	 * 进行Methods调用
	 */
	invokeMethod(methodName: string, namespace: string | null, args: object, ...others: any): Promise<any>;
}

export = JadepoolModule;
