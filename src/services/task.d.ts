import { Job } from 'bull'
import { JobQueueService } from './index'

declare interface TaskOptions {
	/** 优先级，越小越高 */
	priority: Number = 10
	/** 默认并发数 */
	concurrency?: Number = 1
	/** 可接受总量，超出则进入delay */
	limiterMax?: Number = 1000
	/** 可接受总量的时间区间(ms)内 */
	limiterDuration?: Number = 5000
	/** 重试锁定时间（ms），熄火时间默认与它相同 */
	lockDuration?: Number = 30000
	/** 熄火检测间隔 */
	stalledInterval?: Number = 30000
	/** 熄火数达到多少后自动重试 */
	maxStalledCount: Number = 1
}

declare class Task {
	constructor(taskName: string);
	/**
	 * Accessor getters
	 */
	isWorking: boolean;
	round: number;
	handlingAmt: number;
	taskQuery: object;
	opts: TaskOptions;

  /**
   * 设置job相关的options
   * @param opts Job参数
   */
	protected setOptions (opts: TaskOptions): TaskOptions;

	/**
	 * 任务初始化
	 */
	private onInit(): Promise<void>;
	/**
	 * 任务销毁方法
	 */
	private onDestroy(): Promise<void>;
	/**
	 * @param job 
	 * @param done 
	 */
	private onHandle(job: Job): Promise<void>;
		
	/**
	 * 处理定制错误 NBError
	 * @param job 
	 * @param err 
	 * @param level 
	 */
	private handleError(job: Job, err: Error, level: 'CRITICAL'|'MAJOR'|'MINOR'|'WARNING'): Promise<void>;
		
	/**
	 * 进行下一步任务
	 */
	next(name: String, delay: number, attempts?: number = 1): void;
		
	/**
	 * 待重载初始化函数
	 */
	initialize(): Promise<void>;
		
	/**
	 * 待重载函数处理函数
	 */
	handler(job: Job): Promise<void>;
}

export = Task;
