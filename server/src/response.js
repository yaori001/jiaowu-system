/** 统一响应格式 { code, msg, data }，与前端 axios 拦截器约定一致 */

export const ok = (data = null, msg = '操作成功') => ({ code: 200, msg, data })
export const fail = (msg = '操作失败', code = 500) => ({ code, msg, data: null })

/** 业务错误：路由里 throw new BizError('xxx') 会被全局处理成 fail */
export class BizError extends Error {
  constructor(msg, code = 500) {
    super(msg)
    this.code = code
  }
}

/** 包裹 async 路由，自动捕获异常交给错误中间件 */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/** 分页：从 query 取 page/size，对数组切片 */
export function paginate(list, query) {
  const page = Number(query.page) || 1
  const size = Number(query.size) || 10
  return { total: list.length, list: list.slice((page - 1) * size, page * size) }
}
