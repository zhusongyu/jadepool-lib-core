import mongoose from 'mongoose'

export as namespace models

interface Rule {
  action: string
  permission: '' | 'r' | 'rw'
}

interface KeyData {
  category: 'ecc'
  key: string
  encode: string
}

declare interface AppDocument extends mongoose.Document {
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

declare interface AsyncPlanDocument extends mongoose.Document {
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

declare interface WalletSourceData {
  /** 当source为seed时，需要设置 */
  seedKey: string
  /** 当source为hsm时，需要设置 */
  hsmKey?: string
  // 缓存，可供比较变化，最后一次设置进去
  hotAddress?: string
  coldAddress?: string
  cachedAt?: Date
}

declare interface WalletCoinInfo {
  /** 币种简称 */
  coinName: string
  /** 私钥源可选配置，将覆盖chain默认config */
  data?: WalletSourceData
}

type WalletSourceType = 'seed' | 'hsm_pure' | 'hsm_deep'

declare interface WalletChainInfo  {
  chainKey: string
  hotSource: WalletSourceType
  coldSource: WalletSourceType
  // 私钥源必选配置
  data: WalletSourceData
  // 钱包中的币种状态信息
  coins: WalletCoinInfo[]
}

declare interface WalletDocument extends mongoose.Document {
  /** unique name */
  name: string
  /** description */
  desc: string
  /** 钱包index */
  mainIndex: number
  /** 可用账号index */
  addrIndex: number
  /** blockchain infos */
  chains: WalletChainInfo[]

  /**
   * 设置并获取下一个Address的index
   */
  nextAddressIndex (): Promise<number>
  /**
   * set SourceType and data
   * @param chainKey blockchain key
   * @param hotSource hot wallet private key source
   * @param coldSource cold wallet private key source
   * @param sourceData source config
   */
  setSourceType (chainKey: string, hotSource: WalletSourceType, coldSource: WalletSourceType, sourceData?: WalletSourceData): Promise<WalletDocument>
  /**
   * set SourceData in exists chainData
   * @param chainKey blockchain key
   * @param coinName specific coin scope or chain scope
   * @param sourceData all data of private key source including caching data
   */
  setSourceData (chainKey: string, coinName: string | undefined, sourceData: WalletSourceData): Promise<WalletDocument>
  /**
   * get SourceData
   * @param chainKey blockchain key
   * @param coinName specific coin scope or chain scope
   */
  getSourceData (chainKey: string, coinName?: string): { hotSource: WalletSourceType, coldSource: WalletSourceType } | WalletSourceData
  /**
   * 获取热主地址的衍生路径
   * 衍生路径规则为 m/44'/{chainIndex}'/{accountIndex}'/1/{hotIndex}
   * @param chainIndex 区块链Index
   * @param [hotIndex=0] 热主地址的序号
   * @param [accountOffset=0] 当该coin占用了相同的chainIndex，则需要使用offset来错开位置。取值范围为[0-99]
   */
  getHotDerivativePath (chainIndex: number, hotIndex?: number, accountOffset?: number): string
  /**
   * 获取外部地址的衍生路径
   * 衍生路径规则为 m/44'/{chainIndex}'/{accountIndex}'/0/{addrIndex}
   * @param chainIndex 区块链Index
   * @param [addrIndex=undefined] 地址序号
   * @param [accountOffset=0] 当该coin占用了相同的chainIndex，则需要使用offset来错开位置
   */
  getAddressDerivativePath (chainIndex: number, addrIndex?: number, accountOffset?: number): string
}
