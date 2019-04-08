# Change Logs

## V0.5.0

1. 模型TaskConfig新增字段autoRunAmount，用于NORMAL类型的jobtype
2. agenda.service 处理Task时，当TaskConfig中jobtype为NORMAL，则会在启动时自动运行{autoRunAmount}数量个Job
3. agenda.service 添加接口 runningJobs，可返回正在运行中的任务

## V0.1.x ~ V0.4.x

TODO, 建议从V0.5.0开始使用
