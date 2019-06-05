const crypto = require('crypto')

/**
 * 拆分Address
 * @param {string} address
 */
function splitAddress (address) {
  const accountReg = /^([^[]*)(\[(.*)\])?$/i
  const regMat = address.replace(/\n/g, '').match(accountReg)
  return !regMat ? {
    account: address
  } : {
    account: regMat[1],
    memo: regMat[3]
  }
}
/**
 * 根据一串字符串生成一个8位的hashId
 * @param {string} str
 */
function generateHashId (str) {
  const hashed = crypto.createHash('sha256').update(str).digest()
  const keys = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const keyLen = keys.length
  let ret = ''
  let k = 0
  let charCode = 0
  for (let i = hashed.length - 1; i >= 0; i--) {
    charCode += hashed[i]
    if (++k >= 4) {
      ret += keys[charCode % keyLen]
      charCode = k = 0
    }
    if (ret.length >= 8) break
  }
  return ret
}

module.exports = {
  splitAddress,
  generateHashId
}
