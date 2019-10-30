import { Queue, Job, QueueOptions, JobOptions, AdvancedSettings } from 'bull'
import BaseService = require('./core')
import Task = require('./task')
import { ProcessRunner } from '../utils';
import {
  ChainConfig,
  TokenConfig
} from "../models";
import * as http from 'http';
import * as https from 'https';

export as namespace services

declare interface JobDef {
  name: string
  // data数据
  fileName: string
  prefix?: string
  chainKey?: string
  // task实例
  instance: Task
}
declare interface JobQueueOptions {
  tasks?: JobDef[]
  settings?:  AdvancedSettings
}
declare interface JobToRun {
  /** 任务队列名称 */
  name: string
  /** 任务子名称名称 */
  subName?: string
  /** 任务数据 */
  data?: object
  /** 任务参数 */
  options?: JobOptions
}
declare class JobQueueService extends BaseService {
  constructor (services : any);
  
  initialize (opts: JobQueueOptions): Promise<void>
  /**
   * 获取一个队列
   * @param taskName
   */
  fetchQueue (taskName: String, opts?: QueueOptions): Promise<Queue>
  /**
   * 注册任务
   * @param tasks
   */
  registerJobQueues (tasks: JobDef[]): Promise<void>
  /**
   * 注册任务
   * @param task
   */
  registerJobQueue (task: JobDef): Promise<void>
  /**
   * 启动/重启任务
   */
  startOrReloadJobs (): Promise<void>
  /**
   * 查询正在running的jobs
   * @param taskName
   */
  runningJobs (taskName: string): Promise<number>
  /**
   * 创建循环任务
   * @param interval
   * @param taskName
   * @param data
   * @param options
   */
  every (interval: number | string, taskName: string, data?: object, options?: JobOptions): Promise<Job | undefined>
  /**
   * 创建计划任务
   * @param when 
   * @param taskName 
   * @param data 
   * @param options 
   */
  schedule (when: number | string | Date, taskName: string, data?: object, options?: JobOptions): Promise<Job>
  /**
   * 创建单次任务
   * @param job 任务说明
   */
  add (job: JobToRun): Promise<Job>
}

declare interface AppOptions {
  listenManually: boolean
  routes: (app: any) => void
  /** @default 500 */
  defaultErrorStatus?: number
}
declare class AppService extends BaseService {
  constructor (services : any);
  port?: number
  server?: http.Server
  portSSL?: number
  serverSSL?: https.Server

  initialize (opts: AppOptions): Promise<void>
  listen (): Promise<void>
}

declare interface ErrorCodeOptions {
  isHost: Boolean
  localePath?: string
}
declare class ErrorCodeService extends BaseService {
  constructor (services : any);
  initialize (opts: ErrorCodeOptions): Promise<void>
  getErrorInfo (code: number, locale: string): Promise<{ code: number, category: string, message: string }>
}

declare interface RPCMethodDefine {
  name: string,
  func?: Function,
  encryptResult?: boolean
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
  public host: string
  public port: number

  constructor (services : any);
  initialize (opts: JSONRPCServerOptions): Promise<void>
  /**
   * 设置可接受rpc方法
   * @param acceptMethods 方法名
   */
  setAcceptMethods(acceptMethods: string[] | RPCMethodDefine[]): void;
  /**
   * 添加可接受的RPC方法
   * @param methodName 方法名
   * @param methodFunc 可选，方法执行的代码
   */
  addAcceptableMethod(methodName: string, methodFunc?: Function, encryptResult?: boolean): void;
  /**
   * 移除可接受的RPC方法
   * @param methodName 方法名
   */
  removeAcceptableMethod(methodName: string): void;
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

declare interface InternalRPCOptions {
  namespace: string
  port?: number
}
declare class InternalRpcService extends BaseService {
  constructor (services : any);
  initialize(opts: InternalRPCOptions): Promise<void>
  /**
   * 注册本服务的方法
   * @param {String} methodName
   * @param {Function} [func=undefined]
   */
  registerRPCMethod(method: string, methodFunc?: Function): Promise<void>;
  /**
   * 注册一堆本服务的方法
   * @param methods 方法定义
   */
  registerRPCMethods(methods: string[] | RPCMethodDefine[] ): Promise<void>;
  /**
   * 调用rpc方法
   * @param {String} namespace
   * @param {String} method
   * @param {any} params
   */
  invokeRPCMethod(namespace: string, method: string, params: any): Promise<any>
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
 * 该services依赖JobQueueService
 */
declare class AsyncPlanService extends BaseService {
  constructor (services : any);
  initialize (opts: AsyncPlanOptions): Promise<void>;
}

declare interface StartOptions {
  /** 进程模式 */
  mode?: 'app' | 'task'
  /** 进程参数 */
  param: string
  /** 进程任务名称 */
  task?: string
  /** 进程负责的多个任务名称 */
  jobs?: string | string[]
  /** 退出进程的超时 */
  timeout?: number
  /** 启动运行路径 */
  cwd?: string
  /** 启动脚本 */
  script?: string
  /** 是否启动cluster模式 */
  cluster?: boolean
  /** cluster模式下启动的进程数 */
  instances?: number
  /** 合并日志 */
  mergeLogs?: boolean
}
declare interface PM2Desc {
  name: string
  worker_id: number
  pid?: number
  status: string
  restarts: number
  unstable_restarts: number
}
declare interface ProcessDesc extends PM2Desc {
  uuid: string,
  monit: any,
  uptime: number,
  env: {
    JP_MODE?: string,
    JP_PARAM?: string,
    JP_TASK?: string,
    JP_JOBS?: string,
    NODE_ENV?: string
  }
}
/**
 * pm2服务的参数
 */
declare interface Pm2Options {
  masterKey?: string
}
/**
 * 该服务将使用pm2进行进程管理
 */
declare class Pm2Service extends BaseService {
  constructor (services : any);
  public processPrefix: string;

  initialize (opts: Pm2Options): Promise<void>;
  /** 启动进程 */
  start (opts: StartOptions): Promise<PM2Desc[]>;
  /** 重启进程 */
  restart (nameOrId: string): Promise<PM2Desc[]>;
  /** 关闭进程 */
  stop (nameOrId: string, isDelete: boolean): Promise<PM2Desc[]>;
  /** 列出指定信息 */
  info (nameOrId: string): Promise<ProcessDesc[]>;
  /** 列出信息 */
  list (): Promise<ProcessDesc[]>;
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
  timeout?: number;
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

declare interface ConfigOptions {
  isHost: boolean
}
declare type GeneralConfig = { id: string, [key: string]: any }
declare class ConfigService extends BaseService {
  constructor (services : any);
  initialize (opts: ConfigOptions): Promise<void>
  // 便捷查询方法
  /**
   * 获取实时的区块链配置
   * @param keyOrNameOrCoreType
   */
  loadChainCfg(keyOrNameOrCoreType: string): Promise<ChainConfig>
  /**
   * 读取默认配置中的token配置信息
   * @param chainKey
   * @param tokenNameOrAssetIdOrContract
   */
  loadCoinCfg(chain: string, tokenNameOrAssetIdOrContract: string): Promise<TokenConfig>
  /**
   * 获取实时的全部链名称
   */
  loadAllChainNames(includeDisabled?: boolean): Promise<string[]>
  /**
   * 获取实时的可用coinNames
   * @param chainKey
   */
  loadAllCoinNames(chain: string, includeDisabled?: boolean): Promise<string[]>
  // 通用方法
  /**
   * 从数据库中读取配置，若该配置不存在，则从文件中读取并保存到数据库
   * @param cfgPath 目录名
   * @param key 子目录名
   * @param parent
   */
  loadConfig(cfgPath: string, key: string, parent?: string): Promise<GeneralConfig>;
  /**
   * 从数据库中读取path相同的全部配置，同时也从文件夹中读取全部路径
   * @param cfgPath 
   * @param parent 
   */
  loadConfigKeys(cfgPath: string, parent?: string, includeDisabled?: boolean): Promise<string[]>;
  // 写入型方法无默认实现
  /**
   * 设置是否自动保存
   * @param value 
   */
  setAutoSaveWhenLoad(value : boolean): Promise<void>;
  /**
   * 设置path + key的别名目录
   * 对于loadConfig来说，只取最后一个被设置的别名目录
   * 对于loadConfigKeys来说，别名目录 + config目录下的结果都将累加到最终结果
   * @param path 
   * @param key 
   * @param aliasPath 
   */
  setAliasConfigPath(path: string, key: string, aliasPath: string): Promise<void>;
  /**
   * 保存配置修改
   * @param cfgPath 目录名
   * @param key 子目录名
   * @param modJson 配置修改Json，需Merge
   * @param disabled 是否禁用
   * @param parent
   */
  saveConfig(cfgPath: string, key: string, modJson?: object, disabled?: boolean, parent?: string): Promise<GeneralConfig>;
  /**
   * 从数据库中删除配置，该配置必须是customized的配置
   * @param cfgPath 目录名
   * @param key 子目录名
   * @param parent 
   */
  deleteConfig(cfgPath: string, key: string, parent?: string): Promise<boolean>;
}

declare interface ConsulOptions {
  url?: string
}
declare type KeyValueMeta = { [key: string]: string }
declare type ServiceData = {
  host: string
  port: number
  meta?: KeyValueMeta
}
type TTLMethodType = string | (() => boolean) | Promise<(() => boolean)>
declare class ConsulService extends BaseService {
  constructor (services : any);
  initialize (opts: ConsulOptions): Promise<void>
  /**
   * 注册服务到consul
   * @param serviceName
   * @param port
   * @param meta
   */
  registerService (serviceName: string, port: number, meta?: KeyValueMeta, ttlCheckMethod?: TTLMethodType): Promise<boolean>
  /**
   * 移除服务
   * @param serviceName
   */
  deregisterService (serviceName: string): Promise<boolean>
  /**
   * 等待到服务发现未知
   * @param serviceName 
   * @param timeout 等待超时时间
   */
  waitForService (serviceName: string, timeout?: number): Promise<boolean>
  /**
   * 获取服务信息
   * @param serviceName
   * @param waitForService 是否等待
   */
  getServiceData (serviceName: string, waitForService?: boolean): Promise<ServiceData>
}
