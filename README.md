# 教务管理系统

高职计算机专业 Vue 课程实训项目 —— 一套面向校园教务场景的 Web 管理系统，涵盖管理员、教师、学生三类角色。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3 + Vue Router 4 + Pinia + Element Plus + Axios + ECharts + Vite |
| 后端 | Node.js + Express + MySQL（mysql2）+ JWT |
| 接口文档 | Swagger (OpenAPI 3) |
| 部署 | Docker + Docker Compose（nginx 托管前端并反代 /api 到后端） |

## 目录结构

```
教务系统/
├── edu-admin/      前端（Vue3 单页应用）
├── server/         后端（Node.js + Express + MySQL）
│   ├── src/        接口代码
│   └── sql/        数据库建表脚本
├── web/            前端部署配置（nginx + docker-compose）
└── README.md
```

## 团队分工

| 成员 | 分支 | 负责模块 |
| --- | --- | --- |
| 后端 | `HHL2504210127` | 后端接口（Express 路由、鉴权、Swagger 文档、Docker 部署） |
| 数据库 | 待建 | 数据库设计（建表脚本、种子数据） |
| 前端 | 待建 | 前端页面（Vue3 各功能模块、登录、布局、图表） |

## 功能模块

- **通用**：登录/退出（路由守卫）、首页仪表盘、个人中心
- **管理员**：用户、班级、课程、公告管理，动态菜单与角色权限
- **教师**：我的课程、成绩录入、考勤登记、公告留言
- **学生**：课表、成绩查询、考勤查询、公告浏览

## 本地运行

### 前端
```bash
cd edu-admin
npm install
npm run dev        # 默认使用 Mock 数据，无需后端
```

### 后端（Docker）
```bash
cd server
cp .env.example .env     # 按需修改数据库密码等
docker compose up -d --build
```

接口文档：启动后访问 `http://<服务器>:8000/api-docs/`
