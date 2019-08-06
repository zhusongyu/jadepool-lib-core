const WebSocket = require('ws')
const EventEmitter = require('events').EventEmitter

const utils = require('./')
const consts = require('../consts')
const NBError = require('../NBError')
const jadepool = require('../jadepool')

const logger = require('@jadepool/logger').of('RPC', 'Helper')

/**
 * 检测RPC是否连接
 * @param {string} rpcUrl
 */
function isRPCConnected (rpcUrl) {
  const jsonrpcSrv = jadepool.getService(consts.SERVICE_NAMES.JSONRPC)
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

  const jsonrpcSrv = jadepool.getService(consts.SERVICE_NAMES.JSONRPC)
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
  const isConnected = isRPCConnected(rpcUrl)
  if (!isConnected) {
    const joined = await joinRPCServer(rpcUrl, opts)
    if (!joined) {
      throw new NBError(21004, `join server failed (url: ${rpcUrl})`)
    }
  }
  const jsonrpcSrv = jadepool.getService(consts.SERVICE_NAMES.JSONRPC)
  // 使用瑶池数据库私钥进行签名
  let result = await jsonrpcSrv.requestJSONRPC(rpcUrl, method, params, opts)
  if (result.encrypted) {
    result = await utils.crypto.decryptInternal(result.encrypted)
  }
  return result
}

module.exports = {
  isRPCConnected,
  joinRPCServer,
  requestRPC
}
