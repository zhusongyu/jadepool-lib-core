import Agenda from 'agenda'
import BaseService = require('./core')
import Task = require('./agenda.task')
import { ProcessRunner } from '../utils';

export as namespace services

declare interface AgendaOptions {
  processEvery: number
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
  /**
   * 重载配置
   */
  startOrReloadJobs (): Promise<void>  
  /**
   * 正在running的jobs
   * @param taskName 检测的任务名
   * @param id 可选，同名任务下，检测指定id
   */
  runningJobs (taskName: string, id?: string): Promise<Agenda.Job[]>

  jobs (query: object): Promise<Agenda.Job[]>
  update (query: object, update: object): Promise<any>
  every (interval: string | number, name: string, data: object, options: object): Promise<Agenda.Job>
  schedule (when: string, name: string, data: object): Promise<Agenda.Job>
  now (name: string, data: object): Promise<Agenda.Job>
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
  noAuth?: boolean
  signerId?: string
  signer?: Buffer | string
  verifier?: Buffer | string
	sort?: string
	hash?: string
	encode?: string
  authWithTimestamp?: boolean
  withoutTimestamp?: boolean
}
declare interface JSONRPCServerOptions extends JSONRPCOptions {
  host?: string
  port?: number
}
declare class JSONRpcService extends BaseService {
  constructor (services : any);
  initialize (opts: JSONRPCServerOptions): Promise<void>
  /**
   * 设置可接受rpc方法
   * @param acceptMethods 方法名
   */
  setAcceptMethods(acceptMethods: string[]): void;
  /**
   * 请求RPC地址
   * @param ws 请求的客户端
   * @param methodName 方法名
   * @param args 参数
   */
  requestJSONRPC (ws: any, methodName: string, args: any): Promise<any>;
}

declare interface RequestOptions extends JSONRPCOptions {
  acceptNamespace?: string
}
declare class JSONRpcClientService extends BaseService {
  constructor (services : any);
  initialize (opts: JSONRPCOptions): Promise<void>
  /**
   * 设置可接受rpc方法
   * @param acceptMethods 方法名
   */
  setAcceptMethods(acceptMethods: string[]): void;
  /**
   * 加入ws RPC服务器
   * @param url
   * @param opts
   */
  joinRPCServer (url: string, opts?: RequestOptions): Promise<void>
  /**
   * 关闭ws RPC服务器
   * @param url
   */
  closeRPCServer (url: string): Promise<void>
  /**
   * 检测连接状态
   * @param url
   */
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

declare interface AsyncPlanOptions {
  processEvery: number;
}
/**
 * 该services依赖agendaService
 */
declare class AsyncPlanService extends BaseService {
  constructor (services : any);
  initialize (opts: AsyncPlanOptions): Promise<void>;
}

declare class ProcessService extends BaseService {
  constructor (services : any);
  initialize (opts: undefined): Promise<void>;
  /**
   * 创建或获取一个常驻的子进程
   * @param name 子进程唯一别名
   * @param execPath 子进程路径
   * @param env 子进程环境变量
	 * @param cwd 可选，运行目录，默认为脚本目录
   */
  forkNamedProcess (name: string, execPath: string, env: { [key: string]: string }, cwd?: string): ProcessRunner;
  /**
   * 重启进程
   * @param name 子进程唯一别名
   */
  restartNamedProcess (name: string): Promise<ProcessRunner>
	/**
	 * 调用子进程方法(jsonrpc形式)
   * @param name 子进程唯一别名
	 * @param method 函数名
	 * @param params 参数
	 */
  requestProcess (name: string, method: string, params: any): Promise<any>;
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
