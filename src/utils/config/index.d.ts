interface CoinConfig {
  name: string,
  chain: string,
  chainKey: string,
  /** 该币种是否启用 */
  tokenEnabled: boolean,
  /** 该币种充提是否启用 */
  depositWithdrawEnabled: boolean,
  type: string,
  rate: number,
  basic: {
    Rate: number
  },
  jadepool: object
  /** @deprecated */
  enabled?: boolean,
  /** @deprecated */
  disabled?: boolean,
}

interface ChainConfig {
  // 基础参数
  id: string,
  disabled: boolean,
  key: string,
  Chain:string,
  ChainIndex: number,
  CoreType: string,
  ledgerMode: string,
  ledgerOptions: {
    file?: string,
    rpc?: string
  },
  generalOptions: object,
  tokenExtendsEnabled: boolean,
  tokenTypes: string[],
  tokenTemplate: object,
  addressMode: string,
  addressOnline: boolean,
  addressWaitForUse?: boolean,
  addressBizModes?: string[],
  systemCallEnabled?: boolean,
  stakeEnabled?: boolean,
  stakeOptions?: {
    stakeToken: string
  },
  // 细节参数
  tokens: object,
  node: object,
  agenda?: object,
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
