const assert = require('chai').assert
process.env.LOGGER_LEVEL = 'WARN'
const { jadepool, consts, utils } = require('../..')
const config = {}

describe('Utils: Misc', () => {
  before(async () => {
    await jadepool.initialize(new jadepool.Context(
      consts.SERVER_TYPES.UNKNOWN,
      '0.1.0',
      undefined,
      config
    ))
  })

  it('assert', async () => {
    assert.throws(utils.assert.bind(null, false, 'value is false'), 'value is false')
    assert.throws(utils.assert.bind(null, undefined, 'value is undefined'), 'value is undefined')
    assert.throws(utils.assert.bind(null, null, 'value is null'), 'value is null')
    assert.equal(0, utils.assert(0), 'number 0 eq')
    assert.equal(1, utils.assert(1), 'number 1 eq')
    assert.equal('1', utils.assert('1'), 'string 1 eq')
    assert.notStrictEqual({}, utils.assert({}), 'object eq')
  })

  it('string - splitAddress', () => {
    [
      { str: 'account', acc: 'account', memo: undefined },
      { str: 'account[memo]', acc: 'account', memo: 'memo' },
      { str: 'sd[dd]', acc: 'sd', memo: 'dd' },
      { str: '23v 3xzœdsafaq32[axx1.3]', acc: '23v 3xzœdsafaq32', memo: 'axx1.3' },
      { str: 'account[', acc: 'account[', memo: undefined },
      { str: 'account]', acc: 'account]', memo: undefined }
    ].forEach(i => {
      let result = utils.string.splitAddress(i.str)
      assert.equal(result.account, i.acc)
      assert.equal(result.memo, i.memo)
    })
  })

  it('string - generateHashId', () => {
    [
      { str: 'sdsfa', hash: 'Um1X1Eez' }
    ].forEach(i => {
      assert.equal(utils.string.generateHashId(i.str), i.hash)
    })
  })
})
