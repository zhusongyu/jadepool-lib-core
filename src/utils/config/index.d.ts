import {
  ChainConfig,
  TokenConfig
} from "../../models";

/**
 * 读取默认配置中的token配置信息
 * @param chainKey
 * @param coinName
 */
export function loadCoinCfg(chain: string | ChainConfig, coinName: string): Promise<TokenConfig>
/**
 * 获取实时的可用coinNames
 * @param chainKey
 */
export function loadAllCoinNames(chain: string | ChainConfig, includeDisabled?: boolean): Promise<string[]>
/**
 * 获取实时的区块链配置
 * @param chainKey
 */
export function loadChainCfg(chainKey: string): Promise<ChainConfig>
/**
 * 获取实时的全部链名称
 */
export function loadAllChainNames(includeDisabled?: boolean): Promise<string[]>


/**
 * 该函数已无法使用
 * @param coinName
 * @deprecated
 */
export function fetchCoinCfg(): void;
/**
 * 该函数已无法使用
 * @deprecated
 */
export function fetchAllCoinNames(): void;
/**
 * 该函数已无法使用
 * @deprecated
 */
export function applyIgnoreKeys(): void;
/**
 * 该函数已无法使用
 * @deprecated
 */
export function fetchCoinCfgById(): void;
/**
 * 该函数已无法使用
 * @deprecated
 */
export function fetchChainCfg(): void;
/**
 * 该函数已无法使用
 * @deprecated
 */
export function fetchAllChainNames(): void;