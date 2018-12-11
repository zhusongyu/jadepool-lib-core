// --------- STRING ---------
const DEFAULT_KEY = 'default'
// --------- MAP ---------
const PROCESS = {
  NAME_PREFIX: 'Jadepool',
  CLUSTER_MODES: {
    AUTO: 'auto',
    NODE: 'node',
    PM2: 'pm2'
  },
  LAUNCH_MODES: {
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
  ERROR_CODE: 'error.code', // 默认错误信息
  AGENDA: 'agenda', // 后台任务服务
  APP: 'express', // HTTP/HTTPS服务
  SCRIPT: 'script', // 根据生命周期运行脚本的服务
  JSONRPC: 'jsonrpc', // 基于ws的通用jsonrpc发送和接收服务
  JSONRPC_SERVER: 'jsonrpc.server', // 基于ws的通用jsonrpc服务端
  SOCKET_IO: 'socket.io', // Socket.io服务
  SIO_WORKER: 'sio.woker' // Socket.io的worker服务中心
}
const SIO_EVENTS = {
  INVOKE_METHOD: 'invokeMethod'
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
const ADDRESS_MODES = {
  MULTI: 'multi',
  SINGLE: 'single'
}
const SERVER_TYPES = {
  API: 'api',
  MAIN: 'main',
  SAFE: 'safe'
}
const JOB_TYPES = {
  EVERY: 'every', // 循环任务
  NORMAL: 'normal', // 普通任务
  SCHEDULE: 'schedule' // 计划任务
}
const ADDRESS_STATE = {
  NEW: 'new', // 刚创建
  USED: 'used', // 已分配使用
  BLOCKED: 'blocked' // TODO 被屏蔽
}
const ORDER_STATE = {
  INIT: 'init', // 订单初始化
  HOLDING: 'holding', // 1. init与online之间的一个过渡状态，只有发送tx上链出错时，订单会永久保持该holding状态，需要人工介入；否则，该状态会在很短时间就变为online
  ONLINE: 'online', // 订单已发送
  PENDING: 'pending', // 订单已上链
  FAILED: 'failed', // 订单交易失败
  DONE: 'done' // 订单完成
}
const ORDER_BIZTYPES = {
  WITHDRAW: 'WITHDRAW', // 出：提现订单
  SWEEP: 'SWEEP', // 出：热转冷
  SWEEP_INTERNAL: 'SWEEP_INTERNAL', // 出：内部
  DEPOSIT: 'DEPOSIT', // 入：充值订单
  AIRDROP: 'AIRDROP', // 入：空投
  RECHARGE: 'RECHARGE', // 入：冷转热
  RECHARGE_SPECIAL: 'RECHARGE_SPECIAL', // 入：特殊充值
  RECHARGE_INTERNAL: 'RECHARGE_INTERNAL', // 入：内部
  RECHARGE_UNEXPECTED: 'RECHARGE_UNEXPECTED' // 入：意外收入
}
const BATCH_STATE = {
  STARTED: 'started', // 批处理交易已经开始
  DONE: 'done', // 批处理交易全部正确结束
  FAILED: 'failed' // 批处理交易全部结束，其中有failed的交易
}
const ISSUE_TYPES = {
  ORDER_HOLDING: 'orderHolding'
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
// --------- LIST ---------
const ORDER_BIZTYPES_OUT = [
  ORDER_BIZTYPES.WITHDRAW,
  ORDER_BIZTYPES.SWEEP,
  ORDER_BIZTYPES.SWEEP_INTERNAL
]
const ORDER_BIZTYPES_IN = [
  ORDER_BIZTYPES.DEPOSIT,
  ORDER_BIZTYPES.AIRDROP,
  ORDER_BIZTYPES.RECHARGE,
  ORDER_BIZTYPES.RECHARGE_UNEXPECTED,
  ORDER_BIZTYPES.RECHARGE_INTERNAL,
  ORDER_BIZTYPES.RECHARGE_SPECIAL
]

module.exports = {
  DEFAULT_KEY,
  PROCESS,
  SERVICE_NAMES,
  SIO_EVENTS,
  NSP_TYPES,
  LEDGER_MODES,
  ADDRESS_MODES,
  SERVER_TYPES,
  JOB_TYPES,
  ADDRESS_STATE,
  ORDER_STATE,
  ORDER_BIZTYPES,
  ORDER_BIZTYPES_IN,
  ORDER_BIZTYPES_OUT,
  BATCH_STATE,
  ISSUE_TYPES,
  ISSUE_STATE,
  WARN_LEVEL
}
