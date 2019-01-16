declare class Task {
	constructor(taskName: string);
	/**
	 * Accessor getters
	 */
	isWorking : boolean;
	round : number;
	handlingAmt : number;
	taskQuery : object;

	/**
	 * 任务初始化
	 */
	private onInit(): Promise<void>;
	/**
	 * 任务销毁方法
	 */
	private onDestroy(): Promise<void>;
	/**
	 * 禁用循环任务
	 */
	private disable(): Promise<void>;
	/**
	 * 启用系列任务
	 */
	private enable(): Promise<void>;
	/**
	 * @param job 
	 * @param done 
	 */
	private onHandle(job: any, done: any): Promise<void>;
		
	/**
	 * 处理定制错误 NBError
	 * @param job 
	 * @param err 
	 * @param level 
	 */
	private handleError(job: any, err: Error, level: 'CRITICAL'|'MAJOR'|'MINOR'|'WARNING'): Promise<void>;
		
	/**
	 * 进行下一步Schedule
	 * @param job 
	 */
	next(job: any): void;
		
	/**
	 * 待重载初始化函数
	 */
	initialize(): Promise<void>;
		
	/**
	 * 待重载函数处理函数
	 */
	handler(job: any): Promise<void>;
}

export = Task;
