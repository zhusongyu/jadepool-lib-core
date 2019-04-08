import { ChildProcess } from 'child_process'

/**
 * 常驻型子进程运行器
 * 该子进程在异常退出时会自动重启
 */
declare class ProcessRunner {
	/**
	 * @param name 进程名
	 * @param execPath 脚本路径
	 * @param env 进程环境变量
	 */
	constructor (name: string, execPath: string, env: object);
	/**
	 * 优雅退出
	 */
	onDestroy (signal: string): Promise<void>
	/**
	 * 运行中的实例
	 */
	childInstance: ChildProcess; 
	/**
	 * 发起请求
	 * @param method 
	 * @param params 
	 * @return  
	 */
	request(method: string, params: any): Promise<any>;
}

export = ProcessRunner
