const Parameter = require('parameter')
const NBError = require('../support/NBError')

const parameter = new Parameter({ convert: true })

module.exports = (data, rule) => {
  if (!rule) return true
  const errors = parameter.validate(rule, data)
  if (!errors || errors.length === 0) return true
  const err = errors[0]
  let errorCode
  if (err.code === 'missing_field' || err.message === 'should not be empty') {
    errorCode = 20010
  } else {
    errorCode = 10002
  }
  throw new NBError(errorCode, `[${err.code}] field(${err.field}) ${err.message}`)
}
