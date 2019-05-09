import {
  WalletSourceType,
  WalletSourceConfig,
  WalletCoinInfo,
  TokenConfigBasic,
  TokenConfigJadepool,
  ChainConfig
} from "../../models";

/**
 * 根据config.configMods.{type} 将对象进行unset
 * @param types 逗号分隔类型
 * @param jsonObj 处理的对象
 */
export function applyIgnoreKeys(types: string, jsonObj: object): object
/**
 * 获取区块链配置,仅有效链可获取
 * @param nameOrKeyOrCoreType
 */
export function fetchChainCfg(nameOrKeyOrCoreType: string): ChainConfig
/**
 * 获取该进程负责的全部链名称
 */
export function fetchAllChainNames(): string[]
/**
 * 获取实时的区块链配置
 * @param chainKey
 */
export function loadChainCfg(chainKey: string): Promise<ChainConfig>
/**
 * 获取实时的全部链名称
 */
export function loadAllChainNames(): Promise<string[]>


/**
 * 该函数已无法使用
 * @param coinName
 * @deprecated
 */
export function fetchCoinCfg(coinName: string): any
/**
 * 该函数已无法使用
 * @deprecated
 */
export function fetchAllCoinNames(chainKey?: string): string[]
/**
 * 该函数已无法使用
 * @deprecated
 */
export function loadCoinCfg(chain: string | ChainConfig, coinName: string): Promise<any>
/**
 * 该函数已无法使用
 * @deprecated
 */
export function loadCoinCfg(coinName: string): Promise<any>
/**
 * 该函数已无法使用
 * @deprecated
 */
export function loadAllCoinNames(chainKey?: string): Promise<string[]>
