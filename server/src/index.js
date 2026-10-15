/** 应用入口：装配中间件与路由，启动服务 */
import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import { openapiSpec } from './openapi.js'
import { waitForDb } from './db.js'
import { seedIfEmpty } from './seed.js'
import { authMiddleware } from './auth.js'
import { fail } from './response.js'
import authRouter, { publicRouter } from './routes/auth.js'
import adminRouter from './routes/admin.js'
import teachingRouter from './routes/teaching.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

// 健康检查
app.get('/api/health', (req, res) => res.json({ code: 200, msg: 'ok', data: 'edu-admin-server' }))

// Swagger 接口文档（公开访问）：/api-docs 页面，/api-docs.json 原始规范
app.get('/api-docs.json', (req, res) => res.json(openapiSpec))
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
  customSiteTitle: '教务管理系统 API 文档',
  swaggerOptions: { persistAuthorization: true, docExpansion: 'none', filter: true }
}))

// 无需登录的接口（登录、登出）
app.use('/api', publicRouter)

// 以下接口需要登录
// 顺序：通用 → 教学业务 → 管理员。
// 管理员路由放最后，内部用 requireRole('admin') 自检；师生的请求会被前面的路由先处理掉，不会误触管理员校验。
app.use('/api', authMiddleware, authRouter)
app.use('/api', authMiddleware, teachingRouter)
app.use('/api', authMiddleware, adminRouter)

// 404
app.use('/api', (req, res) => res.json(fail(`接口不存在：${req.method} ${req.path}`, 404)))

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('[error]', req.method, req.originalUrl, err)
  res.json(fail(err.code && err.code !== 500 ? err.message : '服务器内部错误：' + err.message, err.code || 500))
})

const PORT = Number(process.env.PORT) || 3000

async function bootstrap() {
  await waitForDb()
  await seedIfEmpty()
  app.listen(PORT, () => console.log(`[server] 教务系统后端已启动: http://0.0.0.0:${PORT}`))
}

bootstrap().catch((e) => {
  console.error('启动失败:', e)
  process.exit(1)
})
