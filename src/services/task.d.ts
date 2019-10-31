import { Job } from 'bull'
import { JobQueueService } from './index'

declare interface TaskOptions {
	/** 优先级，越小越高 */
	priority: number// = 10
	/** 失败重试的策略 */
	retryStrategy?: (attemptsMade: number, err: Error) => number
	/** 默认并发数 */
	concurrency?: number // = 1
	/** 可接受总量，超出则进入delay */
	limiterMax?: number // = 1000
	/** 可接受总量的时间区间(ms)内 */
	limiterDuration?: number // = 5000
	/** 重试锁定时间（ms），熄火时间默认与它相同 */
	lockDuration?: number // = 30000
	/** 熄火检测间隔 */
	stalledInterval?: number // = 30000
	/** 熄火数达到多少后自动重试 */
	maxStalledCount: number // = 1
}

declare class Task {
	constructor(taskName: string);
	/**
	 * Accessor getters
	 */
	protected isWorking: boolean;
	protected round: number;
	protected handlingAmt: number;
	protected taskQuery: object;
	protected opts: TaskOptions;

	/**
	 * 任务初始化
	 */
	onInit(): Promise<void>;
	/**
	 * 任务销毁方法
	 */
	onDestroy(): Promise<void>;
	/**
	 * @param job 
	 * @param done 
	 */
	onHandle(job: Job): Promise<void>;
	/**
	 * 待重载初始化函数
	 */
	protected initialize(): Promise<void>;
  /**
   * 设置job相关的options
   * @param opts Job参数
   */
	protected setOptions (opts: TaskOptions): TaskOptions;
	/**
	 * 处理定制错误 NBError
	 * @param err 
	 * @param level 
	 */
	protected handleError(err: Error, level: 'CRITICAL'|'MAJOR'|'MINOR'|'WARNING'): Promise<void>;
	/**
	 * 重复本任务
	 * @param current 当前job信息
	 * @param [delay=0] 延迟时间(ms)
	 * @param [attempts=3] 失败重试次数
	 */
	protected repeat(current: Job, delay?: number, attempts?: number): Promise<Job | undefined>
	/**
	 * 待重载函数处理函数
	 */
	protected handler(job: Job): Promise<void>;
}

export = Task;
