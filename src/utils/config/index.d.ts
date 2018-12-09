interface CoinConfig {
  disabled: boolean,
  name: string,
  chain: string,
  chainKey: string,
  rate: number,
  basic: {
    Rate: number
  },
  jadepool: object
}

interface ChainConfig {
  // 基础参数
  key: string,
  Chain:string,
  ChainIndex: number,
  CoreType: string,
  ledgerMode: string,
  ledgerOptions: {
    file?: string,
    rpc?: string
  },
  tokenExtendsEnabled: boolean,
  addressMode: string,
  // 细节参数
  tokens: object,
  node: object,
  agenda: object,
  closer: object
}

/**
 * 获取callbackUrl
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
