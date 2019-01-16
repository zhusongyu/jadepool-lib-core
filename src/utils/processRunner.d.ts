/**
 * 运行器
 */
declare class ProcessRunner {
	/**
	 * @param name 进程名
	 * @param execPath 脚本路径
	 * @param env 进程环境变量
	 */
	constructor (name: string, execPath: string, env: object);
		
	/**
	 * 发起请求
	 * @param method 
	 * @param params 
	 * @return  
	 */
	request(method: string, params: any): Promise<any>;
}

export = ProcessRunner
