import { ConfigDatDocument } from "../../models";

/**
 * 设置是否自动保存
 * @param value 
 */
export declare function setAutoSaveWhenLoad(value : boolean): void;

/**
 * 设置path + key的别名目录
 * 对于loadConfig来说，只取最后一个被设置的别名目录
 * 对于loadConfigKeys来说，别名目录 + config目录下的结果都将累加到最终结果
 * @param path 
 * @param key 
 * @param aliasPath 
 */
export declare function setAliasConfigPath(path: string, key: string, aliasPath: string): void;

/**
 * 从数据库中读取配置，若该配置不存在，则从文件中读取并保存到数据库
 * @param cfgPath 目录名
 * @param key 子目录名
 * @param parent
 */
export declare function loadConfig(cfgPath: string, key: string, parent?: ConfigDatDocument): Promise<ConfigDatDocument>;

/**
 * 从数据库中读取path相同的全部配置，同时也从文件夹中读取全部路径
 * @param cfgPath 
 * @param parent 
 */
export declare function loadConfigKeys(cfgPath: string, parent?: ConfigDatDocument, includeDisabled?: boolean): Promise<string[]>;

/**
 * 保存配置修改
 * @param cfgPath 目录名
 * @param key 子目录名
 * @param modJson 配置修改Json，需Merge
 * @param disabled 是否禁用
 * @param parent
 */
export declare function saveConfig(cfgPath: string, key: string, modJson: object | undefined, disabled: boolean | undefined, parent?: ConfigDatDocument): Promise<ConfigDatDocument>;

/**
 * 从数据库中删除配置，该配置必须是customized的配置
 * @param cfgPath 目录名
 * @param key 子目录名
 * @param parent 
 */
export declare function deleteConfig(cfgPath: string, key: string, parent: ConfigDatDocument): Promise<boolean>;
 