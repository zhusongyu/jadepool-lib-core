const _ = require('lodash')
const HDKey = require('hdkey')
const semver = require('semver')
const { ecc } = require('@jadepool/crypto')
const jp = require('../jadepool')
const NBError = require('../NBError')

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
    const configLoader = require('./config/loader')
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
    const keypair = ecc.generateKeyPair()
    const jsonToSave = _.set({}, PRIV_ID, keypair.priKey)
    // 保存jsoncfg的配置
    const configLoader = require('./config/loader')
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
    if (category === THIS_APP_ID) {
      return cryptoUtils.getInternalPubKey()
    } else if (category === PRIV_ID) {
      const priKey = await cryptoUtils.getPriKey(cryptoDat)
      return ecc.pubKeyCreate(priKey, ecc.DEFAULT_ENCODE, compress)
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
      data.status = data.code = 400
      data.message = data.message = errMsg
    } else {
      data.status = data.code = 0
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
   * 获取内部私钥
   */
  async getInternalPriKey () {
    if (jp.env.secret) {
      const ver = semver.parse(jp.env.version)
      const root = HDKey.fromMasterSeed(Buffer.from(jp.env.secret))
      const hdnode = root.derive(`m/666'/0'/0'/${ver.major}/${ver.minor}/${ver.patch}`)
      return hdnode.privateKey
    }
    return cryptoUtils.getPriKey()
  },
  /**
   * 获取内部公钥
   */
  async getInternalPubKey () {
    const internalPriKey = await cryptoUtils.getInternalPriKey()
    return ecc.pubKeyCreate(internalPriKey)
  },
  /**
   * 内部签名检查函数
   * @param {String|Object} data
   * @param {Number} timestamp
   * @param {object} opts
   * @param {string?} [opts.sort='key-alphabet'] 签名返回结果(key-alphabet|key|kvpair|value)
   * @param {string?} [opts.hash='sha3'] msg签名Hash规则(md5|sha3|sha256)
   * @param {string?} [opts.encode='base64'] 签名返回结果encode(base64|hex)
   * @param {string?} [opts.accept='string'] 签名返回结果(string|object)
   * @param {boolean?} [opts.withoutTimestamp=false] 是否需要添加时间戳
   */
  async signInternal (data, timestamp = undefined, opts = {}) {
    let priKey = await cryptoUtils.getInternalPriKey()
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
   * @param {object} opts
   * @param {string?} [opts.sort='key-alphabet'] 签名返回结果(key-alphabet|key|kvpair|value)
   * @param {string?} [opts.hash='sha3'] msg签名Hash规则(md5|sha3|sha256)
   * @param {string?} [opts.encode='base64'] 签名返回结果encode(base64|hex)
   * @param {string?} [opts.accept='string'] 签名返回结果(string|object)
   * @param {boolean?} [opts.withoutTimestamp=false] 是否需要添加时间戳
   * @returns {Promise<boolean>} 是否认证通过
   */
  async verifyInternal (data, timestamp = undefined, sig, opts = {}) {
    let pubKey = await cryptoUtils.getInternalPubKey()
    if (_.isString(data)) {
      return ecc.verifyString(data, timestamp, sig, pubKey, opts)
    } else if (_.isObject(data)) {
      if (timestamp !== undefined) data.timestamp = timestamp
      return ecc.verify(data, sig, pubKey, opts)
    } else {
      return false
    }
  },
  verify: ecc.verify,
  verifyString: ecc.verifyString
}

module.exports = cryptoUtils
