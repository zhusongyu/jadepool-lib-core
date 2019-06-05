import * as config from './config/index';
import * as configLoader from './config/loader';
import * as configSetuper from './config/setuper';
import * as crypto from './crypto';
import * as api from './apiEndpoint';
import * as db from './db';
import * as redis from './redis';
import ProcessRunner from './processRunner';
import RedisMessager from './redisMessager';

/**
 * 验证value
 * 若value为undefined or null or false，将报错
 * @param value 待验证内容
 * @param message 错误信息
 */
export function assert(value: any, message?: string): any;

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
