// --------- STRING ---------
const DEFAULT_KEY = 'default'
const DEFAULT_ENCODE = 'base64'
// --------- MAP ---------
const PROCESS = {
  NAME_PREFIX: 'Jadepool',
  /** @deprecated */
  CLUSTER_MODES: {
    AUTO: 'auto',
    NODE: 'node',
    PM2: 'pm2'
  },
  LAUNCH_MODES: {
    /** @deprecated */
    ALL_IN_ONE: 'allinone',
    MASTER: 'master', // 中心管理者，同一项目不同机器同一时间仅存在一个进程
    AGENT: 'agent', // 附属管理者，同一项目在每台机器上仅存在一个进程
    WORKER: 'worker' // 具体事务执行者，同一项目存在多个进程
  },
  TYPES: {
    ROUTER: 'app', // 具有转发路由的主进程。所属启动模式：ALL_IN_ONE, MASTER
    ROUTER_SUB: 'sub', // 受APP控制的服务进程，主要用于进程管理。所属启动模式： AGENT
    GENERAL: 'general', // 事务进程，通常性事务。所属启动模式：WORKER
    BLOCKCHAIN: 'chain' // 事务进程，特定链事务。所属启动模式：WORKER
  }
}
const SERVICE_NAMES = {
  /** 默认错误信息 */
  ERROR_CODE: 'error.code',
  /** 后台任务服务 */
  AGENDA: 'agenda',
  /** HTTP/HTTPS服务 */
  APP: 'express',
  /** 根据生命周期运行脚本的服务 */
  SCRIPT: 'script',
  /** 子进程管理服务 */
  CHILD_PROCESS: 'child.process',
  /** 异步计划任务服务 */
  ASYNC_PLAN: 'async.plan',
  /** 基于ws的通用jsonrpc发送和接收服务 */
  JSONRPC: 'jsonrpc.client',
  /** 基于ws的通用jsonrpc服务端 */
  JSONRPC_SERVER: 'jsonrpc.server',
  /** Socket.io服务 */
  SOCKET_IO: 'socket.io',
  /** Socket.io的worker服务中心 */
  SIO_WORKER: 'socket.io.worker'
}
const SIO_EVENTS = {
  INVOKE_METHOD: 'invokeMethod'
}
const SYSTEM_APPIDS = {
  INTERNAL: 'self',
  DEFAULT: 'pri'
}
const NSP_TYPES = {
  NULL: 'null',
  COIN_TYPE: 'data.type',
  CHAIN_KEY: 'params.chain',
  SOCKET_ID: 'socketio.id',
  AGENT: 'MASTER_AGENT'
}
const LEDGER_MODES = {
  LOCAL: 'local',
  RPC: 'rpc'
}
const SERVER_TYPES = {
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
const JOB_TYPES = {
  /** 循环任务 */
  EVERY: 'every',
  /** 普通任务 */
  NORMAL: 'normal',
  /** 计划任务 */
  SCHEDULE: 'schedule'
}
const DB_KEYS = {
  DEFAULT: 'default',
  CONFIG: 'config',
  ADMIN: 'admin'
}
const MODEL_NAMES = {
  // Config Models
  CONFIG_DATA: 'configdat',
  CONFIG_REV: 'configrev',
  APPLICATION: 'app',
  WALLET: 'wallet',
  WALLET_CHAIN: 'walletchain',
  WALLET_TOKEN: 'wallettoken',
  // Busines Models
  ADDRESS: 'address',
  ORDER: 'order',
  DELEGATION: 'delegation',
  ASYNC_PLAN: 'asyncplan',
  SCAN_TASK: 'scantask',
  TASK_CONFIG: 'admintaskcfg',
  ETH_BATCH: 'ethbatch',
  ETH_FAUCET: 'ethfaucet',
  AUDIT: 'audit',
  AUDIT_BALANCE: 'auditbalance',
  RULER: 'ruler',
  BLOCK: 'block',
  ISSUE_RECORD: 'issuerecord',
  NOTIFICATION: 'notification',
  WARNING: 'warning',
  // Admin Models
  ACCOUNT: 'account',
  ROLE: 'role',
  ACTION: 'action',
  NOTI_EMAIL: 'notiemail'
}
const PRIVKEY_SOURCES = {
  /** 来源seed软件 */
  SEED: 'seed',
  /** 来源Seed+数据库 */
  SEED_DB: 'seed_db',
  /** 纯签名密码机 */
  HSM_PURE: 'hsm_pure',
  /** 深度安全密码机 */
  HSM_DEEP: 'hsm_deep'
}
/** 区块配置中设置支持的地址模式 */
const ADDRESS_MODES = {
  MULTI: 'multi',
  SINGLE: 'single'
}
/** 地址模型中设置的地址业务模式 */
const ADDRESS_BIZ_MODES = {
  /** 按照瑶池默认规则进行修改 */
  AUTO: 'auto',
  /** 设置为自动sweepToHot的独立地址。 */
  DEPOSIT_WITH_ADDR: 'deposit',
  /** 设置为带MEMO的热主地址。 */
  DEPOSIT_WITH_MEMO: 'deposit_memo',
  /** 设置为普通类型的独立地址，不做任何处理 */
  NORMAL: 'normal'
}
const ADDRESS_STATE = {
  /** 刚创建 */
  NEW: 'new',
  /** 已分配使用 */
  USED: 'used',
  /** TODO 被屏蔽 */
  BLOCKED: 'blocked'
}
const ADDRESS_TYPE = {
  HOT_WALLET: 0, // 热主
  COLD_WALLET: 1, // 冷钱包
  DEPOSIT: 2, // 充值地址
  EXTERNAL: 3 // 外部地址
}
const ORDER_STATE = {
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
const ORDER_BIZTYPES = {
  /** 出：提现订单 */
  WITHDRAW: 'WITHDRAW',
  /** 出：热转冷 */
  SWEEP: 'SWEEP',
  /** 出：内部 */
  SWEEP_INTERNAL: 'SWEEP_INTERNAL',
  /** 出：退款 */
  REFUND: 'REFUND',
  /** 出（伪）：撤销入账记录 */
  REVERT: 'REVERT',
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
  RECHARGE_UNEXPECTED: 'RECHARGE_UNEXPECTED',
  /** 出：执行某个区块链行为的订单，(value为消耗，fee消耗, 额外业务数据在action中记录) */
  SYSTEM_CALL: 'SYSTEM_CALL',
  /** 入：已回收的抵押额，(value为本金，fee为0，属于本金收回) */
  PRINCIPAL_FUND: 'PRINCIPAL_FUND',
  /** 入：收益记录订单，(value为收益额，fee为0, 属于额外利息收入) */
  INTEREST_FUND: 'INTEREST_FUND',
  /** 冻结：抵押订单，(value为冻结的抵押值，fee为消耗) */
  DELEGATE: 'DELEGATE',
  /** 解冻请求：取消抵押请求，(value为递交解冻抵押值，fee为消耗) */
  UNDELEGATE: 'UNDELEGATE'
}
const DELEGATION_STATE = {
  /** 未抵押 */
  UNSTAKED: 0,
  /** 移除抵押中 */
  UNSTAKING: 1,
  /** 抵押中 */
  STAKED: 2
}
const ASYNC_PLAN_MODES = {
  SERIES: 'series',
  PARALLEL: 'parallel'
}
const ASYNC_PLAN_SOURCES = {
  SYSTEM: 'system',
  ADMIN: 'admin',
  APP: 'application'
}
const ASYNC_PLAN_STATUS = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  ABORTED: 'aborted'
}
const ASYNC_PLAN_CATEGORY = {
  INTERNAL_ORDER: 'internalOrder',
  EXECUTE_ACTION: 'executeAction'
}
const ORDER_DEFAULT_ACTIONS = {
  /** 执行UTXO打散 */
  UTXO_SCATTER: 'utxo-scatter',
  /** 通用ABI调用 */
  ABI_METHOD: 'abi-method',
  /** 授权转币 */
  APPROVE: 'approve',
  /** 冻结 */
  FREEZE: 'freeze',
  /** 烧掉token */
  BURN: 'burn',
  /** 代理 */
  DELEGATE: 'delegate',
  /** 取消代理 */
  UNDELEGATE: 'un-delegate',
  /** 转代理 */
  REDELEGATE: 're-delegate',
  /** 申请奖励 */
  CLAIM_REWARD: 'claim-reward',
  /** 设置奖励地址 */
  SET_REWARD_ADDRESS: 'set-reward-address'
}
const BATCH_STATE = {
  STARTED: 'started', // 批处理交易已经开始
  DONE: 'done', // 批处理交易全部正确结束
  FAILED: 'failed' // 批处理交易全部结束，其中有failed的交易
}
const ISSUE_TYPES = {
  ORDER_HOLDING: 'orderHolding',
  ORDER_UNEXPECTED: 'orderUnexpected',
  CONTRACT_UNKNOWN_ISSUE: 'contractUnknownIssue'
}
const ISSUE_STATE = {
  OPENED: 'opened',
  PROCESSING: 'processing',
  VALIDATING: 'validating',
  RESOLVED: 'resolved'
}
const WARN_LEVEL = {
  CRITICAL: 'CRITICAL', // 致命错误
  MAJOR: 'MAJOR', // 主要错误
  MINOR: 'MINOR', // 次要错误
  WARNING: 'WARNING' // 警告
}
const SUPPORT_LOCALES = {
  ZH_CN: 'zh-cn',
  EN: 'en',
  JA: 'ja'
}
// --------- LIST ---------
const MODEL_LIST_CONFIG = [
  MODEL_NAMES.CONFIG_DATA,
  MODEL_NAMES.CONFIG_REV,
  MODEL_NAMES.APPLICATION,
  MODEL_NAMES.WALLET
]
const MODEL_LIST_DEFAULT = [
  MODEL_NAMES.ADDRESS,
  MODEL_NAMES.ORDER,
  MODEL_NAMES.DELEGATION,
  MODEL_NAMES.SCAN_TASK,
  MODEL_NAMES.TASK_CONFIG,
  MODEL_NAMES.ETH_BATCH,
  MODEL_NAMES.ETH_FAUCET,
  MODEL_NAMES.AUDIT,
  MODEL_NAMES.AUDIT_BALANCE,
  MODEL_NAMES.RULER,
  MODEL_NAMES.BLOCK,
  MODEL_NAMES.ISSUE_RECORD,
  MODEL_NAMES.NOTIFICATION,
  MODEL_NAMES.WARNING
]
const MODEL_LIST_ADMIN = [
  MODEL_NAMES.ACCOUNT,
  MODEL_NAMES.ROLE,
  MODEL_NAMES.ACTION,
  MODEL_NAMES.NOTI_EMAIL
]
const ORDER_BIZTYPES_OUT = [
  ORDER_BIZTYPES.WITHDRAW,
  ORDER_BIZTYPES.SWEEP,
  ORDER_BIZTYPES.SWEEP_INTERNAL,
  ORDER_BIZTYPES.REFUND,
  ORDER_BIZTYPES.SYSTEM_CALL,
  ORDER_BIZTYPES.DELEGATE,
  ORDER_BIZTYPES.UNDELEGATE
]
const ORDER_BIZTYPES_IN = [
  ORDER_BIZTYPES.DEPOSIT,
  ORDER_BIZTYPES.AIRDROP,
  ORDER_BIZTYPES.RECHARGE,
  ORDER_BIZTYPES.RECHARGE_UNEXPECTED,
  ORDER_BIZTYPES.RECHARGE_INTERNAL,
  ORDER_BIZTYPES.RECHARGE_SPECIAL,
  ORDER_BIZTYPES.PRINCIPAL_FUND,
  ORDER_BIZTYPES.INTEREST_FUND
]
const ORDER_BIZTYPES_FUND = [
  ORDER_BIZTYPES.PRINCIPAL_FUND,
  ORDER_BIZTYPES.INTEREST_FUND
]
const ORDER_BIZTYPES_ASSET_FLOW = [
  ORDER_BIZTYPES.WITHDRAW,
  ORDER_BIZTYPES.SWEEP,
  ORDER_BIZTYPES.SWEEP_INTERNAL,
  ORDER_BIZTYPES.DEPOSIT,
  ORDER_BIZTYPES.AIRDROP,
  ORDER_BIZTYPES.RECHARGE,
  ORDER_BIZTYPES.RECHARGE_UNEXPECTED,
  ORDER_BIZTYPES.RECHARGE_INTERNAL,
  ORDER_BIZTYPES.RECHARGE_SPECIAL
]

module.exports = {
  DEFAULT_KEY,
  DEFAULT_ENCODE,
  PROCESS,
  SERVICE_NAMES,
  SIO_EVENTS,
  SYSTEM_APPIDS,
  NSP_TYPES,
  LEDGER_MODES,
  ADDRESS_MODES,
  SERVER_TYPES,
  JOB_TYPES,
  DB_KEYS,
  MODEL_NAMES,
  MODEL_LIST_ADMIN,
  MODEL_LIST_CONFIG,
  MODEL_LIST_DEFAULT,
  PRIVKEY_SOURCES,
  ADDRESS_TYPE,
  ADDRESS_BIZ_MODES,
  ADDRESS_STATE,
  ORDER_STATE,
  ORDER_BIZTYPES,
  ORDER_BIZTYPES_IN,
  ORDER_BIZTYPES_OUT,
  ORDER_BIZTYPES_FUND,
  ORDER_BIZTYPES_ASSET_FLOW,
  ORDER_DEFAULT_ACTIONS,
  DELEGATION_STATE,
  ASYNC_PLAN_MODES,
  ASYNC_PLAN_SOURCES,
  ASYNC_PLAN_STATUS,
  ASYNC_PLAN_CATEGORY,
  BATCH_STATE,
  ISSUE_TYPES,
  ISSUE_STATE,
  SUPPORT_LOCALES,
  WARN_LEVEL
}
