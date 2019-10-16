import { JadepoolSingleton } from './jadepool';
import ServiceLib from './serviceLib';

/**
 * Jadepool上下文
 */
declare class JadePoolContext extends JadepoolSingleton {
	/**
	 * 上下文构造函数
	 * @param serverType 服务类型名
	 * @param version semver版本号
	 * @param invokeMethodFunc invokeMethod函数
	 * @param configObj 配置文件对象
	 */
	constructor (serverType: string, version: string, invokeMethodFunc: Function, configObj : object);

	public services: ServiceLib;

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
}

export = JadePoolContext;
