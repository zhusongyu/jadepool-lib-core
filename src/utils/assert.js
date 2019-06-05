const NBError = require('../NBError')

module.exports = function (value, message) {
  if (value === undefined || value === null || value === false) {
    throw new NBError(20010, message)
  }
  return value
}
