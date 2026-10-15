/**
 * 登录态：签发 JWT，中间件解析 token 并加载当前用户
 */
import jwt from 'jsonwebtoken'
import { queryOne } from './db.js'
import { fail } from './response.js'

const SECRET = process.env.JWT_SECRET || 'edu-admin-jwt-secret'
const EXPIRES = '12h'

export const signToken = (user) => jwt.sign({ id: user.id }, SECRET, { expiresIn: EXPIRES })

/** 去掉密码字段再返回给前端 */
export function safeUser(u) {
  if (!u) return null
  const { password, ...rest } = u
  return rest
}

/**
 * 认证中间件：校验 Authorization: Bearer <token>，并把用户挂到 req.user
 * 白名单（登录等）在 app.js 里不经过此中间件
 */
export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.json(fail('未登录或登录已过期', 401))
  try {
    const { id } = jwt.verify(token, SECRET)
    const user = await queryOne('SELECT * FROM users WHERE id = ? AND status = 1', [id])
    if (!user) return res.json(fail('登录已过期，请重新登录', 401))
    req.user = user
    next()
  } catch {
    return res.json(fail('登录已过期，请重新登录', 401))
  }
}

/** 要求指定角色（如仅管理员） */
export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.json(fail('无权限访问', 403))
  next()
}
