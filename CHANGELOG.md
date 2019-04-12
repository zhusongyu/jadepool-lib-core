# Change Logs

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
