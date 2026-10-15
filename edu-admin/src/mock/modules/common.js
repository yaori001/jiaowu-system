/**
 * 通用接口：登录、菜单、首页仪表盘、个人中心
 */
import { route, ok, fail, safeUser } from '../server'
import { resetDb, DEFAULT_PASSWORD } from '../db'
import { encryptPassword } from '@/utils/crypto'
import { CURRENT_SEMESTER, SEMESTERS } from '@/utils/constants'

// ---------------- 登录 ----------------
route('post', '/api/login', ({ body, db }) => {
  const { username, password, role } = body
  const user = db.users.find((u) => u.username === username)
  if (!user || user.password !== password) return fail('账号或密码错误')
  if (user.role !== role) return fail('所选身份与账号不匹配')
  if (user.status !== 1) return fail('该账号已被禁用，请联系管理员')
  return ok({ token: `mock-token-${user.id}-${Date.now()}`, user: safeUser(user) }, '登录成功')
}, { auth: false })

route('post', '/api/logout', () => ok(null, '已退出登录'), { auth: false })

route('get', '/api/user/info', ({ user }) => ok(safeUser(user)))

// 恢复演示数据（仅管理员）
route('post', '/api/system/reset', ({ user }) => {
  if (user.role !== 'admin') return fail('无权限', 403)
  resetDb()
  return ok(null, '演示数据已恢复')
})

// ---------------- 菜单 & 权限 ----------------
/** 扁平菜单 → 树形结构 */
export function buildTree(list, parentId = 0) {
  return list
    .filter((m) => m.parentId === parentId)
    .sort((a, b) => a.sort - b.sort)
    .map((m) => {
      const children = buildTree(list, m.id)
      return children.length ? { ...m, children } : { ...m }
    })
}

/** 当前登录角色可访问的菜单（树形）+ 按钮权限 */
route('get', '/api/menus', ({ user, db }) => {
  const own = db.menus.filter((m) => m.roles.includes(user.role))
  // 只保留“有页面的菜单”和“下面有可访问子菜单的目录”
  const tree = buildTree(own).filter((m) => m.component || m.children?.length)
  return ok({ menus: tree, perms: db.rolePerms[user.role] || [] })
})

// ---------------- 首页仪表盘 ----------------
const avg = (arr) => (arr.length ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10 : 0)

route('get', '/api/dashboard', ({ user, db }) => {
  const students = db.users.filter((u) => u.role === 'student')
  const curCourses = db.courses.filter((c) => c.semester === CURRENT_SEMESTER)
  const publicNotices = db.notices.filter((n) => n.status === 'public')
  const unread = publicNotices.filter((n) => !n.readBy.includes(user.id)).length
  // 某课程是否还有学生没有综合成绩（待录成绩）
  const pendingScore = (c) => {
    const ids = students.filter((s) => c.classIds.includes(s.classId)).map((s) => s.id)
    return ids.some((id) => !db.scores.find((sc) => sc.courseId === c.id && sc.studentId === id && sc.total != null))
  }
  const classBar = {
    title: '各班级学生人数',
    x: db.classes.map((c) => c.name),
    y: db.classes.map((c) => students.filter((s) => s.classId === c.id).length)
  }

  if (user.role === 'admin') {
    const types = ['必修', '选修']
    return ok({
      cards: [
        { label: '用户总数', value: db.users.length, icon: 'User', color: '#409eff' },
        { label: '班级数', value: db.classes.length, icon: 'School', color: '#67c23a' },
        { label: '课程数', value: db.courses.length, icon: 'Reading', color: '#e6a23c' },
        { label: '公告数', value: db.notices.length, icon: 'Bell', color: '#f56c6c' },
        { label: '待办事项', value: curCourses.filter(pendingScore).length, icon: 'List', color: '#909399', tip: '本学期未完成成绩录入的课程' }
      ],
      pie: { title: '课程类型分布', data: types.map((t) => ({ name: t, value: db.courses.filter((c) => c.type === t).length })) },
      bar: classBar,
      todos: curCourses.filter(pendingScore).map((c) => `《${c.name}》成绩未录入完成`)
    })
  }

  if (user.role === 'teacher') {
    const mine = db.courses.filter((c) => c.teacherId === user.id)
    const mineCur = mine.filter((c) => c.semester === CURRENT_SEMESTER)
    const countOf = (c) => students.filter((s) => c.classIds.includes(s.classId)).length
    const pending = mineCur.filter(pendingScore)
    const classIds = [...new Set(mineCur.flatMap((c) => c.classIds))]
    return ok({
      cards: [
        { label: '本学期课程', value: mineCur.length, icon: 'Collection', color: '#409eff' },
        { label: '授课班级', value: classIds.length, icon: 'School', color: '#67c23a' },
        { label: '授课学生', value: students.filter((s) => classIds.includes(s.classId)).length, icon: 'User', color: '#e6a23c' },
        { label: '公告数', value: publicNotices.length, icon: 'Bell', color: '#f56c6c' },
        { label: '待办事项', value: pending.length, icon: 'List', color: '#909399', tip: '待录入成绩的课程' }
      ],
      pie: { title: '本学期授课学生分布', data: mineCur.map((c) => ({ name: c.name, value: countOf(c) })) },
      bar: {
        title: '各班级学生人数',
        x: classIds.map((id) => db.classes.find((c) => c.id === id)?.name),
        y: classIds.map((id) => students.filter((s) => s.classId === id).length)
      },
      todos: pending.map((c) => `《${c.name}》成绩待录入`)
    })
  }

  // 学生
  const myCourses = db.courses.filter((c) => c.classIds.includes(user.classId))
  const myCur = myCourses.filter((c) => c.semester === CURRENT_SEMESTER)
  const myScores = db.scores.filter((s) => s.studentId === user.id && s.total != null)
  const credits = myScores.filter((s) => s.total >= 60)
    .reduce((sum, s) => sum + (db.courses.find((c) => c.id === s.courseId)?.credit || 0), 0)
  const absent = db.attendance.reduce((n, a) => n + a.records.filter((r) => r.studentId === user.id && r.status === 'absent').length, 0)
  const lastSemester = SEMESTERS[1]
  const lastScores = myScores.filter((s) => s.semester === lastSemester)
  return ok({
    cards: [
      { label: '本学期课程', value: myCur.length, icon: 'Collection', color: '#409eff' },
      { label: '已获学分', value: credits, icon: 'Medal', color: '#67c23a' },
      { label: '平均成绩', value: avg(myScores.map((s) => s.total)), icon: 'Trophy', color: '#e6a23c' },
      { label: '缺勤次数', value: absent, icon: 'Warning', color: '#f56c6c' },
      { label: '未读公告', value: unread, icon: 'Bell', color: '#909399' }
    ],
    pie: { title: '本学期课程学分构成', data: myCur.map((c) => ({ name: c.name, value: c.credit })) },
    bar: {
      title: `${lastSemester} 学期成绩`,
      x: lastScores.map((s) => db.courses.find((c) => c.id === s.courseId)?.name),
      y: lastScores.map((s) => s.total)
    },
    todos: unread ? [`有 ${unread} 条公告未读`] : []
  })
})

// ---------------- 个人中心 ----------------
route('put', '/api/profile', ({ user, body }) => {
  const { name, phone, dept } = body
  if (!name) return fail('姓名不能为空')
  Object.assign(user, { name, phone, dept })
  return ok(safeUser(user), '保存成功')
})

route('put', '/api/profile/password', ({ user, body }) => {
  if (user.password !== body.oldPassword) return fail('原密码不正确')
  if (body.oldPassword === body.newPassword) return fail('新密码不能与原密码相同')
  user.password = body.newPassword
  return ok(null, '密码修改成功，请重新登录')
})

route('post', '/api/profile/password/reset', ({ user }) => {
  user.password = encryptPassword(DEFAULT_PASSWORD)
  return ok(null, `密码已重置为 ${DEFAULT_PASSWORD}，请重新登录`)
})
