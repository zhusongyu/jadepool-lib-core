import mongoose from 'mongoose'
import services from '../services'
import BaseService = require('../services/core')
import Context = require('./context')
import consts = require('../consts')

interface EnvObject {
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
	/** 内部签名Secret */
	secret: string;
	/** 设置后worker将自动启动, 默认true */
	autoStart: boolean;
	/** 设置是否支持多同链多Worker模式, 默认false */
	multiWorkers: boolean;
	/** (过期)auto, pm2模式 */
	clusterMode: string;
}

/**
 * 瑶池主程序
 */
declare class JadePool {
	constructor();

	/**
	 * 初始化Jadepool
	 * @param ctx 
	 */
	initialize(ctx: Context): Promise<void>;
	/**
	 * Accessors
	 */
	isInitialized: boolean
	pluginDir: string
	env: EnvObject
	config: {}
	models: {}
	Context: typeof Context

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
	registerService(name: 'socket.io', opts: services.SocketIOOptions): Promise<services.SocketIOService>;
	registerService(name: 'socket.io.worker', opts: services.SocketIOWorkerOptions): Promise<services.SocketIOWorkerService>;
	registerService(name: string | BaseService, opts: any): Promise<BaseService>;

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
	getService(name: 'socket.io'): services.SocketIOService;
	getService(name: 'socket.io.worker'): services.SocketIOWorkerService;
	getService(name: string): BaseService;

	/**
	 * 获取模型
	 * @param name
	 */
	getModel(name: string): mongoose.Model<mongoose.Document>;

	/**
	 * 进行Methods调用
	 * @param methodName 
	 * @param namespace 
	 * @param args
	 */
	invokeMethod(methodName: string, namespace: string | null, ...args: any): Promise<void>;
		
	/**
	 * 加载全部插件
	 */
	loadAllPlugins(): Promise<void>;
		
	/**
	 * 加载插件
	 * @param name 插件名称
	 */
	loadPlugin(name: string): Promise<void>;
		
	/**
	 * 卸载插件
	 * @param name 插件名称
	 */
	unloadPlugin(name: string): Promise<void>;
}

/**
 * Singleton导出
 */
declare const jadepool: JadePool;

export = jadepool
