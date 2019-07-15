const _ = require('lodash')
const HDKey = require('hdkey')
const semver = require('semver')
const crypto = require('crypto')
const { ecc } = require('@jadepool/crypto')
const jp = require('../jadepool')
const consts = require('../consts')
const NBError = require('../NBError')
const configLoader = require('./config/loader')

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
  /**
   * 解析字符串并创建一个KeyBuffer
   * @param {string} str
   */
  keyBufferFrom (str) {
    const base64Pattern = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/
    const hexPattern = /^([A-F0-9]{2})+$/i
    let buf
    if (base64Pattern.test(str)) {
      buf = Buffer.from(str, 'base64')
    } else if (hexPattern.test(str)) {
      buf = Buffer.from(str, 'hex')
    } else {
      buf = Buffer.from(str)
    }
    return buf
  },
  /**
   * 获取本系统 Private Key
   * @param {String} cryptoType
   */
  async getPriKey (cryptoDat = undefined) {
    const cryptoCfg = await loadCryptoConfig(cryptoDat)
    let priKeyStr = _.get(cryptoCfg, consts.SYSTEM_APPIDS.DEFAULT)
    if (!priKeyStr) {
      const keypair = await cryptoUtils.refreshPriKey()
      priKeyStr = keypair.priKey
    }
    return this.keyBufferFrom(priKeyStr)
  },
  /**
   * 重置本系统的 Private Key
   */
  async refreshPriKey () {
    const keypair = ecc.generateKeyPair()
    const jsonToSave = _.set({}, consts.SYSTEM_APPIDS.DEFAULT, keypair.priKey)
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
  pubKeyVerify (pubKeyStr, encode = consts.DEFAULT_ENCODE, compress = false) {
    return ecc.pubKeyVerify(pubKeyStr, encode, compress)
  },
  /**
   * 获取某AppId对应的公钥们
   * @param {string} appid
   * @param {boolean?} compress
   * @returns {Buffer[]}
   */
  async fetchPublicKeys (appid, compress = false) {
    if (appid === consts.SYSTEM_APPIDS.INTERNAL) {
      return [ await cryptoUtils.getInternalPubKey() ]
    } else if (appid === consts.SYSTEM_APPIDS.DEFAULT) {
      const priKey = await cryptoUtils.getPriKey()
      return [ ecc.pubKeyCreate(priKey, undefined, compress) ]
    } else {
      const appCfg = await jp.fetchAppConfig(appid)
      return appCfg ? appCfg.getPublicKeys() : []
    }
  },
  /**
   * 封装需签名的对象
   * @param {Object} obj 签名对象
   * @param {String|undefined} errMsg 错误信息
   */
  async buildSignedObj (obj, errMsg, opts = {}) {
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
      const signOpts = _.defaults(_.clone(opts), {
        hash: 'sha3',
        accept: 'object',
        sort: 'key-alphabet',
        encode: ecc.DEFAULT_ENCODE
      })
      const sigObj = ecc.sign(obj, priKey, signOpts)
      data.crypto = 'ecc'
      data.hash = signOpts.hash
      data.sort = signOpts.sort
      data.encode = signOpts.encode
      data.timestamp = sigObj.timestamp
      data.sig = sigObj.signature
    }
    data.result = obj
    return data
  },
  /**
   * 获取内部私钥
   * @param {Number} timestamp 时间戳
   */
  async getInternalPriKey (timestamp) {
    if (jp.env.secret) {
      const root = HDKey.fromMasterSeed(Buffer.from(jp.env.secret))
      let internalPriKey
      if (timestamp === undefined) {
        const ver = semver.parse(jp.env.version)
        // 以major和minor组成版本号一致的系统
        const hdnode = root.derive(`m/666'/0'/0'/${ver.major}/${ver.minor}/${ver.patch}`)
        internalPriKey = hdnode.privateKey.toString('hex')
      } else {
        const date = new Date(timestamp)
        const hdnode = root.derive(`m/666'/${date.getUTCHours()}'/0'/${date.getUTCMinutes()}/${date.getUTCSeconds()}/${date.getUTCMilliseconds()}`)
        internalPriKey = hdnode.privateKey.toString('hex')
      }
      return Buffer.from(internalPriKey, 'hex')
    }
    return cryptoUtils.getPriKey()
  },
  /**
   * 获取内部公钥
   * @param {Number} timestamp 时间戳
   */
  async getInternalPubKey (timestamp) {
    return ecc.pubKeyCreate(await cryptoUtils.getInternalPriKey(timestamp))
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
   * @param {boolean?} [opts.authWithTimestamp=false] 以时间戳为私钥
   */
  async signInternal (data, timestamp = undefined, opts = {}) {
    // 强制设置withoutTimestamp
    opts.withoutTimestamp = opts.withoutTimestamp || timestamp === undefined
    const withTs = opts.authWithTimestamp && !opts.withoutTimestamp
    let priKey = await cryptoUtils.getInternalPriKey(withTs ? timestamp : undefined)
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
   * @param {boolean?} [opts.authWithTimestamp=false] 以时间戳为私钥
   * @returns {Promise<boolean>} 是否认证通过
   */
  async verifyInternal (data, timestamp = undefined, sig, opts = {}) {
    // 强制设置withoutTimestamp
    opts.withoutTimestamp = opts.withoutTimestamp || timestamp === undefined
    const withTs = opts.authWithTimestamp && !opts.withoutTimestamp
    let pubKey = await cryptoUtils.getInternalPubKey(withTs ? timestamp : undefined)
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
  verifyString: ecc.verifyString,
  // ======= 对称加密 ==========
  /**
   * 使用AES进行对称加密
   * @param {string|object} data
   * @returns {string}
   */
  async encryptInternal (data) {
    data = typeof data === 'string' ? data : JSON.stringify(data)
    const algorithm = 'aes-192-cbc'
    const iv = Buffer.alloc(16, 0)
    const key = await cryptoUtils.getInternalPriKey()
    const cipher = crypto.createCipheriv(algorithm, key.slice(0, 24), iv)
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return encrypted
  },
  /**
   * 使用AES进行对称解谜密
   * @param {string} data
   */
  async decryptInternal (data) {
    const algorithm = 'aes-192-cbc'
    const iv = Buffer.alloc(16, 0)
    const key = await cryptoUtils.getInternalPriKey()
    const decipher = crypto.createDecipheriv(algorithm, key.slice(0, 24), iv)
    let decrypted = decipher.update(data, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    let result
    try {
      result = JSON.parse(decrypted)
    } catch (err) {
      result = decrypted
    }
    return result
  }
}

module.exports = cryptoUtils
