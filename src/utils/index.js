module.exports = {
  config: require('./config/index'),
  configLoader: require('./config/loader'),
  configSetuper: require('./config/setuper'),
  crypto: require('./crypto'),
  api: require('./apiEndpoint'),
  db: require('./db'),
  redis: require('./redis'),
  ProcessRunner: require('./processRunner')
}
