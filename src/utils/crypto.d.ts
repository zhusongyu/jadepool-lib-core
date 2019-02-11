interface BuildSignedObjRet {				
	code: number;
	status : number;
	message : string;
	result : any;
}

interface HashOptions {
	sort: 'key-alphabet' | 'key' | 'kvpair' | 'value';
	hash: 'sha3' | 'md5' | 'sha256';
	encode: 'base64' | 'hex';
}

interface SignOptions extends HashOptions {
	accept: 'string' | 'object';
	withoutTimestamp: boolean;
}

interface SigObject {
	signature: object | string,
	recovery: number,
	timestamp: number | undefined
}

interface KeyPair {
	priKey: string;
	pubKey: string;
	pubKeyUnCompressed: string;
}

/**
 * 获取本系统 Private Key
 * @param {String} cryptoType
 * @param cryptoDat 
 */
export function getPriKey(cryptoDat?: any): Promise<Buffer>;
		
/**
 * 重置本系统的 Private Key
 */
export function refreshPriKey(): Promise<KeyPair>;
	
/**
 * 判断是否为Public Key
 * @param pubKeyStr 
 * @param encode 
 * @param compress 
 * @return  
 */
export function pubKeyVerify(pubKeyStr: string, encode: string, compress?: boolean): Buffer | null;

/**
 * 获取 Public Key
 * @deprecated
 * @param cryptoType 
 * @param category 
 * @param compress 
 * @param cryptoDat 
 * @return  
 */
export function fetchPubKey(cryptoType: string, category: string, compress?: boolean, cryptoDat?: any): Promise<Buffer>;

/**
 * 获取某AppId对应的公钥们
 * @param appid 应用id
 * @param compress
 */
export function fetchPublicKeys (appid: string, compress?: boolean): Promise<Buffer[]>;
	
/**
 * 封装需签名的对象
 * @param obj 
 * @param errMsg 
 * @param sigAccept 
 * @return  
 */
export function buildSignedObj(obj: any, errMsg: string, sigAccept?: 'object' | 'string'): Promise<BuildSignedObjRet>;
	
/**
 * 获取内部私钥
 */
export function getInternalPriKey(): Promise<Buffer>;
	
/**
 * 获取内部公钥
 */
export function getInternalPubKey(): Promise<Buffer>;

/**
 * 内部签名检查函数
 * @param data
 * @param timestamp
 * @param opts
 */
export function signInternal(data: string | object, timestamp: number, opts: SignOptions): Promise<SigObject>;

/**
 * @param obj 参与签名的Obj对象
 * @param timestamp 签名的时间戳
 * @param privateKey 私钥
 * @param opts
 */
export function signString (str: string, timestamp: number, privateKey: Buffer, opts: SignOptions): SigObject;

/**
 * @param obj 参与签名的Obj对象
 * @param privateKey 私钥
 * @param opts
 */
export function sign (obj: object, privateKey: Buffer, opts: SignOptions): SigObject;
	
/**
 * 内部签名检查函数
 * @param data
 * @param timestamp 签名的时间戳
 * @param sig 
 * @param opts 
 * @return  
 */
export function verifyInternal(data : string | object, timestamp: number | undefined, sig: object | string, opts: HashOptions): Promise<boolean>;

/**
 * @param str 参与签名的字符串
 * @param timestamp 签名的时间戳
 * @param sig 签名
 * @param publicKey
 * @param opts
 */
export function verifyString (str: string, timestamp: number | undefined, sig: object | string, publicKey: Buffer, opts: HashOptions): boolean;

/**
 * @param obj 参与签名的Obj对象
 * @param sig 签名
 * @param publicKey
 * @param opts
 */
export function verify (obj: object, sig: object | string, publicKey: Buffer, opts: HashOptions): boolean;

/**
 * 内部对称性加密
 * @param data
 */
export function encryptInternal (data: object | string): Promise<string>;

/**
 * 内部对称性解密
 * @param data
 */
export function decryptInternal (data: string): Promise<string|object>;
