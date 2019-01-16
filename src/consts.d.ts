/**
 * --------- STRING ---------
 */
export declare const DEFAULT_KEY: 'default';

/**
 * --------- MAP ---------
 */
export declare namespace PROCESS {
	const NAME_PREFIX: 'Jadepool';
	/** 已废弃 */
	const CLUSTER_MODES: {
    AUTO: 'auto',
    NODE: 'node',
    PM2: 'pm2'
  }
	const LAUNCH_MODES: {
		/** 全进程单进程执行，已废弃 */
		ALL_IN_ONE: 'allinone',
		/** 中心管理者，同一项目不同机器同一时间仅存在一个进程 */
		MASTER: 'master',
		/** 附属管理者，同一项目在每台机器上仅存在一个进程 */
		AGENT: 'agent',
		/** 具体事务执行者，同一项目存在多个进程 */
    WORKER: 'worker'
  }
	const TYPES: {
		/** 具有转发路由的主进程。所属启动模式：ALL_IN_ONE, MASTER */
		ROUTER: 'app',
		/** 受APP控制的服务进程，主要用于进程管理。所属启动模式： AGENT */
		ROUTER_SUB: 'sub',
		/** 事务进程，通常性事务。所属启动模式：WORKER */
		GENERAL: 'general',
		/** 事务进程，特定链事务。所属启动模式：WORKER */
    BLOCKCHAIN: 'chain'
  }
}

export declare const SERVICE_NAMES: {
	/** 默认错误信息 */
	ERROR_CODE: 'error.code',
	/** 后台任务服务 */
	AGENDA: 'agenda',
	/** HTTP/HTTPS服务 */
	APP: 'express',
	/** 根据生命周期运行脚本的服务 */
	SCRIPT: 'script',
	/** 基于ws的通用jsonrpc发送和接收服务 */
	JSONRPC: 'jsonrpc.client',
	/** 基于ws的通用jsonrpc服务端 */
	JSONRPC_SERVER: 'jsonrpc.server',
	/** Socket.io服务 */
	SOCKET_IO: 'socket.io',
	/** Socket.io的worker服务中心 */
	SIO_WORKER: 'socket.io.worker'
}

export declare const SIO_EVENTS: {
	INVOKE_METHOD: 'invokeMethod';
}

export declare const NSP_TYPES: {
  NULL: 'null',
  COIN_TYPE: 'data.type',
  CHAIN_KEY: 'params.chain',
  SOCKET_ID: 'socketio.id',
  AGENT: 'MASTER_AGENT'
}

export declare const LEDGER_MODES: {
  LOCAL: 'local',
  RPC: 'rpc'
}
export declare const ADDRESS_MODES: {
  MULTI: 'multi',
  SINGLE: 'single'
}
export declare const SERVER_TYPES: {
	/** 主服务 */
  MAIN: 'main',
	/** AdminAPI服务 */
	API: 'api',
	/** 安全服务 */
	SAFE: 'safe',
	/** 外部服务 */
	EXTERNAL: 'external',
	/** 未知服务 */
  UNKNOWN: 'unknown'
}
export declare const JOB_TYPES: {
	/** 循环任务 */
	EVERY: 'every',
	/** 普通任务 */
	NORMAL: 'normal',
	/** 计划任务 */
  SCHEDULE: 'schedule'
}
export declare const ADDRESS_STATE: {
	/** 刚创建 */
	NEW: 'new',
	/** 已分配使用 */
	USED: 'used',
	/** TODO 被屏蔽 */
  BLOCKED: 'blocked'
}
export declare const ADDRESS_TYPE: {
	/** 热主 */
	HOT_WALLET: 0,
	/** 冷钱包 */
	COLD_WALLET: 1,
	/** 充值地址 */
	DEPOSIT: 2,
	/** 外部地址 */
  EXTERNAL: 3
}
export declare const ORDER_STATE: {
	/** 订单初始化 */
	INIT: 'init',
	/** 1. init与online之间的一个过渡状态，只有发送tx上链出错时，订单会永久保持该holding状态，需要人工介入；否则，该状态会在很短时间就变为online */
	HOLDING: 'holding',
	/** 订单已发送 */
	ONLINE: 'online',
	/** 订单已上链 */
	PENDING: 'pending',
	/** 订单交易失败 */
	FAILED: 'failed',
	/** 订单完成 */
  DONE: 'done'
}
export declare const ORDER_BIZTYPES: {
	/** 出：提现订单 */
	WITHDRAW: 'WITHDRAW',
	/** 出：热转冷 */
	SWEEP: 'SWEEP',
	/** 出：内部 */
	SWEEP_INTERNAL: 'SWEEP_INTERNAL',
	/** 入：充值订单 */
	DEPOSIT: 'DEPOSIT',
	/** 入：空投 */
	AIRDROP: 'AIRDROP',
	/** 入：冷转热 */
	RECHARGE: 'RECHARGE',
	/** 入：特殊充值 */
	RECHARGE_SPECIAL: 'RECHARGE_SPECIAL',
	/** 入：内部 */
	RECHARGE_INTERNAL: 'RECHARGE_INTERNAL',
	/** 入：意外收入 */
  RECHARGE_UNEXPECTED: 'RECHARGE_UNEXPECTED'
}
export declare const BATCH_STATE: {
	/** 批处理交易已经开始 */
	STARTED: 'started',
	/** 批处理交易全部正确结束 */
	DONE: 'done',
	/** 批处理交易全部结束，其中有failed的交易 */
  FAILED: 'failed'
}
export declare const ISSUE_TYPES: {
  ORDER_HOLDING: 'orderHolding'
}
export declare const ISSUE_STATE: {
  OPENED: 'opened',
  PROCESSING: 'processing',
  VALIDATING: 'validating',
  RESOLVED: 'resolved'
}
export declare const WARN_LEVEL: {
  CRITICAL: 'CRITICAL', // 致命错误
  MAJOR: 'MAJOR', // 主要错误
  MINOR: 'MINOR', // 次要错误
  WARNING: 'WARNING' // 警告
}
export declare const SUPPORT_LOCALES: {
  ZH_CN: 'zh-cn',
  EN: 'en',
  JA: 'ja'
}
/**
 * --------- LIST ---------
 */
export declare const ORDER_BIZTYPES_OUT : string[];

export declare const ORDER_BIZTYPES_IN : string[];
