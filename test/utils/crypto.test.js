const assert = require('chai').assert
process.env.LOGGER_LEVEL = 'WARN'
const { jadepool, consts, utils } = require('../..')
const config = {}

describe('Utils: crypto', () => {
  before(async () => {
    await jadepool.initialize(new jadepool.Context(
      consts.SERVER_TYPES.UNKNOWN,
      '0.1.0',
      undefined,
      config
    ))
  })

  it('encryptInternal && decryptInternal', async () => {
    const txt = 'ABCCDDSDDSD'
    const encrypted = await utils.crypto.encryptInternal(txt)
    assert.equal(encrypted, '473dfe4a482e58062d82e8ea7cbf220f', 'encrypted should be same')
    const decrypted = await utils.crypto.decryptInternal(encrypted)
    assert.equal(decrypted, txt, 'decrypted should be same')
  })
})
