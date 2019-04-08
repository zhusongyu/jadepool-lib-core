# Jadepool NodeJS lib-core

瑶池支持库，含基础主要services等

## 初始化

```js
const { jadepool } = require('@jadepool/lib-core')
// 版本号
const version = '0.1.0'
// 一般性method call，传入后可使用jadepool.invokeMethod(methodName, namespace, args)
const invokeMethodWrapper = useJadepoolInvoke ? require('path/to/method') : undefined
// 配置对象，全局配置缓存
const config = require('config')
// 可自行extends jadepool.Context 上下文类
const ctx = new jadepool.Context(consts.SERVER_TYPES.UNKNOWN, version, invokeMethodWrapper, config)
// 瑶池支持库初始化
await jadepool.initialize(ctx)
```

## 获取模型

```js
const { jadepool } = require('@jadepool/lib-core')
const Model = jadepool.getModel('modelName')
// 后续可用 Model.findOne(...)
```

## 获取服务

```js
const { jadepool } = require('@jadepool/lib-core')
// 可获取 consts.SERVICE_NAMES 内的全部服务
const someSrv = jadepool.getService(consts.SERVICE_NAMES.AGENDA)
```

## 一般性调用

```js
const { jadepool } = require('@jadepool/lib-core')
// 使用一般性调用必须在初始化时传入invokeMethodWrapper
// 定义为 function (methodName: string, namespace: string, args: any): Promise<any>
const result = await jadepool.invokeMethod('some-method-name')
```

## 获取MongoDB实例

```js
const { utils } = require('@jadepool/lib-core')
const connKey = 'default'
const conn = utils.db.fetchConnection(connKey)
```