const fs = require('fs')
const path = require('path')
const logger = require('@jadepool/logger').of('Jadepool')

function run () {
  const entryDir = process.env.JP_ENTRY_DIR || process.cwd()

  let entryFiles = []
  if (process.env.NODE_ENV === 'production') {
    entryFiles = [
      path.resolve(entryDir, 'build/index.bundle.js'),
      path.resolve(entryDir, 'dist/index.bundle.js')
    ]
  } else {
    entryFiles = [
      path.resolve(entryDir, 'src/index.js'),
      path.resolve(entryDir, 'build/index.bundle.js'),
      path.resolve(entryDir, 'dist/index.bundle.js')
    ]
  }
  // find exists entry file
  const existsEntries = entryFiles.filter(fileName => fs.existsSync(fileName))

  if (existsEntries.length === 0) {
    console.error('Missing entry file.')
    process.exit(0)
  }

  // log exceptions
  process.on('warning', (warning) => {
    logger.warn(warning)
  })
  process.on('unhandledRejection', (reason) => {
    logger.tag('Unhandled Rejection').error(reason)
  })
  process.on('uncaughtException', (err) => {
    logger.tag('Uncaught Exception').error(err)
    process.exit(0)
  })

  // load launcher
  require(existsEntries[0])
}

module.exports = run
