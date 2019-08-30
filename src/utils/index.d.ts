import * as config from './config/index';
import * as configLoader from './config/loader';
import * as configSetuper from './config/setuper';
import * as crypto from './crypto';
import * as api from './apiEndpoint';
import * as db from './db';
import * as redis from './redis';
import ProcessRunner from './processRunner';
import RedisMessager from './redisMessager';
import { RequestOptions } from '../services';

/**
 * 验证value
 * 若value为undefined or null or false，将报错
 * @param value 待验证内容
 * @param message 错误信息
 */
export function assert<T>(value: T, message?: string): T;

/**
 * 等待数秒
 * @param sec
 */
export function waitForSeconds(sec?: number = 1): Promise<void>

/**
 * string工具库
 */
export declare namespace string {
  /**
   * 拆分Address
   * @param address
   */
  function splitAddress (address: string): { account: string, memo?: string }
  /**
   * 根据一串字符串生成一个8位的hashId
   * @param str
   */
  function generateHashId (str: string): string
}

/**
 * 便捷的rpc service使用方法
 */
export declare namespace rpcHelper {
  /**
   * 查询是否连接成功
   */
  function isRPCConnected(rpcUrl: string): Promise<boolean>;
  /**
   * 直接连接rpc 服务
   */
  function joinRPCServer(rpcUrl: string, opts?: RequestOptions): Promise<boolean>;
  /**
   * 请求方法，若尚未连接则将连接到ws rpc服务
   */
  function requestRPC(rpcUrl: string, method: string, params: any, opts?: RequestOptions): Promise<any>
}

export {
  config,
  configLoader,
  configSetuper,
  crypto,
  api,
  db,
  redis,
  RedisMessager,
  ProcessRunner,
}
