import mongoose from 'mongoose'

export as namespace models

declare interface ConfigDatDocument extends mongoose.Document  {
  /** 服务端名称 */
  server: string
  /** 当前配置适用的版本，新版配置将根据该字段来刷新origin字段 */
  version: string
  /** 该配置内容的核心父级，通常为大类别例如区块链分类等 */
  parent?: mongoose.Schema.Types.ObjectId
  /** 判断该字段是否为客户自定义配置 */
  customized?: boolean
  /** 设置true将强制加载origin数据 */
  dirty: boolean
  /** 该配置内容在配置文件中的父路径。若存在parent，则是相对parent所在的文件夹路径 */
  path: string
  /** 该配置内容在配置文件中的key，同时也是配置文件的文件夹名，为空即为当前path */
  key: string
  /** 保存JSON.stringify，从原始配置文件中读取的config数据 */
  origin: string
  /** 可修改选项，保存JSON.stringify，被修改的配置 */
  modified: string
  /** 可选，可修改选项，该配置内容是否被禁用 */
  disabled: boolean
  /** apply mod */
  applyModify(jsonToSave: string): ConfigDatDocument
  /** merge config */
  toMerged(): object
}

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
  /** 指向wallet */
  wallet?: mongoose.Schema.Types.ObjectId
  /** RESTFUL权限 */
  resouces: Rule[]
  /** 验签公钥 */
  accepts: KeyData[]
  /** 回调地址 */
  callbacks: Object
  /** 额外信息 */
  data: Object
  /**
   * 设置该app使用的wallet
   * @param WalletDocument 
   */
  setWallet (wallet: WalletDocument | mongoose.Schema.Types.ObjectId | string): Promise<AppDocument>
  /**
   * 获取该app指向的Wallet信息
   */
  getWallet (): Promise<WalletDocument>
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

declare interface WalletSourceConfig {
  /** 当source为seed时，需要设置 */
  seedKey: string
  /** 当source为hsm时，需要设置 */
  hsmKey?: string
  /** 额外参数 */
  [key: string]: string
}

declare interface WalletSourceData extends WalletSourceConfig {
  // 缓存，可供比较变化，最后一次设置进去
  hotAddress?: string
  coldAddress?: string
  cachedAt?: Date
}

declare interface TokenConfigBasic {
  Rate: number
  Type: string
  GasLimit?: number
  GasPrice?: number
  GasPrices?: string
  GasCoefficient?: number
  FeeSelector?: number
  FeeForWithdraw?: number
  ActivateBalance?: number
  Expiration?: number
  MinThreshold?: number
  Dust?: number
  PropertyId?: number
  TokenName?: string
  Contract?: string
}

declare interface TokenConfigJadepool {
  /** 高水位 */
  HighWaterLevel: number
  /** 高水位转出后目标 */
  SweepTo: number
  /** 低水位 */
  LowWaterLevel: number
  /** 自动重发设置阈值 */
  SendAgainCap: number
  /** 自动汇总阈值 */
  SweepToHotCap: number
  /** 一批sendOrder的数量(二选一,作用相同仅显示不同) */
  BatchCount?: number
  /** 一批sendOrder的数量(二选一,作用相同仅显示不同) */
  MaxOrdersInOneTx?: number
  // 自动汇总的地址类
  SweepToHotCap?: number
  SendAgainCap?: number
  // UTXO类
  MergedBalance?: boolean
  AvailableUtxoCap?: number
  MaxInputsInOneTx?: number
  // 空投
  Airdrop: {
    enabled: boolean
    Address: string
  }
}

declare interface TokenConfig {
  coin?: TokenConfigBasic
  jadepool?: TokenConfigJadepool
}

declare interface TokenStatus {
  depositDisabled: Boolean
  withdrawDisabled: Boolean
}

declare interface WalletCoinInfo {
  /** 币种简称 */
  name: string
  /** 私钥源可选配置，将覆盖chain默认config */
  data: WalletSourceData
  status: TokenStatus
  /** 配置加载 */
  config?: TokenConfig
}

declare interface TokenShortCut {
  /** 相关区块链显示名 */
  chain: string
  /** 相关区块链Key */
  chainKey: string
  /** 相关核心币 */
  coreType: string
  /** 该币种是否启用 */
  tokenEnabled: boolean
  /** 该币种充提是否启用 */
  depositWithdrawEnabled: boolean
  /** 该币种类别 */
  type: string
  /** 该币种兑换率 */
  rate: number
}

declare interface TokenInfo extends WalletCoinInfo {
  /** 快捷参数 */
  shortcut: TokenShortCut
}

declare interface ChainConfig {
  // 基础参数
  /** 数据表记录的_id */
  id: string
  /** 区块链Key */
  key: string
  /** 该链是否被完整禁用 */
  disabled: boolean
  /** 主要货币名，通常为费用币 */
  CoreType: string
  /** 区块链显示名 */
  Chain:string
  /** 衍生路径中的chainIndex */
  ChainIndex: number
  /** 衍生路径中的accountIndex offset */
  MainIndexOffset?: number
  /** 钱包的默认Source配置 */
  WalletDefaults: WalletChainInfo
  /** 区块链实现的形式 */
  ledgerMode: 'local' | 'rpc'
  ledgerOptions: {
    file?: string,
    rpc?: string
  }
  generalOptions: {
    RescanMode: string
    AffirmativeConfirmation: number
    FailedAffirmativeConfirmation: number
    sendOrdersInterval: number
    waitingSendOrdersOnline: boolean
  }
  closer: {
    softForkIgnoreCap: number
    previousBlocks: number
    scanBlockTaskCap: number
    scanAddressTaskCap: number
  }
  /** 是否支持扩展代币 */
  tokenExtendsEnabled: boolean
  tokenTypes: string[]
  tokenTemplates?: string[]
  /** 是否需要在线验证地址 */
  addressOnline: boolean
  /** 地址模型 */
  addressMode: 'multi' | 'single'
  /** 支持的地址业务模型 */
  addressBizModes?: string[]
  /** stake */
  stakeEnabled?: boolean
  stakeOptions?: {
    stakeToken: string
  }
  /** explorers config */
  explorers: string[] | { type: string, name: string, url: string }[]
  /** 节点配置 */
  endpoints: string[] | { type: string, name: string, url?: string, [key: string]: string }[]
}

type WalletSourceType = 'seed' | 'hsm_pure' | 'hsm_deep'

declare interface WalletChainStatus {
  /** 在该钱包内是否被禁用 */
  enabled: boolean
  // 状态参数
  coinsEnabled: string[]
}

declare interface WalletChainInfo {
  chainKey: string
  source: {
    hot: WalletSourceType
    cold: WalletSourceType
  }
  // 私钥源必选配置
  data: WalletSourceData
  status: WalletChainStatus
  /** 配置加载 */
  config?: ChainConfig
}

declare interface WalletChain extends WalletChainInfo  {
  // 钱包中的币种状态信息
  coins: WalletCoinInfo[]
}

declare interface WalletDocument extends mongoose.Document {
  /** unique name */
  name: string
  /** description */
  desc?: string
  /** version */
  version?: string
  /** 钱包index */
  mainIndex: number
  /** 可用账号index */
  addrIndex: number
  /** blockchain infos */
  chains: WalletChain[]

  /**
   * 设置并获取下一个Address的index
   */
  nextAddressIndex (): Promise<number>
  /**
   * set SourceType and data
   * @param chainKey blockchain key
   * @param walletDefaults wallet config defaults
   * @param enabled if blockchain enabled
   * @param isSave save or not
   */
  updateWalletData (chainKey: string, walletDefaults: WalletChainInfo, enabled: boolean, isSave?: boolean): Promise<WalletDocument>
  /**
   * set chain's enabled coins
   * @param chainKey blockchain key
   * @param status 状态配置
   */
  setChainStatus (chainKey: string, status: WalletChainStatus): Promise<WalletDocument>
  /**
   * set token enabled status
   * @param chainKey blockchain key
   * @param coinName coin unique name
   * @param status 状态配置
   * @param isSave save or not
   */
  setTokenStatus (chainKey: string, coinName: string, status: TokenStatus): Promise<WalletDocument>
  /**
   * set SourceData in exists chainData
   * @param chainKey blockchain key
   * @param coin specific coin scope or chain scope
   * @param sourceData all data of private key source including caching data
   */
  setSourceData (chainKey: string, coin: string | undefined, sourceData: WalletSourceData): Promise<WalletDocument>
  /**
   * get SourceData
   * @param chainKey blockchain key
   * @param coin specific coin scope or chain scope
   */
  getSourceData (chainKey: string, coin?: string): WalletSourceData
  /**
   * load chain information
   * @param chainKey
   */
  loadChainInfo (chainKey: string): Promise<WalletChainInfo>
  /**
   * load token information
   * @param chainKey
   * @param coinName
   */
  loadTokenInfo (chainKey: string, coinName: string): Promise<TokenInfo>
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
