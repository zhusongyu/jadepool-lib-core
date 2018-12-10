const _ = require('lodash')
const { ecc } = require('@jadepool/crypto')
const NBError = require('./NBError')
const configLoader = require('./config/loader')

const THIS_APP_ID = 'self'
const PRIV_ID = 'pri'

/**
 * 加载实时的Crypto配置
 */
const loadCryptoConfig = async (cryptoDat = undefined) => {
  let cfgDat
  if (cryptoDat && typeof cryptoDat.toMerged === 'function') {
    cfgDat = cryptoDat
  } else {
    cfgDat = await configLoader.loadConfig('crypto')
  }
  if (!cfgDat) {
    throw new NBError(10001, `missing config/crypto`)
  }
  return cfgDat.toMerged()
}

const cryptoUtils = {
  DEFAULT_ENCODE: ecc.DEFAULT_ENCODE,
  THIS_APP_ID,
  PRIV_ID,
  /**
   * 获取本系统 Private Key
   * @param {String} cryptoType
   * @returns {Buffer}
   */
  async getPriKey (cryptoDat = undefined) {
    const cryptoCfg = await loadCryptoConfig(cryptoDat)
    let priKeyStr = _.get(cryptoCfg, PRIV_ID)
    if (!priKeyStr) {
      const keypair = await cryptoUtils.refreshPriKey()
      priKeyStr = keypair.priKey
    }
    return Buffer.from(priKeyStr, ecc.DEFAULT_ENCODE)
  },
  /**
   * 重置本系统的 Private Key
   */
  async refreshPriKey () {
    const keypair = cryptoUtils.generateKeyPair()
    const jsonToSave = _.set({}, PRIV_ID, keypair.priKey)
    // 保存jsoncfg的配置
    await configLoader.saveConfig('crypto', '', jsonToSave)
    return keypair
  },
  /**
   * 判断是否为Public Key
   * @param {String} pubKeyStr
   * @param {String} encode
   * @returns {Buffer|null}
   */
  pubKeyVerify (pubKeyStr, encode = ecc.DEFAULT_ENCODE, compress = false) {
    return ecc.pubKeyVerify(pubKeyStr, encode, compress)
  },
  /**
   * 获取本系统 Public Key
   */
  async fetchSelfPubKey (cryptoType = 'ecc', compress = false, cryptoDat = undefined) {
    const priKey = await cryptoUtils.getPriKey(cryptoDat)
    return ecc.pubKeyCreate(priKey, ecc.DEFAULT_ENCODE, compress)
  },
  /**
   * 获取非本系统 Public Key
   */
  async fetchAppPubKey (cryptoType, category, compress = false, cryptoDat = undefined) {
    const cryptoCfg = await loadCryptoConfig(cryptoDat)
    let pubKeyStr = _.get(cryptoCfg, `${cryptoType}.${category}`)
    pubKeyStr = _.isObject(pubKeyStr) ? pubKeyStr.pub : pubKeyStr
    if (!pubKeyStr) return null
    return ecc.pubKeyVerify(pubKeyStr, ecc.DEFAULT_ENCODE, compress)
  },
  /**
   * 获取 Public Key
   * @param {String} cryptoType
   * @param {String} category
   * @param {Boolean} compress
   * @returns {Buffer}
   */
  async fetchPubKey (cryptoType, category, compress = false, cryptoDat = undefined) {
    if (category === PRIV_ID || category === THIS_APP_ID) {
      return cryptoUtils.fetchSelfPubKey(cryptoType, compress, cryptoDat)
    } else {
      return cryptoUtils.fetchAppPubKey(cryptoType, category, compress, cryptoDat)
    }
  },
  /**
   * 封装需签名的对象
   * @param {Object} obj 签名对象
   * @param {String|undefined} errMsg 错误信息
   */
  async buildSignedObj (obj, errMsg, sigAccept = 'object') {
    const data = {}
    if (errMsg) {
      data.status = 400
      data.message = errMsg
    } else {
      data.status = 0
      data.message = 'OK'
    }
    const priKey = await cryptoUtils.getPriKey()
    if (priKey) {
      const sigObj = ecc.sign(obj, priKey, { hash: 'sha3', accept: sigAccept })
      data.crypto = 'ecc'
      data.timestamp = sigObj.timestamp
      data.sig = sigObj.signature
    }
    data.result = obj
    return data
  },
  /**
   * 内部签名检查函数
   * @param {String|Object} data
   * @param {Number} timestamp
   * @param {Object?} opts
   * @param {string} opts.hash msg签名Hash规则(md5|sha3|sha256)
   * @param {string} opts.encode 签名返回结果encode(base64|hex)
   * @param {string} opts.accept 签名返回结果(string|object)
   * @param {boolean} [opts.withoutTimestamp=false] 是否需要添加时间戳
   */
  async signInternal (data, timestamp = undefined, opts = {}) {
    let priKey = await cryptoUtils.getPriKey()
    if (_.isString(data)) {
      return ecc.signString(data, timestamp, priKey, opts)
    } else if (_.isObject(data)) {
      if (timestamp !== undefined) data.timestamp = timestamp
      return ecc.sign(data, priKey, opts)
    } else {
      return null
    }
  },
  sign: ecc.sign,
  signString: ecc.signString,
  /**
   * 内部签名检查函数
   * @param {String|Object} data
   * @param {Number} timestamp
   * @param {String} sig
   * @returns {Promise<boolean>} 是否认证通过
   */
  async verifyInternal (data, timestamp, sig) {
    let pubKey = await cryptoUtils.fetchSelfPubKey()
    if (_.isString(data)) {
      return ecc.verifyString(data, timestamp, sig, pubKey)
    } else if (_.isObject(data)) {
      return ecc.verify(_.assign({ timestamp }, data), sig, pubKey)
    } else {
      return false
    }
  },
  verify: ecc.verify,
  verifyString: ecc.verifyString
}

module.exports = cryptoUtils
