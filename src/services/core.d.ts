/**
 * Service基类
 */
declare class BaseService {
	/**
	 * @param name 
	 * @param services 
	 */
	constructor (name : string, services : any);
		
	/**
	 * @returns {String}
	 */
	name : string;

	/**
	 * 初始化服务
	 */
	initialize(opts: any): Promise<void>;
}

export = BaseService;
