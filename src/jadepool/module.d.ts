/**
 * Jadepool module
 */
declare class JadepoolModule {
  /**
   * @param name module name
   * @param parentPath module folder
   * @param parentScope module scope
   * @param impl module implment
   */
  constructor (name: string, parentPath: string, parentScope: string, impl: object);
  /**
   * module name
   */
  public name: string;
  /**
   * parent folder path
   */
  public parentPath: string;
  /**
   * config folder path
   */
  public configPath: string;
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
