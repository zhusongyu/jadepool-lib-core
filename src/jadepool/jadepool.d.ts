import mongoose from 'mongoose'
import services from '../services'
import models from '../models'
import BaseService = require('../services/core')

declare interface EnvObject {
	/** 环境名称 */
	name: string,
	/** Pm2启动时cluster模式下的instanceNum */
	instanceId: number,
	/** 是否为生产环境 */
	isProd: boolean;
	/** 是否启用ECC验证 */
	eccEnabled: boolean;
	/** 服务类型 */
	server: string;
	/** 服务版本号 */
	version: string;
	/** 启动模式 */
	launchMode: string;
	/** 进程Key */
	processKey: string;
	/** 进程类型 */
	processType: string;
	/** 进程前缀 */
	processPrefix: string;
	/** 进程启动模式 */
	mode: string;
	/** 进程启动参数 */
	param: string;
	/** 进程脚本文件名，用于启动新进程 */
	script: string;
	/** 主机HOST */
	host: string;
	/** 默认Mongo */
	defaultMongo: string;
	/** 默认Redis */
	defaultRedis: string;
	/** 默认Consul地址 */
	defaultConsul: string;
	/** 内部签名Secret */
	secret: string;
	/** 设置后worker将自动启动, 默认true */
	autoStart: boolean;
	/** 设置是否支持多同链多Worker模式, 默认false */
	multiWorkers: boolean;
	/** (过期)auto, pm2模式 */
	clusterMode: string;
}

declare class JadepoolSingleton {
	public env: EnvObject
  /**
   * 全局配置
   */
	public config: {}
  /**
   * 配置服务
   */
	public configSrv: services.ConfigService
	/**
	 * 服务发现
	 */
	public consulSrv: services.ConsulService
  
	/**
	 * 注册服务
	 * @param serviceClass 
	 * @param opts 
	 */
	registerService(name: 'agenda', opts: services.AgendaOptions): Promise<services.AgendaService>;
	registerService(name: 'express', opts: services.AppOptions): Promise<services.AppService>;
	registerService(name: 'error.code', opts: services.ErrorCodeOptions): Promise<services.ErrorCodeService>;
	registerService(name: 'script', opts: services.ScriptOptions): Promise<services.ScriptService>;
	registerService(name: 'jsonrpc.server', opts: services.JSONRPCServerOptions): Promise<services.JSONRpcService>;
	registerService(name: 'jsonrpc.client', opts: services.JSONRPCOptions): Promise<services.JSONRpcClientService>;
	registerService(name: 'jsonrpc.internal', opts: services.InternalRPCOptions): Promise<services.InternalRpcService>;
	registerService(name: 'socket.io', opts: services.SocketIOOptions): Promise<services.SocketIOService>;
	registerService(name: 'socket.io.worker', opts: services.SocketIOWorkerOptions): Promise<services.SocketIOWorkerService>;
	registerService(name: 'child.process', opts: any): Promise<services.ProcessService>;
	registerService(name: 'async.plan', opts: services.AsyncPlanOptions): Promise<services.AsyncPlanService>;
	registerService(name: 'config', opts: services.ConfigOptions): Promise<services.ConfigService>;
	registerService(name: 'consul', opts: services.ConsulOptions): Promise<services.ConsulService>;

	/**
	 * 获取服务
	 * @param name
	 */
	getService(name: 'agenda'): services.AgendaService;
	getService(name: 'express'): services.AppService;
	getService(name: 'error.code'): services.ErrorCodeService;
	getService(name: 'script'): services.ScriptService;
	getService(name: 'jsonrpc.server'): services.JSONRpcService;
	getService(name: 'jsonrpc.client'): services.JSONRpcClientService;
	getService(name: 'jsonrpc.internal'): services.InternalRpcService;
	getService(name: 'socket.io'): services.SocketIOService;
	getService(name: 'socket.io.worker'): services.SocketIOWorkerService;
	getService(name: 'child.process'): services.ProcessService;
	getService(name: 'async.plan'): services.AsyncPlanService;
	getService(name: 'config'): services.ConfigService;
	getService(name: 'consul'): services.ConsulService;

	/**
	 * 获取模型
	 * @param name
	 */
	getModel(name: 'app'): mongoose.Model<models.AppDocument>;
	getModel(name: 'asyncplan'): mongoose.Model<models.AsyncPlanDocument>;
	getModel(name: 'wallet'): mongoose.Model<models.WalletDocument>;
	getModel(name: 'configdat'): mongoose.Model<models.ConfigDatDocument>;
	getModel(name: string): mongoose.Model<mongoose.Document>;

	/**
	 * 获取应用信息
	 * @param id
	 */
	fetchAppConfig(id: string): Promise<models.AppDocument>;

  /**
	 * 发起async plan
	 * @param plans 计划任务
	 * @param mode 运行模式
	 * @param source 来源
	 * @param sourceId 来源id
	 * @param runAt 运行时机
	 * @param referPlan 引用plan
	 */
  createAsyncPlan(plans: models.OnePlan[], mode: 'series'|'parallel', source: 'system'|'admin'|'application', sourceId?: string, runAt?: Date, referPlan?: models.AsyncPlanDocument): Promise<models.AsyncPlanDocument>
	
	/**
	 * 进行Methods调用
	 * @param methodName 
	 * @param namespace 
	 * @param args
	 */
	invokeMethod(methodName: string, namespace: string | null, ...args: any): Promise<void>;

	/**
	 * 该方法是否可调用
	 * @param methodName 方法名
	 * @param namespace namespace
	 */
	invokeMethodValid(methodName: string, namespace: string | null): Promise<boolean>;
}
