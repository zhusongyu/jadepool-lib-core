import BaseService = require('../services/core')

/**
 * Jadepool上下文
 */
declare class JadePoolContext {
	/**
	 * 上下文构造函数
	 * @param serverType 服务类型名
	 * @param version semver版本号
	 * @param invokeMethodFunc invokeMethod函数
	 * @param configObj 配置文件对象
	 */
	constructor (serverType: string, version: string, invokeMethodFunc: Function, configObj : object);
		
	/**
	 * 注册服务
	 * @param serviceClass 
	 * @param opts 
	 */
	registerService(serviceClass : string | BaseService, opts : any): Promise<BaseService>;
		
	/**
	 * 获取服务
	 * @param name
	 */
	getService(name : string): BaseService;
		
	/**
	 * Jadepool初始化
	 * @param jadepool 
	 */
	protected hookInitialize(jadepool: any): Promise<void>;
		
	/**
	 * 
	 * @param jadepool 
	 * @param plugin 
	 */
	protected hookPluginMounted(jadepool: any, plugin : any): void;

	/**
	 * @param jadepool 
	 * @param plugin 
	 */
	protected hookPluginUnmounted(jadepool: any, plugin : any): void;

	/**
	 * 进行Methods调用
	 * @param methodName 
	 * @param namespace 
	 * @param args
	 */
	invokeMethod(methodName: string, namespace: string | null, ...args: any): Promise<void>;
}

export = JadePoolContext;
