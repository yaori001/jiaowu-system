# 接口测试说明

本目录为教务管理系统的后端接口自动化测试，使用 Node 20 内置的 `fetch` 与 `node:assert`，**不依赖任何第三方库**。

## 运行

```bash
# 测试线上已部署后端（默认）
node test/api.test.mjs

# 测试本地后端
BASE_URL=http://localhost:8000/api node test/api.test.mjs
```

> Windows PowerShell 下设置环境变量：
> ```powershell
> $env:BASE_URL="http://localhost:8000/api"; node test/api.test.mjs
> ```

## 测试账号（种子数据，密码均为 `123456`）

| 身份 | 账号 | role |
| --- | --- | --- |
| 管理员 | `admin` | admin |
| 教师 | `t001` | teacher |
| 学生 | `s001` | student |

密码在客户端用 `cyrb53` 加密后提交，测试脚本内置了相同算法，无需手动处理。

## 覆盖范围

- 登录与鉴权：正确登录、密码错误、身份不匹配、账号不存在、无 token / 非法 token 拦截
- 角色权限隔离：学生 / 教师越权访问管理员接口被拒，管理员正常访问
- 三类角色核心业务接口：仪表盘、菜单、课程、课表、成绩、考勤、公告

退出码：全部通过返回 `0`，有失败返回 `1`，便于接入 CI。
