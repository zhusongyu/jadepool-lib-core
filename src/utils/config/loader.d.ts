
declare interface ConfigDat {
	toMerged: Function
	geneTemplate: Function
	applyModify: Function
	save: Function
}

/**
 * 设置是否自动保存
 * @param {boolean} value
 * @param value 
 */
export declare function setAutoSaveWhenLoad(value : boolean): void;

/**
 * 从数据库中读取配置，若该配置不存在，则从文件中读取并保存到数据库
 * @param cfgPath 目录名
 * @param key 子目录名
 * @param parent 
 * @param forceSelf
 */
export declare function loadConfig(cfgPath: string, key: string, parent: ConfigDat, forceSelf: boolean): Promise<ConfigDat>;

/**
 * 从数据库中读取path相同的全部配置，同时也从文件夹中读取全部路径
 * @param cfgPath 
 * @param parent 
 */
export declare function loadConfigKeys(cfgPath: string, parent: ConfigDat): Promise<string[]>;

/**
 * 保存配置修改
 * @param cfgPath 目录名
 * @param key 子目录名
 * @param modJson 配置修改Json，需Merge
 * @param disabled 是否禁用
 * @param parent
 */
export declare function saveConfig(cfgPath: string, key: string, modJson: object | undefined, disabled: boolean | undefined, parent: ConfigDat): Promise<ConfigDat>;

/**
 * 从数据库中删除配置，该配置必须是customized的配置
 * @param cfgPath 目录名
 * @param key 子目录名
 * @param parent 
 */
export declare function deleteConfig(cfgPath: string, key: string, parent: ConfigDat): Promise<boolean>;
 