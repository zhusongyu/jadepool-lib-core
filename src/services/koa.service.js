// const express = require('express')
// const fs = require('fs')
// const http = require('http')
// const https = require('https')
// const path = require('path')
// const morgan = require('morgan')
// const cors = require('cors')
// const bodyParser = require('body-parser')

const BaseService = require('./core')
const consts = require('../consts')
// const jp = require('../jadepool')
// const NBError = require('../support/NBError')
// const logger = require('@jadepool/logger').of('Service', 'Express')

class KoaService extends BaseService {
  /**
   * @param {Object} services 服务列表
   */
  constructor (services) {
    super(consts.SERVICE_NAMES.KOA, services)
  }
}

module.exports = KoaService
