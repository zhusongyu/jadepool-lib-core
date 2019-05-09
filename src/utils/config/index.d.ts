import {
  WalletSourceType,
  WalletSourceConfig,
  WalletCoinInfo,
  TokenConfigBasic,
  TokenConfigJadepool,
  ChainConfig
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
