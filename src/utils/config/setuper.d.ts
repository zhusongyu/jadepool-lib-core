/**
 * 加载并处理配置
 * @param name 名称
 * @param enableAutoSave 自动保存
 */
export declare function setupConfig(name : string, enableAutoSave : boolean): Promise<void>;

/**
 * 加载全部配置
 */
export declare function setupAll(): Promise<void>;
