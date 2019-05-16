
/**
 * ApiEndpoint
 */
declare class ApiEndpoint {
  /**
   * @param endpoints API URL
   * @param opts
   */
  constructor (endpoints: string[], opts: { timeout?: number } );
  /** 是否可连接 */
  public connected: boolean
  /** 当前url */
  public endpointUrl: string
  /**
   * 更新API节点
   * @param endpoints API URL
   */
  updateEndPoints (endpoints: string[]): void;
  /**
   * 使用下一个endpoint
   */
  nextEndpoint (): void
  /**
   * 设置之后请求的timeout
   */
  setTimeout (timeout: number): void
  /**
   * 发起请求
   * @param method 方法名
   * @param uri api uri
   * @param data 请求参数
   */
  request (method: 'get'|'post', uri: string, data: object): Promise<any>
  /**
   * GET请求
   * @param uri
   * @param params
   */
  get (uri: string, params: object | undefined): Promise<any>
  /**
   * POST请求
   * @param uri
   * @param body
   */
  post (uri: string, body: object): Promise<any>
}

/**
 * 设置断线
 * @param key the key of apiEndpint
 */
export function isConnected (key: string): boolean;

/**
 * 获取一个apiEndpoint实例
 * @param key
 * @param endpoints API URL
 * @param opts
 */
export function createApiEndpoint (key: string, endpoints: string[], opts: { timeout?: number } ): ApiEndpoint;

/**
 * 根据ChainKey获取ApiEndpoint实例
 * @param chainKey 区块链Key
 * @param nodeKey 节点Key
 */
export function getChainNodeEndpoint (chainKey: string, nodeKey?: string): Promise<ApiEndpoint>;
