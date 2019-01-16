import BaseService = require('./core')
import Task = require('./agenda.task')

export as namespace services

declare interface AgendaOptions {
  tasks: {
    name: string,
    fileName: string,
    instance: Task,
    prefix: string,
    chainKey: string
  }[]
}

declare class AgendaService extends BaseService {
  constructor (services : any);
  
  initialize (opts: AgendaOptions): Promise<void>

  startOrReloadJobs (): Promise<void>

  jobs (query: object): Promise<any>
  update (query: object, update: object): Promise<any>
  every (interval: string | number, name: string, data: object, options: object): Promise<any>
  schedule (when: string, name: string, data: object): Promise<any>
  now (name: string, data: object): Promise<any>
}

declare interface AppOptions {
  listenManually: boolean
  routes: (app: any) => void
  /** @default 500 */
  defaultErrorStatus?: number
}
declare class AppService extends BaseService {
  constructor (services : any);
  port: number
  initialize (opts: AppOptions): Promise<void>
  listen (): Promise<void>
}

declare interface ErrorCodeOptions {
  localePath?: string
}
declare class ErrorCodeService extends BaseService {
  constructor (services : any);
  initialize (opts: ErrorCodeOptions): Promise<void>
  getErrObj (code: number, locale: string): { code: number, status: number, category: string, message: string }
}

declare interface JSONRPCOptions {
  acceptMethods: string[]
}
declare interface JSONRPCServerOptions extends JSONRPCOptions {
  host: string
  port: number
}
declare class JSONRpcService extends BaseService {
  constructor (services : any);
  initialize (opts: JSONRPCServerOptions): Promise<void>
  /**
   * 请求RPC地址
   * @param ws 请求的客户端
   * @param methodName 方法名
   * @param args 参数
   */
  requestJSONRPC (ws: any, methodName: string, args: any): Promise<any>;
}

declare interface RequestOptions {
  noAuth?: boolean
}
declare class JSONRpcClientService extends BaseService {
  constructor (services : any);
  initialize (opts: JSONRPCOptions): Promise<void>
  joinRPCServer (url: string, opts?: RequestOptions): Promise<void>
  closeRPCServer (url: string): Promise<void>
  getClientReadyState (url: string): number
  /**
   * 请求JSONRPC
   */
  requestJSONRPC (url: string, methodName: string, args: any, opts?: RequestOptions): Promise<any>
}

declare interface ScriptOptions {
  onStartup: Function;
  onExit: Function;
}
declare class ScriptService extends BaseService {
  constructor (services : any);
  initialize (opts: ScriptOptions): Promise<void>
  /**
   * 运行脚本
   */
  runScript (name: string): Promise<any>
}

declare interface SocketIOOptions {
  disableInternal?: boolean;
  adapter?: {
    type: string
  };
}
declare class SocketIOService extends BaseService {
  constructor (services : any);
  initialize (opts: SocketIOOptions): Promise<void>
  /**
   * 调用内部跨进程方法
   * @param namespace inteneralKey,通常为chain的Key
   * @param methodName 方法名
   * @param args 参数
   */
  invokeInternalMethod (namespace: string, methodName: string, args: any): Promise<any>
  /**
   * 调用内部跨进程方法
   * @param namespace inteneralKey,通常为chain的Key
   * @param socketId socket的sid，需再次拼接修改为socket.id
   * @param methodName 方法名
   * @param args 参数
   */
  invokeInternalMethodById (namespace: string, socketId: string, methodName: string, args: any): Promise<any>
  /**
   * 广播内部跨进程方法
   * @param namespace inteneralKey,通常为chain的Key
   * @param methodName 方法名
   * @paramargs 参数
   */
  broadcastInternalMethod (namespace: string, methodName: string, args: any): Promise<any[]>
}

declare interface SocketIOWorkerOptions {
  namespaces: string[]
}
declare class SocketIOWorkerService extends BaseService {
  constructor (services : any);
  initialize (opts: SocketIOWorkerOptions): Promise<void>
}
