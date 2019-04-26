import mongoose from 'mongoose'

interface Rule {
  action: string
  permission: '' | 'r' | 'rw'
}

interface KeyData {
  category: 'ecc'
  key: string
  encode: string
}

export declare interface AppDocument extends mongoose.Document {
  /** 唯一ID */
  id: string
  /** 应用描述 */
  desc?: string
  /** RESTFUL权限 */
  resouces: Rule[]
  /** 验签公钥 */
  accepts: KeyData[]
  /** 回调地址 */
  callbacks: Object
  /** 额外信息 */
  data: Object
  /**
   * 验证是否具有某权限
   * @param action 权限名
   * @param permission 权限类型
   */
  checkPermission (action: string, permission: '' | 'r' | 'rw'): boolean
  /**
   * 返回全部可接受的公钥
   */
  getPublicKeys (): Buffer[]
  /**
   * 获取category对应的callback url
   * @param category
   */
  getCallbackUrl (category: string): string | undefined
  /**
   * 获取App参数
   * @param path
   */
  getData (path: string): string
}

declare interface OnePlan {
  /** 任务种类 */
  category: string
  /** 该字段为选填，即该任务执行的名字空间，通常为区块链Key */
  namespace?: string
  /** 该字段必须设置，即为该任务执行的具体内容 */
  method: string
  /** 该字段为选填，即为该任务执行内容的参数 */
  params: any
}

declare interface OnePlanData extends OnePlan {
  /** EXECUTE_ACTION类型完成条件: result/error被设置 */
  result?: string
  /** 运行错误 */
  error?: string
  /** INTERNAL_ORDER类型完成条件：order done */
  order?: mongoose.Schema.Types.ObjectId
  /** 开始运行时间 */
  started_at?: Date
  /** 结束运行时间 */
  finished_at?: Date
}

export declare interface AsyncPlanDocument extends mongoose.Document {
  /** ID */
  _id: mongoose.Schema.Types.ObjectId
  /** 类型 */
  mode: string
  /** 来源 */
  source: string
  /** 来源id */
  source_id?: string
  /** 参考Plan */
  refer?: mongoose.Schema.Types.ObjectId
  /** 完成结果 */
  status?: string
  /** 任务进度 */
  finished_steps: number
  /** 计划任务列表 */
  plans: OnePlanData[]
  /** 执行计划, 不为null时为新任务 */
  run_at?: Date
  /** 开始运行时间 */
  started_at?: Date
  /** 结束运行时间 */
  finished_at?: Date
}
