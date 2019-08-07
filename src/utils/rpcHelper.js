const WebSocket = require('ws')
const EventEmitter = require('events').EventEmitter

const cryptoUtils = require('./crypto')
const consts = require('../consts')
const NBError = require('../NBError')
const jadepool = require('../jadepool')

const logger = require('@jadepool/logger').of('RPC', 'Helper')

let _tryFetchPromise
async function fetchRPCClientService () {
  const jsonrpcSrv = jadepool.getService(consts.SERVICE_NAMES.JSONRPC)
  if (jsonrpcSrv) return jsonrpcSrv
  // 异步并发
  if (_tryFetchPromise) return _tryFetchPromise
  _tryFetchPromise = jadepool.registerService(consts.SERVICE_NAMES.JSONRPC, {
    // 内部签名以timestamp为私钥参数
    authWithTimestamp: true
  }).then(rpcClient => {
    _tryFetchPromise = null
    return rpcClient
  }).catch(err => {
    _tryFetchPromise = null
    logger.warn(`failed-to-register-jsonrpc, err(${err.message})`)
  })
  return _tryFetchPromise
}

/**
 * 检测RPC是否连接
 * @param {string} rpcUrl
 */
async function isRPCConnected (rpcUrl) {
  const jsonrpcSrv = await fetchRPCClientService()
  const state = jsonrpcSrv.getClientReadyState(rpcUrl)
  return state === WebSocket.OPEN
}

/**
 * @type {Map<string, EventEmitter>}
 */
let joinEmitters = new Map()

/**
 * 连接RPC节点
 * @param {string} rpcUrl
 * @param {object} opts
 * @param {string} opts.signerId
 */
async function joinRPCServer (rpcUrl, opts) {
  if (joinEmitters.has(rpcUrl)) {
    return new Promise(resolve => { joinEmitters.get(rpcUrl).once('result', resolve) })
  }
  let joined = false
  const emitter = new EventEmitter()
  joinEmitters.set(rpcUrl, emitter)

  const jsonrpcSrv = await fetchRPCClientService()
  try {
    // 使用瑶池数据库私钥进行签名
    await jsonrpcSrv.joinRPCServer(rpcUrl, opts)
    joined = true
  } catch (err) {
    logger.tag('JoinRPCServer').warn(err || err.message)
  }
  emitter.emit('result', joined)
  emitter.removeAllListeners()
  joinEmitters.delete(rpcUrl)
  return joined
}

/**
 * 请求RPC
 * @param {string} rpcUrl
 * @param {string} method
 * @param {any} params
 * @param {object} opts
 * @param {string} opts.signerId
 */
async function requestRPC (rpcUrl, method, params, opts) {
  const isWs = rpcUrl.startsWith('ws')
  if (isWs) {
    const isConnected = await isRPCConnected(rpcUrl)
    if (!isConnected) {
      const joined = await joinRPCServer(rpcUrl, opts)
      if (!joined) throw new NBError(21004, `join server failed (url: ${rpcUrl})`)
    }
  }
  const jsonrpcSrv = await fetchRPCClientService()
  // 使用瑶池数据库私钥进行签名
  let result = await jsonrpcSrv.requestJSONRPC(rpcUrl, method, params, opts)
  if (typeof result === 'object' && typeof result.encrypted === 'string') {
    result = await cryptoUtils.decryptData(result)
  }
  return result
}

module.exports = {
  isRPCConnected,
  joinRPCServer,
  requestRPC
}
