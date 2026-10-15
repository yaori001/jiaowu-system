/**
 * 管理员接口：用户、班级、课程、公告、菜单权限
 */
import { route, ok, fail, paginate, like, safeUser } from '../server'
import { nextId, PERMISSIONS, DEFAULT_PASSWORD } from '../db'
import { encryptPassword } from '@/utils/crypto'
import dayjs from 'dayjs'

const now = () => dayjs().format('YYYY-MM-DD HH:mm:ss')
const className = (db, id) => db.classes.find((c) => c.id === id)?.name || ''
const userName = (db, id) => db.users.find((u) => u.id === id)?.name || ''

// ======================== 用户管理 ========================
route('get', '/api/users', ({ query, db }) => {
  const { keyword, role, status, classId } = query
  const list = db.users
    .filter((u) => like(keyword, u.name, u.username))
    .filter((u) => !role || u.role === role)
    .filter((u) => status === undefined || status === '' || u.status === Number(status))
    .filter((u) => !classId || u.classId === Number(classId))
    .map((u) => ({ ...safeUser(u), className: className(db, u.classId) }))
  return ok(paginate(list, query))
})

/** 下拉选项：教师列表、学生列表 */
route('get', '/api/users/options', ({ query, db }) => {
  const list = db.users
    .filter((u) => !query.role || u.role === query.role)
    .map((u) => ({ id: u.id, name: u.name, username: u.username, classId: u.classId }))
  return ok(list)
})

/** 校验并组装用户数据，返回错误信息字符串或用户对象 */
function buildUser(db, data) {
  if (db.users.some((u) => u.username === data.username)) return `账号 ${data.username} 已存在`
  if (data.role === 'student' && !db.classes.some((c) => c.id === data.classId)) return `学生 ${data.username} 未指定有效班级`
  return {
    id: nextId(db.users),
    username: data.username,
    name: data.name,
    password: data.password || encryptPassword(DEFAULT_PASSWORD),
    role: data.role,
    classId: data.role === 'student' ? data.classId : null,
    dept: data.dept || '信息工程学院',
    phone: data.phone || '',
    status: 1,
    createTime: now()
  }
}

route('post', '/api/users', ({ body, db }) => {
  const u = buildUser(db, body)
  if (typeof u === 'string') return fail(u)
  db.users.push(u)
  return ok(safeUser(u), '新增成功')
})

/** 批量新增：遇到重复账号跳过，返回成功和失败数量 */
route('post', '/api/users/batch', ({ body, db }) => {
  const errors = []
  let success = 0
  ;(body.users || []).forEach((item) => {
    const u = buildUser(db, item)
    if (typeof u === 'string') errors.push(u)
    else {
      db.users.push(u)
      success++
    }
  })
  return ok({ success, errors }, `成功添加 ${success} 个用户${errors.length ? `，失败 ${errors.length} 个` : ''}`)
})

route('put', '/api/users/:id', ({ params, body, db, user }) => {
  const target = db.users.find((u) => u.id === Number(params.id))
  if (!target) return fail('用户不存在')
  if (target.id === user.id && body.role !== user.role) return fail('不能修改自己的角色')
  if (db.users.some((u) => u.username === body.username && u.id !== target.id)) return fail('账号已存在')
  if (body.role === 'student' && !body.classId) return fail('学生必须选择所属班级')
  Object.assign(target, {
    username: body.username, name: body.name, role: body.role, phone: body.phone, dept: body.dept,
    classId: body.role === 'student' ? body.classId : null
  })
  return ok(safeUser(target), '修改成功')
})

route('put', '/api/users/:id/status', ({ params, body, db, user }) => {
  const target = db.users.find((u) => u.id === Number(params.id))
  if (!target) return fail('用户不存在')
  if (target.id === user.id) return fail('不能禁用当前登录账号')
  target.status = body.status
  return ok(null, body.status === 1 ? '已启用' : '已禁用')
})

route('put', '/api/users/:id/password', ({ params, db }) => {
  const target = db.users.find((u) => u.id === Number(params.id))
  if (!target) return fail('用户不存在')
  target.password = encryptPassword(DEFAULT_PASSWORD)
  return ok(null, `已将 ${target.name} 的密码重置为 ${DEFAULT_PASSWORD}`)
})

route('delete', '/api/users', ({ body, db, user }) => {
  const ids = body.ids || []
  if (ids.includes(user.id)) return fail('不能删除当前登录账号')
  if (db.courses.some((c) => ids.includes(c.teacherId))) return fail('所选教师仍有授课课程，请先在课程管理中更换授课教师')
  db.users = db.users.filter((u) => !ids.includes(u.id))
  db.scores = db.scores.filter((s) => !ids.includes(s.studentId))
  db.classes.forEach((c) => {
    if (ids.includes(c.counselorId)) c.counselorId = null
  })
  return ok(null, `成功删除 ${ids.length} 个用户`)
})

// ======================== 班级管理 ========================
const classView = (db, c) => ({
  ...c,
  counselorName: userName(db, c.counselorId),
  studentCount: db.users.filter((u) => u.role === 'student' && u.classId === c.id).length
})

route('get', '/api/classes', ({ query, db }) => {
  const { keyword, status, major } = query
  const list = db.classes
    .filter((c) => like(keyword, c.name, c.major))
    .filter((c) => !major || c.major === major)
    .filter((c) => status === undefined || status === '' || c.status === Number(status))
    .map((c) => classView(db, c))
  return ok(paginate(list, query))
})

route('get', '/api/classes/options', ({ db }) => ok(db.classes.map((c) => ({ id: c.id, name: c.name, major: c.major }))))

route('post', '/api/classes', ({ body, db }) => {
  if (db.classes.some((c) => c.name === body.name)) return fail('班级名称已存在')
  const c = { id: nextId(db.classes), name: body.name, major: body.major, year: body.year, counselorId: body.counselorId || null, status: body.status ?? 1, createTime: now() }
  db.classes.push(c)
  return ok(c, '新增成功')
})

route('put', '/api/classes/:id', ({ params, body, db }) => {
  const c = db.classes.find((x) => x.id === Number(params.id))
  if (!c) return fail('班级不存在')
  if (db.classes.some((x) => x.name === body.name && x.id !== c.id)) return fail('班级名称已存在')
  Object.assign(c, { name: body.name, major: body.major, year: body.year, counselorId: body.counselorId || null, status: body.status })
  return ok(c, '修改成功')
})

route('put', '/api/classes/:id/status', ({ params, body, db }) => {
  const c = db.classes.find((x) => x.id === Number(params.id))
  if (!c) return fail('班级不存在')
  c.status = body.status
  return ok(null, '状态已更新')
})

/** 批量分配学生：studentIds 为该班级的完整学生名单 */
route('put', '/api/classes/:id/students', ({ params, body, db }) => {
  const id = Number(params.id)
  const ids = body.studentIds || []
  db.users.forEach((u) => {
    if (u.role !== 'student') return
    if (ids.includes(u.id)) u.classId = id
    else if (u.classId === id) u.classId = null
  })
  return ok(null, `分配完成，当前班级共 ${ids.length} 名学生`)
})

route('delete', '/api/classes', ({ body, db }) => {
  const ids = body.ids || []
  const used = db.classes.filter((c) => ids.includes(c.id) && db.users.some((u) => u.classId === c.id))
  if (used.length) return fail(`班级「${used.map((c) => c.name).join('、')}」下还有学生，无法删除`)
  db.classes = db.classes.filter((c) => !ids.includes(c.id))
  db.courses.forEach((c) => {
    c.classIds = c.classIds.filter((id) => !ids.includes(id))
  })
  return ok(null, '删除成功')
})

// ======================== 课程管理 ========================
route('get', '/api/courses', ({ query, db }) => {
  const { keyword, type, semester, teacherId } = query
  const list = db.courses
    .filter((c) => like(keyword, c.name, c.code))
    .filter((c) => !type || c.type === type)
    .filter((c) => !semester || c.semester === semester)
    .filter((c) => !teacherId || c.teacherId === Number(teacherId))
    .map((c) => ({ ...c, teacherName: userName(db, c.teacherId), classNames: c.classIds.map((id) => className(db, id)) }))
  return ok(paginate(list, query))
})

const pickCourse = (b) => ({
  code: b.code, name: b.name, type: b.type, credit: b.credit, hours: b.hours, semester: b.semester,
  teacherId: b.teacherId || null, classIds: b.classIds || [], schedule: b.schedule || []
})

route('post', '/api/courses', ({ body, db }) => {
  if (db.courses.some((c) => c.code === body.code)) return fail('课程编号已存在')
  const c = { id: nextId(db.courses), ...pickCourse(body) }
  db.courses.push(c)
  return ok(c, '新增成功')
})

route('put', '/api/courses/:id', ({ params, body, db }) => {
  const c = db.courses.find((x) => x.id === Number(params.id))
  if (!c) return fail('课程不存在')
  if (db.courses.some((x) => x.code === body.code && x.id !== c.id)) return fail('课程编号已存在')
  Object.assign(c, pickCourse(body))
  return ok(c, '修改成功')
})

route('delete', '/api/courses', ({ body, db }) => {
  const ids = body.ids || []
  db.courses = db.courses.filter((c) => !ids.includes(c.id))
  db.scores = db.scores.filter((s) => !ids.includes(s.courseId))
  db.attendance = db.attendance.filter((a) => !ids.includes(a.courseId))
  return ok(null, '删除成功')
})

// ======================== 公告管理 ========================
/** 排序：置顶优先，再按发布时间倒序 */
export const sortNotices = (list) =>
  [...list].sort((a, b) => Number(b.top) - Number(a.top) || b.publishTime.localeCompare(a.publishTime))

route('get', '/api/notices', ({ query, db }) => {
  const { keyword, type, status } = query
  const list = sortNotices(db.notices)
    .filter((n) => like(keyword, n.title, n.content))
    .filter((n) => !type || n.type === type)
    .filter((n) => !status || n.status === status)
    .map(({ replies, readBy, ...n }) => ({ ...n, replyCount: replies.length, readCount: readBy.length }))
  return ok(paginate(list, query))
})

const pickNotice = (b) => ({
  title: b.title, type: b.type, content: b.content, status: b.status || 'public',
  top: !!b.top, publishTime: b.publishTime || now()
})

route('post', '/api/notices', ({ body, db, user }) => {
  const n = { id: nextId(db.notices), ...pickNotice(body), authorId: user.id, authorName: user.name, readBy: [], replies: [], createTime: now() }
  db.notices.push(n)
  return ok(n, '发布成功')
})

route('put', '/api/notices/:id', ({ params, body, db }) => {
  const n = db.notices.find((x) => x.id === Number(params.id))
  if (!n) return fail('公告不存在')
  Object.assign(n, pickNotice(body))
  return ok(null, '修改成功')
})

route('put', '/api/notices/:id/top', ({ params, body, db }) => {
  const n = db.notices.find((x) => x.id === Number(params.id))
  if (!n) return fail('公告不存在')
  n.top = !!body.top
  return ok(null, n.top ? '已置顶' : '已取消置顶')
})

route('delete', '/api/notices', ({ body, db }) => {
  const ids = body.ids || []
  db.notices = db.notices.filter((n) => !ids.includes(n.id))
  return ok(null, '删除成功')
})

// ======================== 菜单 & 角色权限 ========================
/** 受保护菜单：保证管理员始终能进入首页和菜单权限页，避免把自己锁在系统外 */
const PROTECTED_ADMIN_MENUS = [1, 10, 15]

route('get', '/api/menus/all', ({ db }) => ok(db.menus))

const pickMenu = (b) => ({
  parentId: b.parentId || 0, title: b.title, path: b.path, component: b.component || '',
  icon: b.icon || '', sort: Number(b.sort) || 0, hidden: !!b.hidden
})

route('post', '/api/menus', ({ body, db }) => {
  if (db.menus.some((m) => m.path === body.path)) return fail('路由地址已存在')
  const m = { id: nextId(db.menus), ...pickMenu(body), roles: body.roles || ['admin'] }
  db.menus.push(m)
  return ok(m, '新增成功')
})

route('put', '/api/menus/:id', ({ params, body, db }) => {
  const m = db.menus.find((x) => x.id === Number(params.id))
  if (!m) return fail('菜单不存在')
  if (db.menus.some((x) => x.path === body.path && x.id !== m.id)) return fail('路由地址已存在')
  if (body.parentId === m.id) return fail('上级菜单不能是自己')
  if (PROTECTED_ADMIN_MENUS.includes(m.id) && body.hidden) return fail('该菜单为系统保护菜单，不能隐藏')
  Object.assign(m, pickMenu(body))
  return ok(m, '修改成功')
})

route('delete', '/api/menus/:id', ({ params, db }) => {
  const id = Number(params.id)
  if (PROTECTED_ADMIN_MENUS.includes(id)) return fail('该菜单为系统保护菜单，不能删除')
  if (db.menus.some((m) => m.parentId === id)) return fail('请先删除子菜单')
  db.menus = db.menus.filter((m) => m.id !== id)
  return ok(null, '删除成功')
})

/** 角色授权数据：权限字典 + 每个角色的菜单 id 和按钮权限 */
route('get', '/api/roles/perms', ({ db }) => {
  const roleMenus = {}
  ;['admin', 'teacher', 'student'].forEach((r) => {
    roleMenus[r] = db.menus.filter((m) => m.roles.includes(r)).map((m) => m.id)
  })
  return ok({ permissions: PERMISSIONS, rolePerms: db.rolePerms, roleMenus })
})

route('put', '/api/roles/:role', ({ params, body, db }) => {
  const role = params.role
  const menuIds = new Set(body.menuIds || [])
  if (role === 'admin') PROTECTED_ADMIN_MENUS.forEach((id) => menuIds.add(id))
  // 勾选了子菜单时，自动带上父级目录
  db.menus.forEach((m) => {
    if (menuIds.has(m.id) && m.parentId) menuIds.add(m.parentId)
  })
  db.menus.forEach((m) => {
    const has = m.roles.includes(role)
    if (menuIds.has(m.id) && !has) m.roles.push(role)
    if (!menuIds.has(m.id) && has) m.roles = m.roles.filter((r) => r !== role)
  })
  db.rolePerms[role] = body.perms || []
  return ok(null, '授权已保存')
})
