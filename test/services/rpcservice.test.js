const assert = require('chai').assert
process.env.LOGGER_LEVEL = 'DEBUG'
const { jadepool, consts } = require('../../')

const config = {
  mongo: {
    default: 'mongodb://localhost:27017/jadepool-BN-dev',
    config: 'mongodb://localhost:27017/jadepool-cfg-dev'
  }
}

let jsonRpcSrv

const invokeMethod = async function (method, namespace, params, ws) {
  let result
  switch (method) {
    case 'test':
      result = 'test'
      break
    case 'params':
      result = params
      break
    case 'recall-test':
      result = 'recall-test'
      break
    case 'recall':
      result = jsonRpcSrv.requestJSONRPC(ws, 'recall-test', params)
      break
  }
  return result
}

describe('Services: rpcservice', () => {
  let client, cliopts
  const acceptMethods = [
    'test',
    'params',
    'recall',
    'recall-test'
  ]

  describe('authWithTimestamp', () => {
    const port = 1111
    const URL = `ws://127.0.0.1:${port}`

    before(async () => {
      await jadepool.initialize(new jadepool.Context(
        consts.SERVER_TYPES.UNKNOWN,
        '0.1.0',
        invokeMethod,
        config
      ))
      // register jsonRpcSrv authWithTimestamp
      jsonRpcSrv = await jadepool.registerService(consts.SERVICE_NAMES.JSONRPC_SERVER, {
        acceptMethods,
        port: port,
        authWithTimestamp: true
      })
      // register jsonRpcClient authWithTimestamp
      client = await jadepool.registerService(consts.SERVICE_NAMES.JSONRPC, {
        acceptMethods,
        authWithTimestamp: true })
      await client.joinRPCServer(URL)
    })

    after(async () => {
      await client.closeRPCServer()
      await jsonRpcSrv.onDestroy()
    })

    it('can invoke method', async () => {
      const result = await client.requestJSONRPC(URL, 'test')
      assert.equal(result, 'test')
    })
    it('can invoke method with params', async () => {
      let params = { block: 1 }
      const result = await client.requestJSONRPC(URL, 'params', params)
      assert.isObject(result)
      assert.equal(result && result.block, 1)
    })
    it('method not found', async () => {
      let result
      let error
      try {
        result = await client.requestJSONRPC(URL, 'test1')
      } catch (err) {
        error = err
      }
      assert(result === undefined, `result should be not exist`)
      assert(error && error.code === 404, `error should be exists`)
    })
    it('requestJSONRPC', async () => {
      const result = await client.requestJSONRPC(URL, 'recall', '')
      assert.equal(result, 'recall-test')
    })
    it('removeAcceptableMethod', async () => {
      await jsonRpcSrv.removeAcceptableMethod('test')
      let result
      let error
      try {
        result = await client.requestJSONRPC(URL, 'test')
      } catch (err) {
        error = err
      }
      assert(result === undefined, `result should be not exist`)
      assert(error && error.code === 404, `error should be exists`)
    })
  })

  describe('authwithoutTimestamp', () => {
    const srvkeypair = {
      pri: 'U+p3+nLISklsIbGBtSvUTOhunj40R/jyTvYfF7l+IIE=',
      pub: 'A/ngqftWb1/2OHLXB8A6gDhuUwHw6/3es6BZ6/7eR6jC'
    }
    const clikeypair = {
      pri: 'pTohcA+PeIqHSvTLiY//5wdwhnVoPkRZk2oKX1SjfVI=',
      pub: 'A/qJrH6NxAUHvUsx3dnQqW10sBRJLWfH/PGoSA0ejcfD'
    }
    const port = 1112
    const URL = `ws://127.0.0.1:${port}`

    before(async () => {
      await jadepool.initialize(new jadepool.Context(
        consts.SERVER_TYPES.UNKNOWN,
        '0.1.0',
        invokeMethod,
        config
      ))
      // register jsonRpcSrv authWithoutTimestamp
      jsonRpcSrv = await jadepool.registerService(consts.SERVICE_NAMES.JSONRPC_SERVER, {
        acceptMethods,
        port: port,
        withoutTimestamp: true,
        signerId: 'testid',
        signer: srvkeypair.pri,
        verifier: clikeypair.pub
      })
      // register jsonRpcClient authWithoutTimestamp
      cliopts = {
        signerId: 'testid',
        signer: clikeypair.pri,
        verifier: srvkeypair.pub
      }
      client = await jadepool.registerService(consts.SERVICE_NAMES.JSONRPC, {
        acceptMethods })
      await client.joinRPCServer(URL, cliopts)
    })

    after(async () => {
      await client.closeRPCServer()
      await jsonRpcSrv.onDestroy()
    })

    it('can invoke method', async () => {
      const result = await client.requestJSONRPC(URL, 'test', cliopts)
      assert.equal(result, 'test')
    })
    it('requestJSONRPC', async () => {
      const result = await client.requestJSONRPC(URL, 'recall', cliopts)
      assert.equal(result, 'recall-test')
    })
    it('wrong client signer', async () => {
      let error
      await client.closeRPCServer()
      try {
        await client.joinRPCServer(URL, {
          signerId: 'testid',
          signer: srvkeypair.pri,
          verifier: srvkeypair.pub
        })
      } catch (err) {
        error = err
      }
      assert(error && error.code === 'ECONNRESET')
    })
    it('wrong client verifier', async () => {
      let result, error
      await client.closeRPCServer()
      await client.joinRPCServer(URL, {
        signerId: 'testid',
        signer: clikeypair.pri,
        verifier: clikeypair.pub
      })
      try {
        result = await client.requestJSONRPC(URL, 'recall')
      } catch (err) {
        error = err
      }
      assert(result === undefined, `result should be not exist`)
      assert(error && error.code === 401, `error should be exists`)
    })
  })
})
