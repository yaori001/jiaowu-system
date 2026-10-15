/**
 * Mock 接口服务：用 Mock.js 拦截 /api 开头的 Ajax 请求，再按「方法 + 路径」分发给对应的处理函数
 * 写法模仿后端路由，例如：route('get', '/api/users/:id', handler)
 */
import Mock from 'mockjs'
import { getDb, saveDb } from './db'

const routes = []

/**
 * 注册接口
 * @param {'get'|'post'|'put'|'delete'} method
 * @param {string} path 支持 :param 动态参数
 * @param {(ctx) => any} handler ctx 包含 params / query / body / user / db
 * @param {{ auth?: boolean }} options auth=false 表示无需登录
 */
export function route(method, path, handler, options = {}) {
  const keys = []
  const pattern = path.replace(/:(\w+)/g, (_, key) => {
    keys.push(key)
    return '([^/]+)'
  })
  routes.push({ method, regex: new RegExp(`^${pattern}$`), keys, handler, auth: options.auth !== false })
}

/** 统一返回格式 */
export const ok = (data = null, msg = '操作成功') => ({ code: 200, msg, data })
export const fail = (msg = '操作失败', code = 500) => ({ code, msg, data: null })

/** 分页工具 */
export function paginate(list, query) {
  const page = Number(query.page) || 1
  const size = Number(query.size) || 10
  return { total: list.length, list: list.slice((page - 1) * size, page * size) }
}

/** 模糊匹配工具：任一字段包含关键字即匹配 */
export const like = (keyword, ...fields) =>
  !keyword || fields.some((f) => String(f ?? '').toLowerCase().includes(String(keyword).toLowerCase()))

/** 根据本地 token 识别当前用户（Mock.js 拿不到请求头，因此直接读 localStorage） */
function currentUser(db) {
  let token = null
  try {
    token = JSON.parse(localStorage.getItem('edu_token'))
  } catch {
    token = null
  }
  const id = Number(String(token || '').split('-')[2])
  return db.users.find((u) => u.id === id && u.status === 1) || null
}

/** 去掉用户的密码字段再返回给前端 */
export const safeUser = (u) => {
  if (!u) return null
  const { password, ...rest } = u
  return rest
}

function dispatch(method, options) {
  const [path, search = ''] = options.url.replace(/^https?:\/\/[^/]+/, '').split('?')
  const query = Object.fromEntries(new URLSearchParams(search))
  let body = {}
  try {
    body = options.body ? JSON.parse(options.body) : {}
  } catch {
    body = {}
  }

  for (const r of routes) {
    if (r.method !== method) continue
    const m = path.match(r.regex)
    if (!m) continue
    const db = getDb()
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]))
    const user = currentUser(db)
    if (r.auth && !user) return fail('登录已过期，请重新登录', 401)
    try {
      const result = r.handler({ params, query, body, user, db })
      // 非查询类请求执行后，把数据写回 localStorage
      if (method !== 'get') saveDb()
      // 深拷贝一次，避免页面修改返回值时直接改动了“数据库”
      return JSON.parse(JSON.stringify(result))
    } catch (e) {
      console.error('[mock] 接口异常', path, e)
      return fail('服务器内部错误：' + e.message)
    }
  }
  return fail(`接口不存在：${method.toUpperCase()} ${path}`, 404)
}

/** 启动 Mock：为四种请求方法注册统一拦截 */
export function startMock() {
  Mock.setup({ timeout: '100-300' }) // 模拟网络延迟，方便观察 loading 效果
  ;['get', 'post', 'put', 'delete'].forEach((method) => {
    Mock.mock(/\/api\//, method, (options) => dispatch(method, options))
  })
}
