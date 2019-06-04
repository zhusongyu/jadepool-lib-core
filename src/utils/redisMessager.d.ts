import redis from 'redis'

interface AddMessageOptions {
  /** 默认 10000 */
  maxLen?: number
}

interface ConsumeMessageOptions {
  /** 组名，默认使用初始化时的defaultGroup */
  group?: string
  /** 获取数量, 默认 1 */
  count?: number
  /** 阻塞等待, 默认 1000 */
  block?: number
  /** idle等待，默认 3min */
  idleTime?: number
}

interface Message {
  id: string
  data: object
}

/**
 * Redis消息队列
 */
declare class RedisMessager {
  /**
   * @param redisClient
   * @param streamKey
   * @param defaultGroup 默认组
   */
  constructor (redisClient: redis.RedisClient, streamKey: string, defaultGroup?: string);
  /**
   * 确保Group存在
   * @param groupName
   */
  ensureGroup (groupName: string): Promise<void>;
	/**
	 * 发起请求
	 * @param msgs 塞入队列的对象
	 */
  addMessages(msgs: object[], opts?: AddMessageOptions): Promise<string[]>;
  /**
   * 处理Message
   * @param consumerName 消费者名称
   * @param opts 参数
   */
  consumeMessages (consumerName: string, opts?: ConsumeMessageOptions): Promise<Message[]>
  /**
   * 完成Message
   * @param msgIds
   * @param groupName 不传则使用默认组
   */
  ackMessages (msgIds: string[], groupName?: string): Promise<string[]>
}

export = RedisMessager
