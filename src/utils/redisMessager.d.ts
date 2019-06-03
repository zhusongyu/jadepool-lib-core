import redis from 'redis'

interface AddMessageOptions {
  /** 默认 10000 */
  maxLen?: number
}

interface ConsumeMessageOptions {
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
   * @param group
   * @param opts
   */
  constructor (redisClient: redis.RedisClient, streamKey: string, groupName: string);
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
   */
  ackMessages (msgIds: string[]): Promise<string[]>
}

export = RedisMessager
