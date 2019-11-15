import redis from 'redis'

export interface AddMessageOptions {
  /** 默认 10000 */
  maxLen?: number
}

export interface ConsumeMessageOptions {
  /** 组名，默认使用初始化时的defaultGroup */
  group?: string
  /** 获取数量, 默认 1 */
  count?: number
  /** 阻塞等待, 默认 0s */
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
   * @param streamKey
   * @param defaultGroup 默认组
   * @param redisClient 传入 redis instance
   */
  constructor (streamKey: string, defaultGroup?: string, redisClient?: redis.RedisClient);
  /**
   * 该 messager 使用的 redisClient
   */
  redisClient: redis.RedisClient;
  /**
   * 默认组
   */
  defaultGroup: string;
  /**
   * 确保Group存在
   * @param groupName 分组名
   */
  ensureGroup (groupName: string): Promise<void>;
  /**
   * 从 Group 中删除消费者，并递交redis
   * @param consumerName 消费者名称
   * @param groupName 分组名
   */
  removeConsumer (consumerName: string, groupName?: string): Promise<void>;
  /**
   * 从 Group 中删除消费者，返回Multi
   * @param consumerName 消费者名称
   * @param groupName 分组名
   */
  removeConsumerMulti (consumerName: string, groupName?: string, multi?: redis.Multi): redis.Multi;
  /**
   * 处理Message
   * @param consumerName 消费者名称
   * @param opts 参数
   */
  consumeMessages (consumerName: string, opts?: ConsumeMessageOptions): Promise<Message[]>
	/**
	 * 添加Messages，并递交redis
	 * @param msgs 塞入队列的对象
   * @param opts 参数
	 */
  addMessages(msgs: object[], opts?: AddMessageOptions): Promise<string[]>;
  /**
   * 添加Messages，返回Multi
   * @param msgs 塞入队列的对象
   * @param opts 参数
   */
  addMessagesMulti(msgs: object[], opts?: AddMessageOptions): redis.Multi;
  /**
   * 完成Message，并递交redis
   * @param msgIds
   * @param groupName 不传则使用默认组
   */
  ackMessages (msgIds: string[], groupName?: string): Promise<string[]>
  /**
   * 完成Message，返回Multi
   * @param msgIds
   * @param groupName 不传则使用默认组
   */
  ackMessagesMulti  (msgIds: string[], groupName?: string): redis.Multi;
}

export default RedisMessager
