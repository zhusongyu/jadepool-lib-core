# Change Logs

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
