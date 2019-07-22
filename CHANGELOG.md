# Change Logs

## V0.12.0

Features:

* 新增config.service服务，全权处理全部的配置读取与写入事宜
* 移除utils.configSetuper下的所有方法
* 移除utils.config.fetch**系列方法
* 移除utils.config.applyIgnoreKeys方法

## V0.11.18

Fixes:

* 移除tokenTypes覆盖

Improvement:

* 优化agendaJobs的db index
* 优化redisMessager的日志

## V0.11.17

Improvement:

* string.geneHashId移除0，O，I，l
* crypto添加工具函数keyBufferFrom，创建buffer时自动识别字符串base64 or hex的encode
* rpcclient.service在join时添加opts.verifier，制定验签公钥
* jsonrpc.service可配置更多签名参数
* jsonrpc.service支持batch reqeust

## V0.11.16

Fixes:

* 更新lodash到4.17.14以修复致命漏洞
* wallet.setSourceData 可设置 cached

## V0.11.15

Merge:

* 合并0.9.4

## V0.11.14

Fixes:

* 修复别名目录下无法根据perent找到配置的bug

## V0.11.13

Fixes:

* utils.config.loadAllCoinNames 支持 includeDisabled 参数

## V0.11.12

Fixes:

* bizType REFUND 属于 ORDER_BIZTYPES_OUT

Improvement:

* 添加ISSUE_TYPES.ORDER_UNEXPECTED 和 CONTRACT_UNKNOWN_ISSUE

## V0.11.11

Improvement:

* 新增bizTypes: REVERT, REFUND

## V0.11.10

Improvement:

* agenda task config中保存平均运行时间

## V0.11.9

Fixes:

* 修复wallet保存数组时的异常

## V0.11.8

Fixes:

* 修复redisMessager中可能的报错

## V0.11.7

Fixes:

* 修复Wallet保存数据时的错误
* 避免一些redisManager中可能的报错

Improvement:

* 减少RedisManager中的日志输出

## V0.11.6

Improvement:

* 调整Wallet Model的实现，修改为多表记录
* 添加Wallet测试用例
* ConfigDat.toMerged 添加参数id，key

Fixes:

* redisMessager consumeMsgs时设置data需先确认array存在

## V0.11.5

Fixes:

* 修复redisMessager consumeMessages时因自动设置block造成的卡死

## V0.11.4

Fixes:

* 移除wallet.getTokenInfo时，对configWatchers的修改

## V0.11.3

Fixes:

* 修复wallet机制下configLoader自动升级版本时，带parent的配置无法正常升级的bug
* 移除utils.configLoader.loadConfig中的无用参数forceSelf

## V0.11.2

Improvement:

* utils.crypto.buildSignedObj 支持传入多种参数

## V0.11.1

Improvement:

* 在wallet的d.ts中添加seed_db模式，配置冷热钱包地址的提示

## V0.11.0

Features:

* 添加utils函数：string类和assert类
* 新增Redis工具：RedisMessager，可便捷使用Redis 5.0的消息队列功能
  * 修复RedisMessager，新Group无法收到最新消息的Bug
  * 独立ensureGroup方法，支持不同Group的consumeMessages

## V0.10.1

Fixes:

* 修复agenda.service.runningJobs方法中带id查询时的query错误

## V0.10.0

Breaking Changes:

由于瑶池支持多wallet，因此不能依赖coinCfg

* 移除utils.config.fetchCoinCfg
* 移除utils.config.fetchAllCoinNames
* 重构setuper，仅将default钱包中的数据缓存到内存config
* 移除crypto.fetchPubKey，仅使用新方法fetchPublicKeys

Features:

* 新增Wallet模型，支持多热钱包模式
  * Application记录中需配置Wallet参数
* utils.crypto的internal签名支持以timestamp + secret的形式做为私钥
* rpcclient.service可以预设invokeMethod时的namespace

Improvement:

* agenda.service支持带id的runningJobs查询
* utils.db中添加AutoIncrement

## V0.9.4

Improvement:

* 添加常量consts.MODEL_NAMES.ITEM
* 添加常量consts.ITEM_STATE

## V0.9.3

Fixes:

* asyncplan.service以series模式运行Plan时，一旦出现error即停止plan并认为失败

## V0.9.2

Improvement:

* api.endpoint 添加setTimeout方法

## V0.9.1

Fixes:

* 当执行plan时有error，也应该算作完成

## V0.9.0

Feature:

* 新增通用Model: AsyncPlan 用于记录异步队列任务，在默认context中已加载
* 新增Service：asyncplan.service 用于监控和运行异步任务
* consts中新增AsyncPlan相关常量
* jadepool新增方法：createAsyncPlan 可用于创建新的异步队列任务
* jadepool新增方法可用性检验函数：invokeMethodValid
* 新增asyncplan相关测试用例

Improvement:

* agenda.service添加参数opts.processEvery
* jsonrpc.service和rpclient.service导出方法setAcceptMethods，可自行设置acceptMethods

Fixes:

* socketio.service在调用分发调用的result为数组时，依然可以自动添加namespace和sid

## V0.8.1

Fixes:

* 修复ApiEndpoint.connected错误

## V0.8.0

Feature:

* 新增工具类 utils.api 可用于对多个节点地址进行restapi或jsonrpc请求。

## V0.7.11

Improvement:

* d.ts定义文件 - 新增coinCfg.jadepool下的通用内容
* d.ts定义文件 - 调整部分consts的提示内容

## V0.7.10

Improvement:

* 增加utils.db.fetchConnection的定义

Fixes:

* 修复MODEL_NAME，mongoose在写入数据库时会将name全部小写

## V0.7.9

Fixes:

* 修复AUDIT_BALANCE所在的DB

## V0.7.8

Improvement:

* 添加常量`consts.DB_KEYS`, `consts.MODEL_LIST_ADMIN`, `consts.MODEL_LIST_CONFIG`, `consts.MODEL_LIST_DEFAULT`
* 添加常量字段`consts.ORDER_DEFAULT_ACTIONS.UTXO_SCATTER`
* 移除ChainCfg中的非必要字段 systemCallEnabled

## V0.7.7

Improvement:

* 命名并更新index

## V0.7.6

Fixes:

* instanceId可以使用NODE_INSTANCE_ID来设置，以避免Node-config冲突

## V0.7.5

Fixes:

* consts.d.ts中字段错误，修正为 consts.ADDRESS_BIZ_MODES.NORMAL

## V0.7.4

Fixes:

* 修复agenda.cancelFinishedJobs未删除干净的问题，启动时只要lockedAt为null都可以删除

## V0.7.3

Improvement:

1. 移除ADDRESS_BIZ_MODES.DELEGATE系列，因为它们在业务上不能成立
2. 【更新*.d.ts】 ChainConfig中添加addressWaitForUse和addressBizModes

## V0.7.2

Features:

1. consts调整。移除ADDRESS_ACCEPT_MODE，添加更多的ADDRESS_BIZ_MODES

Fixes:

1. agenda.service为runningJobs添加index

## V0.7.1

Features:

1. utils.config.loadAllCoinNames返回时带chainKey
2. utils.config.loadCoinCfg支持单个coinName作为参数，但必须为`chainKey.coinName`格式
3. 新增consts.ADDRESS_BIZ_MODES

## V0.7.0

Features:

1. utils.config新增方法loadCoinCfg, loadChainCfg, loadAllCoinNames, loadAllChainNames
2. 增加utils.config的测试用例

## V0.6.3

Fixes:

1. agenda.service，当normal Task存在autoRunAmount时需要先检测数据库中的现存jobs

## V0.6.2

Features:

1. ProcessorRunner新增方法restart
2. process.service方法 requestChild修改为requestProcess

## V0.6.1

Fixes:

1. 修复ProcessorRunner启动是cwd和script混淆的问题
2. utils.config.fetchAllChainNames仅在env.server为main是需要调节

## V0.6.0

Feature:

1. 新增process.service, 该service负责全部子进程管理

Fixes: 修复Process相关事件监听

1. processRunner将相同的signal传递给child_process
2. jadepool主进程处理exit信号时直接使用传入的signal参数, 最后以process.exit(0)结束进程

## V0.5.2

1. `cancelFinishedJobs`方法中包含disabled Tasks

## V0.5.1

1. 新增环境变量`jadepool.env.instanceId`表示pm2启动时的进程序号
2. 移除agenda.task中的自动disable和enable
3. agenda.service在onDestroy时先进行stop()，以确保无多余task会后续执行
4. agenda.service在启动进程时调用`cancelFinishedJobs`方法，仅删除没有locked 且完全完成的任务

## V0.5.0

1. 模型TaskConfig新增字段autoRunAmount，用于NORMAL类型的jobtype
2. agenda.service 处理Task时，当TaskConfig中jobtype为NORMAL，则会在启动时自动运行{autoRunAmount}数量个Job
3. agenda.service 添加接口 runningJobs，可返回正在运行中的任务

## V0.1.x ~ V0.4.x

TODO, 建议从V0.5.0开始使用
