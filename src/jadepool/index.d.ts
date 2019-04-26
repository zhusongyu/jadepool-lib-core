import { JadepoolSingleton } from './jadepool'
import Context = require('./context')

/**
 * 瑶池主程序
 */
declare class JadePool extends JadepoolSingleton {
	constructor();

	/**
	 * 初始化Jadepool
	 * @param ctx 
	 */
	initialize(ctx: Context): Promise<void>;
	/**
	 * Accessors
	 */
	public isInitialized: boolean
	public pluginDir: string
	public Context: typeof Context

	/**
	 * 加载全部插件
	 */
	loadAllPlugins(): Promise<void>;
		
	/**
	 * 加载插件
	 * @param name 插件名称
	 */
	loadPlugin(name: string): Promise<void>;
		
	/**
	 * 卸载插件
	 * @param name 插件名称
	 */
	unloadPlugin(name: string): Promise<void>;
}

/**
 * Singleton导出
 */
declare const jadepool: JadePool;

export = jadepool
