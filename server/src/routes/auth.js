/** 通用接口：登录、菜单、仪表盘、个人中心 */
import { Router } from 'express'
import dayjs from 'dayjs'
import { query, queryOne } from '../db.js'
import { ok, fail, wrap, BizError } from '../response.js'
import { signToken, safeUser, requireRole } from '../auth.js'
import { encryptPassword, DEFAULT_PASSWORD } from '../crypto.js'
import { seed } from '../seed.js'
import { buildTree, menusForRole, permsForRole } from '../helpers.js'
import { CURRENT_SEMESTER, SEMESTERS } from '../constants.js'

const router = Router()
const now = () => dayjs().format('YYYY-MM-DD HH:mm:ss')

// ---------- 登录 / 登出（无需鉴权，在 app.js 中单独挂载） ----------
export const publicRouter = Router()

publicRouter.post('/login', wrap(async (req, res) => {
  const { username, password, role } = req.body
  const user = await queryOne('SELECT * FROM users WHERE username = ?', [username])
  if (!user || user.password !== password) return res.json(fail('账号或密码错误'))
  if (user.role !== role) return res.json(fail('所选身份与账号不匹配'))
  if (user.status !== 1) return res.json(fail('该账号已被禁用，请联系管理员'))
  res.json(ok({ token: signToken(user), user: safeUser(user) }, '登录成功'))
}))

publicRouter.post('/logout', (req, res) => res.json(ok(null, '已退出登录')))

// ---------- 以下需要登录 ----------
router.get('/user/info', wrap(async (req, res) => res.json(ok(safeUser(req.user)))))

router.get('/menus', wrap(async (req, res) => {
  const menus = await menusForRole(req.user.role)
  const perms = await permsForRole(req.user.role)
  const tree = buildTree(menus).filter((m) => m.component || m.children?.length)
  res.json(ok({ menus: tree, perms }))
}))

router.post('/system/reset', requireRole('admin'), wrap(async (req, res) => {
  await seed()
  res.json(ok(null, '演示数据已恢复'))
}))

// ---------- 个人中心 ----------
router.put('/profile', wrap(async (req, res) => {
  const { name, phone, dept } = req.body
  if (!name) return res.json(fail('姓名不能为空'))
  await query('UPDATE users SET name=?, phone=?, dept=? WHERE id=?', [name, phone || '', dept || '', req.user.id])
  const user = await queryOne('SELECT * FROM users WHERE id=?', [req.user.id])
  res.json(ok(safeUser(user), '保存成功'))
}))

router.put('/profile/password', wrap(async (req, res) => {
  const { oldPassword, newPassword } = req.body
  if (req.user.password !== oldPassword) return res.json(fail('原密码不正确'))
  if (oldPassword === newPassword) return res.json(fail('新密码不能与原密码相同'))
  await query('UPDATE users SET password=? WHERE id=?', [newPassword, req.user.id])
  res.json(ok(null, '密码修改成功，请重新登录'))
}))

router.post('/profile/password/reset', wrap(async (req, res) => {
  await query('UPDATE users SET password=? WHERE id=?', [encryptPassword(DEFAULT_PASSWORD), req.user.id])
  res.json(ok(null, `密码已重置为 ${DEFAULT_PASSWORD}，请重新登录`))
}))

// ---------- 首页仪表盘 ----------
const avg = (arr) => (arr.length ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10 : 0)

router.get('/dashboard', wrap(async (req, res) => {
  const user = req.user
  const students = await query("SELECT id, class_id FROM users WHERE role='student'")
  const classes = await query('SELECT id, name FROM classes')
  const curCourses = await query('SELECT * FROM courses WHERE semester=?', [CURRENT_SEMESTER])
  const notices = await query("SELECT id FROM notices WHERE status='public'")
  const readRows = await query('SELECT notice_id FROM notice_read WHERE user_id=?', [user.id])
  const readSet = new Set(readRows.map((r) => r.notice_id))
  const unread = notices.filter((n) => !readSet.has(n.id)).length

  // 课程 -> 班级 id
  const cc = await query('SELECT course_id, class_id FROM course_class')
  const classIdsOf = (courseId) => cc.filter((x) => x.course_id === courseId).map((x) => x.class_id)
  const studentsInClasses = (ids) => students.filter((s) => ids.includes(s.class_id))

  // 哪些课程还有学生没有综合成绩
  const scoreRows = await query('SELECT course_id, student_id, total FROM scores')
  const hasTotal = new Set(scoreRows.filter((s) => s.total != null).map((s) => `${s.course_id}-${s.student_id}`))
  const pendingScore = (course) => {
    const ids = studentsInClasses(classIdsOf(course.id)).map((s) => s.id)
    return ids.some((id) => !hasTotal.has(`${course.id}-${id}`))
  }

  const classBar = {
    title: '各班级学生人数',
    x: classes.map((c) => c.name),
    y: classes.map((c) => students.filter((s) => s.class_id === c.id).length)
  }

  if (user.role === 'admin') {
    const userCount = (await queryOne('SELECT COUNT(*) n FROM users')).n
    const courseCount = (await queryOne('SELECT COUNT(*) n FROM courses')).n
    const noticeCount = (await queryOne('SELECT COUNT(*) n FROM notices')).n
    const types = ['必修', '选修']
    const courseByType = await query('SELECT type, COUNT(*) n FROM courses GROUP BY type')
    const pending = curCourses.filter(pendingScore)
    return res.json(ok({
      cards: [
        { label: '用户总数', value: userCount, icon: 'User', color: '#409eff' },
        { label: '班级数', value: classes.length, icon: 'School', color: '#67c23a' },
        { label: '课程数', value: courseCount, icon: 'Reading', color: '#e6a23c' },
        { label: '公告数', value: noticeCount, icon: 'Bell', color: '#f56c6c' },
        { label: '待办事项', value: pending.length, icon: 'List', color: '#909399', tip: '本学期未完成成绩录入的课程' }
      ],
      pie: { title: '课程类型分布', data: types.map((t) => ({ name: t, value: courseByType.find((x) => x.type === t)?.n || 0 })) },
      bar: classBar,
      todos: pending.map((c) => `《${c.name}》成绩未录入完成`)
    }))
  }

  if (user.role === 'teacher') {
    const mineCur = curCourses.filter((c) => c.teacher_id === user.id)
    const classIds = [...new Set(mineCur.flatMap((c) => classIdsOf(c.id)))]
    const pending = mineCur.filter(pendingScore)
    const countOf = (c) => studentsInClasses(classIdsOf(c.id)).length
    return res.json(ok({
      cards: [
        { label: '本学期课程', value: mineCur.length, icon: 'Collection', color: '#409eff' },
        { label: '授课班级', value: classIds.length, icon: 'School', color: '#67c23a' },
        { label: '授课学生', value: studentsInClasses(classIds).length, icon: 'User', color: '#e6a23c' },
        { label: '公告数', value: notices.length, icon: 'Bell', color: '#f56c6c' },
        { label: '待办事项', value: pending.length, icon: 'List', color: '#909399', tip: '待录入成绩的课程' }
      ],
      pie: { title: '本学期授课学生分布', data: mineCur.map((c) => ({ name: c.name, value: countOf(c) })) },
      bar: {
        title: '各班级学生人数',
        x: classIds.map((id) => classes.find((c) => c.id === id)?.name),
        y: classIds.map((id) => students.filter((s) => s.class_id === id).length)
      },
      todos: pending.map((c) => `《${c.name}》成绩待录入`)
    }))
  }

  // 学生
  const myCourseIds = cc.filter((x) => x.class_id === user.class_id).map((x) => x.course_id)
  const allCourses = await query('SELECT * FROM courses')
  const myCur = allCourses.filter((c) => c.semester === CURRENT_SEMESTER && myCourseIds.includes(c.id))
  const myScores = scoreRows.filter((s) => s.student_id === user.id && s.total != null)
  const myScoreFull = await query('SELECT s.*, c.credit, c.semester FROM scores s JOIN courses c ON c.id=s.course_id WHERE s.student_id=? AND s.total IS NOT NULL', [user.id])
  const credits = myScoreFull.filter((s) => s.total >= 60).reduce((sum, s) => sum + Number(s.credit), 0)
  const absentRow = await queryOne(
    "SELECT COUNT(*) n FROM attendance_record WHERE student_id=? AND status='absent'", [user.id]
  )
  const lastSemester = SEMESTERS[1]
  const lastScores = await query(
    'SELECT s.total, c.name FROM scores s JOIN courses c ON c.id=s.course_id WHERE s.student_id=? AND s.semester=? AND s.total IS NOT NULL',
    [user.id, lastSemester]
  )
  return res.json(ok({
    cards: [
      { label: '本学期课程', value: myCur.length, icon: 'Collection', color: '#409eff' },
      { label: '已获学分', value: credits, icon: 'Medal', color: '#67c23a' },
      { label: '平均成绩', value: avg(myScores.map((s) => s.total)), icon: 'Trophy', color: '#e6a23c' },
      { label: '缺勤次数', value: absentRow.n, icon: 'Warning', color: '#f56c6c' },
      { label: '未读公告', value: unread, icon: 'Bell', color: '#909399' }
    ],
    pie: { title: '本学期课程学分构成', data: myCur.map((c) => ({ name: c.name, value: Number(c.credit) })) },
    bar: { title: `${lastSemester} 学期成绩`, x: lastScores.map((s) => s.name), y: lastScores.map((s) => s.total) },
    todos: unread ? [`有 ${unread} 条公告未读`] : []
  }))
}))

export default router
