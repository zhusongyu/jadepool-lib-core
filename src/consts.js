const consts = {}
// --------- STRING ---------
consts.DEFAULT_KEY = 'default'
consts.DEFAULT_ENCODE = 'base64'
// --------- MAP ---------
consts.PROCESS = {
  NAME_PREFIX: 'JP',
  LAUNCH_MODES: {
    /** 中心管理者 */
    MASTER: 'master',
    /** 附属管理者 */
    AGENT: 'agent',
    /** 具体事务执行者 */
    WORKER: 'worker',
    /** 服务提供者 */
    PROVIDER: 'provider'
  },
  TYPES: {
    ROUTER: 'app',
    ROUTER_SUB: 'sub',
    GENERAL: 'general',
    BLOCKCHAIN: 'chain',
    SERVICE: 'serv',
    UNKNOWN: 'unknown'
  }
}
consts.SERVICE_NAMES = {
  /** 活动记录 */
  ACTIVITY: 'activity',
  /** 默认错误信息 */
  ERROR_CODE: 'error.code',
  /** 后台任务服务 */
  JOB_QUEUE: 'job.queue',
  /** 消息队列 */
  MSG_QUEUE: 'msg.queue',
  /** Express HTTP服务 */
  APP: 'express',
  /** Koa HTTP服务 */
  KOA: 'koa',
  /** 根据生命周期运行脚本的服务 */
  SCRIPT: 'script',
  /** 进程服务 */
  PM2_PROCESS: 'pm2.process',
  /** 子进程管理服务 */
  CHILD_PROCESS: 'child.process',
  /** 异步计划任务服务 */
  ASYNC_PLAN: 'async.plan',
  /** 配置服务 */
  CONFIG: 'config',
  /** 基于ws的通用jsonrpc发送和接收服务 */
  JSONRPC: 'jsonrpc.client',
  /** 基于ws的通用jsonrpc服务端 */
  JSONRPC_SERVER: 'jsonrpc.server',
  /** 基于ws内部rpc服务 */
  INTERNAL_RPC: 'jsonrpc.internal',
  /** 基于consul的服务发现 */
  CONSUL: 'consul',
  /** Socket.io服务 */
  SOCKET_IO: 'socket.io',
  /** Socket.io的worker服务中心 */
  SIO_WORKER: 'socket.io.worker'
}
consts.SIO_EVENTS = {
  INVOKE_METHOD: 'invokeMethod'
}
consts.SYSTEM_APPIDS = {
  INTERNAL: 'self',
  DEFAULT: 'pri'
}
consts.NSP_TYPES = {
  NULL: 'null',
  COIN_TYPE: 'data.type',
  CHAIN_KEY: 'params.chain',
  AGENT: 'MASTER_AGENT'
}
consts.LEDGER_MODES = {
  LOCAL: 'local',
  RPC: 'rpc'
}
consts.SERVER_TYPES = {
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
consts.JOB_TYPES = {
  /** 循环任务 */
  EVERY: 'every',
  /** 普通任务 */
  NORMAL: 'normal',
  /** 计划任务 */
  SCHEDULE: 'schedule'
}
consts.DB_KEYS = {
  DEFAULT: 'default',
  CONFIG: 'config',
  ADMIN: 'admin'
}
consts.MODEL_NAMES = {
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
  ITEM: 'item',
  DELEGATION: 'delegation',
  ASYNC_PLAN: 'asyncplan',
  SCAN_TASK: 'scantask',
  TASK_CONFIG: 'admintaskcfg',
  AUDIT: 'audit',
  STATISTIC_BALANCE: 'statisticbalance',
  RULER: 'ruler',
  BLOCK: 'block',
  ISSUE_RECORD: 'issuerecord',
  NOTIFICATION: 'notification',
  WARNING: 'warning',
  ACTIVITY: 'activity',
  OPERATOR: 'operator',
  OPERATOR_GROUP: 'oprgroup',
  OPERATOR_RESOURCE: 'oprresource',
  // Admin Models
  ACCOUNT: 'account',
  ROLE: 'role',
  ACTION: 'action',
  NOTI_EMAIL: 'notiemail'
}
consts.ACTIVITY_CATEGORY = {
  API_INVOKE: 'api_invoke',
  USER: 'user',
  SYSTEM: 'system'
}
consts.MODEL_LIST_CONFIG = [
  consts.MODEL_NAMES.CONFIG_DATA,
  consts.MODEL_NAMES.CONFIG_REV,
  consts.MODEL_NAMES.APPLICATION,
  consts.MODEL_NAMES.WALLET,
  consts.MODEL_NAMES.WALLET_CHAIN,
  consts.MODEL_NAMES.WALLET_TOKEN
]
consts.MODEL_LIST_DEFAULT = [
  consts.MODEL_NAMES.ACTIVITY,
  consts.MODEL_NAMES.OPERATOR,
  consts.MODEL_NAMES.OPERATOR_GROUP,
  consts.MODEL_NAMES.OPERATOR_RESOURCE,
  consts.MODEL_NAMES.ADDRESS,
  consts.MODEL_NAMES.ORDER,
  consts.MODEL_NAMES.ITEM,
  consts.MODEL_NAMES.DELEGATION,
  consts.MODEL_NAMES.ASYNC_PLAN,
  consts.MODEL_NAMES.SCAN_TASK,
  consts.MODEL_NAMES.TASK_CONFIG,
  consts.MODEL_NAMES.ETH_BATCH,
  consts.MODEL_NAMES.ETH_FAUCET,
  consts.MODEL_NAMES.AUDIT,
  consts.MODEL_NAMES.STATISTIC_BALANCE,
  consts.MODEL_NAMES.RULER,
  consts.MODEL_NAMES.BLOCK,
  consts.MODEL_NAMES.ISSUE_RECORD,
  consts.MODEL_NAMES.NOTIFICATION
]
consts.MODEL_LIST_ADMIN = [
  consts.MODEL_NAMES.ACCOUNT,
  consts.MODEL_NAMES.ROLE,
  consts.MODEL_NAMES.ACTION,
  consts.MODEL_NAMES.NOTI_EMAIL
]

consts.PRIVKEY_SOURCES = {
  /** 来源seed软件 */
  SEED: 'seed',
  /** 纯签名密码机 */
  HSM_PURE: 'hsm_pure',
  /** 深度安全密码机 */
  HSM_DEEP: 'hsm_deep'
}
/** 区块配置中设置支持的地址模式 */
consts.ADDRESS_MODES = {
  MULTI: 'multi',
  SINGLE: 'single'
}
/** 地址模型中设置的地址业务模式 */
consts.ADDRESS_BIZ_MODES = {
  /** 按照瑶池默认规则进行修改 */
  AUTO: 'auto',
  /** 设置为自动sweepToHot的独立地址。 */
  DEPOSIT_WITH_ADDR: 'deposit',
  /** 设置为带MEMO的热主地址。 */
  DEPOSIT_WITH_MEMO: 'deposit_memo',
  /** 设置为普通类型的独立地址，不做任何处理 */
  NORMAL: 'normal'
}
consts.ADDRESS_STATE = {
  /** 刚创建 */
  NEW: 'new',
  /** 已分配使用 */
  USED: 'used',
  /** TODO 被屏蔽 */
  BLOCKED: 'blocked'
}
consts.ADDRESS_TYPE = {
  HOT_WALLET: 0, // 热主
  COLD_WALLET: 1, // 冷钱包
  DEPOSIT: 2, // 充值地址
  EXTERNAL: 3 // 外部地址
}
consts.ORDER_STATE = {
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
consts.ORDER_BIZTYPES = {
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
consts.ORDER_BIZTYPES_OUT = [
  consts.ORDER_BIZTYPES.WITHDRAW,
  consts.ORDER_BIZTYPES.SWEEP,
  consts.ORDER_BIZTYPES.SWEEP_INTERNAL,
  consts.ORDER_BIZTYPES.REVERT,
  consts.ORDER_BIZTYPES.REFUND,
  consts.ORDER_BIZTYPES.SYSTEM_CALL,
  consts.ORDER_BIZTYPES.DELEGATE,
  consts.ORDER_BIZTYPES.UNDELEGATE
]
consts.ORDER_BIZTYPES_IN = [
  consts.ORDER_BIZTYPES.DEPOSIT,
  consts.ORDER_BIZTYPES.AIRDROP,
  consts.ORDER_BIZTYPES.RECHARGE,
  consts.ORDER_BIZTYPES.RECHARGE_UNEXPECTED,
  consts.ORDER_BIZTYPES.RECHARGE_INTERNAL,
  consts.ORDER_BIZTYPES.RECHARGE_SPECIAL,
  consts.ORDER_BIZTYPES.PRINCIPAL_FUND,
  consts.ORDER_BIZTYPES.INTEREST_FUND
]
consts.ORDER_BIZTYPES_FUND = [
  consts.ORDER_BIZTYPES.PRINCIPAL_FUND,
  consts.ORDER_BIZTYPES.INTEREST_FUND
]
consts.ORDER_BIZTYPES_ASSET_FLOW = [
  consts.ORDER_BIZTYPES.WITHDRAW,
  consts.ORDER_BIZTYPES.SWEEP,
  consts.ORDER_BIZTYPES.SWEEP_INTERNAL,
  consts.ORDER_BIZTYPES.DEPOSIT,
  consts.ORDER_BIZTYPES.AIRDROP,
  consts.ORDER_BIZTYPES.RECHARGE,
  consts.ORDER_BIZTYPES.RECHARGE_UNEXPECTED,
  consts.ORDER_BIZTYPES.RECHARGE_INTERNAL,
  consts.ORDER_BIZTYPES.RECHARGE_SPECIAL
]
consts.ITEM_STATE = {
  STOCKING: 'stocking',
  IN_STOCK: 'in-stock',
  IN_RESERVE: 'in-reserve',
  OUT_OF_STOCK: 'out-of-stock'
}
consts.DELEGATION_STATE = {
  /** 未抵押 */
  UNSTAKED: 0,
  /** 移除抵押中 */
  UNSTAKING: 1,
  /** 抵押中 */
  STAKED: 2
}
consts.PROCESS_STATUS = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  ABORTED: 'aborted'
}
consts.ASYNC_PLAN_MODES = {
  SERIES: 'series',
  PARALLEL: 'parallel'
}
consts.ASYNC_PLAN_SOURCES = {
  SYSTEM: 'system',
  ADMIN: 'admin',
  APP: 'application'
}
consts.ASYNC_PLAN_STATUS = consts.PROCESS_STATUS
consts.ASYNC_PLAN_CATEGORY = {
  INTERNAL_ORDER: 'internalOrder',
  EXECUTE_ACTION: 'executeAction'
}
consts.ORDER_DEFAULT_ACTIONS = {
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
  /** 人为控制定义的充值 */
  EXTRA_DEPOSIT: 'extra-deposit',
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
consts.BATCH_STATE = {
  STARTED: 'started', // 批处理交易已经开始
  DONE: 'done', // 批处理交易全部正确结束
  FAILED: 'failed' // 批处理交易全部结束，其中有failed的交易
}
consts.ISSUE_TYPES = {
  ORDER_HOLDING: 'orderHolding',
  ORDER_UNEXPECTED: 'orderUnexpected',
  CONTRACT_UNKNOWN_ISSUE: 'contractUnknownIssue'
}
consts.ISSUE_STATE = {
  OPENED: 'opened',
  PROCESSING: 'processing',
  VALIDATING: 'validating',
  RESOLVED: 'resolved'
}
consts.WARN_LEVEL = {
  CRITICAL: 'CRITICAL', // 致命错误
  MAJOR: 'MAJOR', // 主要错误
  MINOR: 'MINOR', // 次要错误
  WARNING: 'WARNING' // 警告
}
consts.SUPPORT_LOCALES = {
  ZH_CN: 'zh-cn',
  EN: 'en',
  JA: 'ja'
}

module.exports = consts
