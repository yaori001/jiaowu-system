# 教务管理系统（Vue3 课程实训项目）

根据《Vue课程实训项目——教务管理系统详细需求分析》实现的纯前端教务管理系统。数据由 Mock.js 模拟，并保存在浏览器的 localStorage 中，不需要后端就能完整运行。

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 核心框架 | Vue 3（`<script setup>` 组合式 API） |
| 路由 | Vue Router 4（动态路由 + 路由守卫） |
| 状态管理 | Pinia |
| UI 组件库 | Element Plus + @element-plus/icons-vue |
| 网络请求 | Axios（二次封装 + 拦截器） |
| 模拟数据 | Mock.js |
| 图表 | ECharts |
| 构建工具 | Vite |

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器 http://localhost:5173
npm run build    # 打包到 dist 目录
```

## 演示账号（密码均为 `123456`）

| 身份 | 账号 | 说明 |
| --- | --- | --- |
| 超级管理员 | admin | 全部管理功能 |
| 教师 | t001 ~ t008 | t001 张明：讲授 Vue.js、软件测试等课程 |
| 学生 | s001 ~ s120 | 每班 30 人，s001 ~ s030 属于软件技术2401 |

> 管理员登录后，点击顶部的「↺」按钮可以恢复初始演示数据。

## 目录结构

```
src/
├── api/              # 接口请求（按模块拆分）
│   ├── request.js    # axios 封装：token、统一错误处理、401 跳转登录
│   ├── auth.js       # 登录、菜单、首页、个人中心
│   ├── admin.js      # 管理员：用户 / 班级 / 课程 / 公告 / 菜单权限
│   └── teaching.js   # 教师、学生业务 + 公告浏览
├── mock/             # Mock 数据层（模拟后端）
│   ├── db.js         # 种子数据 + localStorage 持久化
│   ├── server.js     # 路由分发：route('get', '/api/users/:id', handler)
│   └── modules/      # 各模块接口实现
├── router/index.js   # 静态路由 + 全局守卫（登录拦截、动态路由加载、403）
├── stores/           # Pinia：user（登录态）、menu（菜单/权限）、app（界面状态）
├── directives/perm.js# 按钮权限指令 v-perm
├── layout/           # 后台布局：侧边栏菜单、顶部导航
├── components/       # 通用组件（EChart 图表封装）
├── utils/            # 常量字典、表单校验规则、密码加密、CSV 导出、本地存储
└── views/
    ├── Login.vue
    ├── common/       # 首页仪表盘、个人中心、公告浏览（教师/学生共用）
    ├── admin/        # 用户、班级、课程、公告、菜单权限管理
    ├── teacher/      # 我的课程、成绩管理、考勤管理
    ├── student/      # 我的课表、成绩查询、考勤查询
    └── error/        # 403、404
```

## 功能与需求对照

| 需求章节 | 实现位置 | 核心知识点 |
| --- | --- | --- |
| 2.1.1 登录与退出 | `views/Login.vue`、`stores/user.js`、`router/index.js` | 表单校验、Pinia、路由守卫 |
| 2.1.2 首页仪表盘 | `views/common/Dashboard.vue` | 按角色展示统计卡片、ECharts 图表 |
| 2.1.3 个人中心 | `views/common/Profile.vue` | 数据回显、修改/重置密码 |
| 2.2.1 用户管理 | `views/admin/UserManage.vue` | 增删改查、分页、批量添加/删除、启用/禁用 |
| 2.2.2 班级管理 | `views/admin/ClassManage.vue` | 绑定辅导员、el-transfer 批量分配学生 |
| 2.2.3 课程管理 | `views/admin/CourseManage.vue` | 分配教师与班级、动态表单（排课） |
| 2.2.4 公告管理 | `views/admin/NoticeManage.vue` | 置顶、公开/隐藏、发布时间 |
| 2.2.5 权限菜单管理 | `views/admin/MenuManage.vue`、`stores/menu.js` | **动态路由 addRoute**、角色授权、按钮权限 |
| 2.3.1 我的课程 | `views/teacher/MyCourse.vue` | 卡片列表、带参数跳转 |
| 2.3.2 成绩管理 | `views/teacher/ScoreManage.vue` | 表格内编辑、批量录入、修改跟踪、CSV 导出 |
| 2.3.3 考勤管理 | `views/teacher/AttendanceManage.vue` | 单选按钮组、记录回显、历史查询 |
| 2.3.4 / 2.4.4 公告查看 | `views/common/NoticeBoard.vue` | 已读标记、留言回复、未读角标 |
| 2.4.1 我的课表 | `views/student/Timetable.vue` | 周视图 / 日视图、计算属性 |
| 2.4.2 成绩查询 | `views/student/MyScore.vue` | 筛选、统计、绩点、可视化 |
| 2.4.3 考勤查询 | `views/student/MyAttendance.vue` | 统计汇总、前端分页 |
| 3.3 安全性 | `router/index.js`、`utils/validate.js`、`utils/crypto.js` | 路由守卫、非法字符校验、密码哈希后再传输 |
| 6.1 基础拓展 | — | 刷新页面保持登录、加载动画、暗黑模式 |

## 权限设计说明

1. **页面级**：登录后调用 `/api/menus` 获取当前角色的菜单树，再用 `router.addRoute` 动态添加路由。没有权限的页面根本不会注册路由；直接输入 `/admin/...` 这类地址会被拦截到 403 页面。
2. **按钮级**：菜单接口同时返回权限码（如 `user:add`），模板中用 `v-perm="'user:add'"` 控制按钮是否显示。
3. 管理员可以在「菜单权限 → 角色授权」里调整每个角色能访问的页面和按钮，保存后立即生效。

## 对接真实后端

1. 删除 `src/main.js` 中的 `import './mock'`；
2. 在 `vite.config.js` 中配置 `server.proxy`，把 `/api` 代理到后端地址；
3. 后端按 `{ code, msg, data }` 格式返回数据即可。
