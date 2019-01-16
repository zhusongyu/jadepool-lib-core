/**
 * --------- STRING ---------
 */
export declare const DEFAULT_KEY : string;

/**
 * --------- MAP ---------
 */
export declare namespace PROCESS{
	const NAME_PREFIX : string;

	const CLUSTER_MODES : {
		AUTO : string;
		NODE : string;
		PM2 : string;
	}
	const LAUNCH_MODES : {
		ALL_IN_ONE : string;
		MASTER : string;
		AGENT : string;
		WORKER : string;
	}
	const TYPES : {
		ROUTER : string;
		ROUTER_SUB : string;
		GENERAL : string;
		BLOCKCHAIN : string;
	}
}

export declare const SERVICE_NAMES : {
	ERROR_CODE : string;
	AGENDA : string;
	APP : string;
	SCRIPT : string;
	JSONRPC : string;
	JSONRPC_SERVER : string;
	SOCKET_IO : string;
	SIO_WORKER : string;
}

export declare const SIO_EVENTS : {
	INVOKE_METHOD : string;
}

export declare const NSP_TYPES : {
	NULL : string;
	COIN_TYPE : string;
	CHAIN_KEY : string;
	SOCKET_ID : string;
	AGENT : string;
}

export declare const LEDGER_MODES : {
	LOCAL : string;
	RPC : string;
}

export declare const ADDRESS_MODES : {
	MULTI : string;
	SINGLE : string;
}

export declare const SERVER_TYPES : {
	API : string;
	MAIN : string;
	SAFE : string;
}

export declare const JOB_TYPES : {
	EVERY : string;
	NORMAL : string;
	SCHEDULE : string;
}

export declare const ADDRESS_STATE : {
	NEW : string;
	USED : string;
	BLOCKED : string;
}

export declare const ADDRESS_TYPE : {
	HOT_WALLET : number;
	COLD_WALLET : number;
	DEPOSIT : number;
	EXTERNAL : number;
}

export declare const ORDER_STATE : {
	INIT : string;
	HOLDING : string;
	ONLINE : string;
	PENDING : string;
	FAILED : string;
	DONE : string;
}

export declare const ORDER_BIZTYPES : {
	WITHDRAW : string;
	SWEEP : string;
	SWEEP_INTERNAL : string;
	DEPOSIT : string;
	AIRDROP : string;
	RECHARGE : string;
	RECHARGE_SPECIAL : string;
	RECHARGE_INTERNAL : string;
	RECHARGE_UNEXPECTED : string;
}

export declare const BATCH_STATE : {
	STARTED : string;
	DONE : string;
	FAILED : string;
}

export declare const ISSUE_TYPES : {
	ORDER_HOLDING : string;
}

export declare const ISSUE_STATE : {
	OPENED : string;
	PROCESSING : string;
	VALIDATING : string;
	RESOLVED : string;
}

export declare const WARN_LEVEL : {
	CRITICAL : string;
	MAJOR : string;
	MINOR : string;
	WARNING : string;
}

export declare const SUPPORT_LOCALES : {
	ZH_CN : string;
	EN : string;
	JA : string;
}

/**
 * --------- LIST ---------
 */
export declare const ORDER_BIZTYPES_OUT : string[];

export declare const ORDER_BIZTYPES_IN : string[];
