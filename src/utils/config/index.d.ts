import {
  WalletSourceType,
  WalletSourceConfig,
  WalletCoinInfo,
  TokenConfigBasic,
  TokenConfigJadepool
} from "../../models";

interface CoinConfig {
  name: string
  chain: string
  chainKey: string
  /** 该币种是否启用 */
  tokenEnabled: boolean
  /** 该币种充提是否启用 */
  depositWithdrawEnabled: boolean
  type: string
  rate: number
  basic: TokenConfigBasic
  jadepool: TokenConfigJadepool
  /** @deprecated */
  enabled?: boolean
  /** @deprecated */
  disabled?: boolean
}

interface WalletDefaultsConfig {
  hotSource: WalletSourceType,
  coldSource: WalletSourceType,
  data: WalletSourceConfig,
  coins: WalletCoinInfo[]
}

interface ChainConfig {
  // 基础参数
  /** 数据表记录的_id */
  id: string
  /** 该链是否被启用 */
  disabled: boolean
  /** 区块链显示名 */
  key: string
  /** 区块链显示名 */
  Chain:string
  /** 衍生路径中的chainIndex */
  ChainIndex: number
  /** 衍生路径中的accountIndex offset */
  MainIndexOffset?: number
  /** 钱包的默认Source配置 */
  WalletDefaults: WalletDefaultsConfig
  /** 主要货币名，通常为费用币 */
  CoreType: string
  /** 区块链实现的形式 */
  ledgerMode: string
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
  /** 是否支持扩展代币 */
  tokenExtendsEnabled: boolean
  tokenTypes: string[]
  tokenTemplate: object
  /** 是否需要在线验证地址 */
  addressOnline: boolean
  /** 地址模型 */
  addressMode: string
  /** 支持的地址业务模型 */
  addressBizModes?: string[]
  stakeEnabled?: boolean
  stakeOptions?: {
    stakeToken: string
  }
  // 细节参数
  tokens: object
  node: object
  agenda?: object
  closer: object
}

/**
 * 获取callbackUrl
 * @deprecated
 * @param category 回调地址类型
 * @param customUrl 自定义的URL
 */
export function fetchCallbackUrl(category: string, customUrl?: string): string

/**
 * 根据config.configMods.{type} 将对象进行unset
 * @param types 逗号分隔类型
 * @param jsonObj 处理的对象
 */
export function applyIgnoreKeys(types: string, jsonObj: object): object

/**
 * 获取CoinCfg,在配置的Coin均可获取
 * @param coinName
 * @param useCached
 */
export function fetchCoinCfg(coinName: string, useCached?: boolean): CoinConfig

/**
 * 获取区块链配置,仅有效链可获取
 * @param nameOrKeyOrCoreType
 */
export function fetchChainCfg(nameOrKeyOrCoreType: string): ChainConfig

/**
 * 获取相关链的全部货币名
 * @param chainKey 可选，若不填则返回该进程负责的全部区块链
 */
export function fetchAllCoinNames(chainKey?: string): string[]

/**
 * 获取该进程负责的全部链名称
 */
export function fetchAllChainNames(): string[]

/**
 * 获取实时的CoinCfg
 * @param coinName
 * @param useCached
 */
export function loadCoinCfg(chain: string | ChainConfig, coinName: string): Promise<CoinConfig>
/**
 * 获取实时的CoinCfg
 * @param coinName 格式需要为 chainKey.coinName
 */
export function loadCoinCfg(coinName: string): Promise<CoinConfig>

/**
 * 获取实时的区块链配置
 * @param chainKey
 */
export function loadChainCfg(chainKey: string): Promise<ChainConfig>

/**
 * 获取实时的相关链的全部货币名
 * @param chainKey 可选，若不填则返回该进程负责的全部区块链
 */
export function loadAllCoinNames(chainKey?: string): Promise<string[]>

/**
 * 获取实时的全部链名称
 */
export function loadAllChainNames(): Promise<string[]>
