/** 教学业务接口：教师（课程/成绩/考勤）、学生（课表/成绩/考勤）、公告浏览 */
import { Router } from 'express'
import dayjs from 'dayjs'
import { query, queryOne, transaction } from '../db.js'
import { ok, fail, wrap, paginate } from '../response.js'
import { permsForRole } from '../helpers.js'
import { requireRole } from '../auth.js'
import { CURRENT_SEMESTER, calcTotal } from '../constants.js'

const router = Router()

// 服务端角色拦截：/teacher/* 仅教师，/student/* 仅学生；/board/* 所有登录用户可用
router.use('/teacher', requireRole('teacher'))
router.use('/student', requireRole('student'))
const now = () => dayjs().format('YYYY-MM-DD HH:mm:ss')
const like = (kw, ...f) => (kw ? { c: '(' + f.map((x) => `${x} LIKE ?`).join(' OR ') + ')', p: f.map(() => `%${kw}%`) } : { c: '1=1', p: [] })

/** 校验课程属于当前教师 */
const ownCourse = (user, courseId) =>
  queryOne('SELECT * FROM courses WHERE id=? AND teacher_id=?', [Number(courseId), user.id])

const studentsOfClasses = (classIds) =>
  query(`SELECT id, username, name, class_id FROM users WHERE role='student' AND class_id IN (${classIds.map(() => '?').join(',')}) ORDER BY username`, classIds)

const classIdsOfCourse = async (courseId) =>
  (await query('SELECT class_id FROM course_class WHERE course_id=?', [courseId])).map((r) => r.class_id)

const countStatus = (records) => {
  const c = { present: 0, late: 0, leave: 0, absent: 0 }
  records.forEach((r) => c[r.status]++)
  return c
}

// ======================== 教师：我的课程 ========================
router.get('/teacher/courses', wrap(async (req, res) => {
  const { keyword, type, semester } = req.query
  const lk = like(keyword, 'name', 'code')
  const where = ['teacher_id=?', lk.c]; const params = [req.user.id, ...lk.p]
  if (type) { where.push('type=?'); params.push(type) }
  if (semester) { where.push('semester=?'); params.push(semester) }
  const rows = await query(`SELECT * FROM courses WHERE ${where.join(' AND ')} ORDER BY id`, params)
  const list = []
  for (const c of rows) {
    const classIds = await classIdsOfCourse(c.id)
    const classes = []
    for (const id of classIds) {
      const cl = await queryOne('SELECT name FROM classes WHERE id=?', [id])
      const cnt = await queryOne("SELECT COUNT(*) n FROM users WHERE role='student' AND class_id=?", [id])
      classes.push({ id, name: cl?.name, studentCount: cnt.n })
    }
    const sch = await query('SELECT weekday, section, location, weeks FROM course_schedule WHERE course_id=? ORDER BY weekday, section', [c.id])
    list.push({
      id: c.id, code: c.code, name: c.name, type: c.type, credit: Number(c.credit), hours: c.hours,
      semester: c.semester, schedule: sch, classes, studentCount: classes.reduce((s, x) => s + x.studentCount, 0)
    })
  }
  res.json(ok(list))
}))

// ======================== 教师：成绩管理 ========================
router.get('/teacher/scores', wrap(async (req, res) => {
  const course = await ownCourse(req.user, req.query.courseId)
  if (!course) return res.json(fail('课程不存在或不是您的授课课程'))
  const classIds = req.query.classId ? [Number(req.query.classId)] : await classIdsOfCourse(course.id)
  if (!classIds.length) return res.json(ok([]))
  const students = await studentsOfClasses(classIds)
  const scores = await query('SELECT * FROM scores WHERE course_id=?', [course.id])
  const cls = Object.fromEntries((await query('SELECT id, name FROM classes')).map((c) => [c.id, c.name]))
  const kw = req.query.keyword
  const list = students
    .filter((s) => !kw || s.name.includes(kw) || s.username.includes(kw))
    .map((s) => {
      const sc = scores.find((x) => x.student_id === s.id)
      return { studentId: s.id, username: s.username, name: s.name, className: cls[s.class_id] || '',
        usual: sc?.usual ?? null, final: sc?.final ?? null, total: sc?.total ?? null }
    })
  res.json(ok(list))
}))

router.post('/teacher/scores', wrap(async (req, res) => {
  const course = await ownCourse(req.user, req.body.courseId)
  if (!course) return res.json(fail('课程不存在或不是您的授课课程'))
  const valid = (v) => v === null || (typeof v === 'number' && v >= 0 && v <= 100)
  for (const item of req.body.items || []) {
    if (!valid(item.usual) || !valid(item.final)) return res.json(fail('成绩必须在 0-100 之间'))
  }
  const count = await transaction(async (conn) => {
    let n = 0
    for (const item of req.body.items || []) {
      const total = calcTotal(item.usual, item.final)
      const [exist] = await conn.query('SELECT id FROM scores WHERE course_id=? AND student_id=?', [course.id, item.studentId])
      if (exist.length) {
        await conn.query('UPDATE scores SET usual=?, final=?, total=? WHERE id=?', [item.usual, item.final, total, exist[0].id])
        n++
      } else if (item.usual !== null || item.final !== null) {
        await conn.query('INSERT INTO scores (course_id, student_id, usual, final, total, semester) VALUES (?,?,?,?,?,?)',
          [course.id, item.studentId, item.usual, item.final, total, course.semester])
        n++
      }
    }
    return n
  })
  res.json(ok(null, `已保存 ${count} 条成绩`))
}))

// ======================== 教师：考勤管理 ========================
router.get('/teacher/attendance', wrap(async (req, res) => {
  const course = await ownCourse(req.user, req.query.courseId)
  if (!course) return res.json(fail('课程不存在或不是您的授课课程'))
  const classId = Number(req.query.classId)
  const att = await queryOne('SELECT * FROM attendance WHERE course_id=? AND class_id=? AND date=?', [course.id, classId, req.query.date])
  let record = null
  if (att) {
    const records = await query('SELECT student_id AS studentId, status FROM attendance_record WHERE attendance_id=?', [att.id])
    record = { id: att.id, courseId: att.course_id, classId: att.class_id, date: att.date, records }
  }
  const students = (await studentsOfClasses([classId])).map((s) => ({ id: s.id, username: s.username, name: s.name }))
  res.json(ok({ record, students }))
}))

router.post('/teacher/attendance', wrap(async (req, res) => {
  const course = await ownCourse(req.user, req.body.courseId)
  if (!course) return res.json(fail('课程不存在或不是您的授课课程'))
  if (!req.body.date) return res.json(fail('请选择考勤日期'))
  if (dayjs(req.body.date).isAfter(dayjs(), 'day')) return res.json(fail('不能登记未来日期的考勤'))
  const msg = await transaction(async (conn) => {
    const [exist] = await conn.query('SELECT id FROM attendance WHERE course_id=? AND class_id=? AND date=?', [course.id, req.body.classId, req.body.date])
    let attId
    let updated = false
    if (exist.length) {
      attId = exist[0].id
      await conn.query('UPDATE attendance SET update_time=? WHERE id=?', [now(), attId])
      await conn.query('DELETE FROM attendance_record WHERE attendance_id=?', [attId])
      updated = true
    } else {
      const [r] = await conn.query('INSERT INTO attendance (course_id, class_id, date, create_time) VALUES (?,?,?,?)', [course.id, req.body.classId, req.body.date, now()])
      attId = r.insertId
    }
    for (const rec of req.body.records || []) {
      await conn.query('INSERT INTO attendance_record (attendance_id, student_id, status) VALUES (?,?,?)', [attId, rec.studentId, rec.status])
    }
    return updated ? '考勤记录已更新' : '考勤记录已保存'
  })
  res.json(ok(null, msg))
}))

router.get('/teacher/attendance/history', wrap(async (req, res) => {
  const where = ['c.teacher_id=?']; const params = [req.user.id]
  if (req.query.courseId) { where.push('a.course_id=?'); params.push(Number(req.query.courseId)) }
  if (req.query.classId) { where.push('a.class_id=?'); params.push(Number(req.query.classId)) }
  const rows = await query(
    `SELECT a.*, c.name courseName, cl.name className FROM attendance a
     JOIN courses c ON c.id=a.course_id JOIN classes cl ON cl.id=a.class_id
     WHERE ${where.join(' AND ')} ORDER BY a.date DESC`, params)
  const list = []
  for (const a of rows) {
    const recs = await query('SELECT status FROM attendance_record WHERE attendance_id=?', [a.id])
    list.push({ id: a.id, courseId: a.course_id, classId: a.class_id, date: a.date,
      courseName: a.courseName, className: a.className, total: recs.length, ...countStatus(recs),
      updateTime: a.update_time || a.create_time })
  }
  res.json(ok(paginate(list, req.query)))
}))

// ======================== 学生：课表 / 成绩 / 考勤 ========================
router.get('/student/timetable', wrap(async (req, res) => {
  const semester = req.query.semester || CURRENT_SEMESTER
  const courses = await query(
    `SELECT c.*, u.name teacherName FROM courses c
     JOIN course_class cc ON cc.course_id=c.id
     LEFT JOIN users u ON u.id=c.teacher_id
     WHERE c.semester=? AND cc.class_id=?`, [semester, req.user.class_id])
  const list = []
  for (const c of courses) {
    const sch = await query('SELECT weekday, section, location, weeks FROM course_schedule WHERE course_id=?', [c.id])
    list.push({ id: c.id, code: c.code, name: c.name, type: c.type, credit: Number(c.credit), hours: c.hours,
      teacherName: c.teacherName || '未分配', schedule: sch })
  }
  const cls = await queryOne('SELECT name FROM classes WHERE id=?', [req.user.class_id])
  res.json(ok({ className: cls?.name || '', list }))
}))

router.get('/student/scores', wrap(async (req, res) => {
  const rows = await query(
    `SELECT s.*, c.name courseName, c.code courseCode, c.type courseType, c.credit, c.hours, u.name teacherName
     FROM scores s JOIN courses c ON c.id=s.course_id LEFT JOIN users u ON u.id=c.teacher_id
     WHERE s.student_id=? ORDER BY s.semester DESC, c.code`, [req.user.id])
  const mapRow = (s) => ({
    id: s.id, courseId: s.course_id, usual: s.usual, final: s.final, total: s.total, semester: s.semester,
    courseName: s.courseName, courseCode: s.courseCode, courseType: s.courseType,
    credit: Number(s.credit), hours: s.hours, teacherName: s.teacherName || '未分配'
  })
  const all = rows.filter((s) => !req.query.semester || s.semester === req.query.semester).map(mapRow)
  const courses = all.map((s) => ({ id: s.courseId, name: s.courseName }))
  const list = all.filter((s) => !req.query.courseId || s.courseId === Number(req.query.courseId))
  res.json(ok({ list, courses }))
}))

router.get('/student/attendance', wrap(async (req, res) => {
  const courses = await query(
    `SELECT c.id, c.name, u.name teacherName FROM courses c
     JOIN course_class cc ON cc.course_id=c.id LEFT JOIN users u ON u.id=c.teacher_id
     WHERE c.semester=? AND cc.class_id=?`, [CURRENT_SEMESTER, req.user.class_id])
  const details = []
  for (const c of courses) {
    const rows = await query(
      `SELECT a.date, r.status FROM attendance a
       JOIN attendance_record r ON r.attendance_id=a.id AND r.student_id=?
       WHERE a.course_id=? AND a.class_id=?`, [req.user.id, c.id, req.user.class_id])
    rows.forEach((r) => details.push({ id: `${c.id}-${r.date}`, date: r.date, courseId: c.id, courseName: c.name, teacherName: c.teacherName || '未分配', status: r.status }))
  }
  const summary = courses.map((c) => {
    const rows = details.filter((d) => d.courseId === c.id)
    return { courseId: c.id, courseName: c.name, total: rows.length, ...countStatus(rows) }
  })
  const list = details
    .filter((d) => !req.query.courseId || d.courseId === Number(req.query.courseId))
    .filter((d) => !req.query.status || d.status === req.query.status)
    .sort((a, b) => b.date.localeCompare(a.date))
  res.json(ok({ summary, list }))
}))

// ======================== 公告浏览 ========================
const publicNoticeOrder = 'ORDER BY top DESC, publish_time DESC'

router.get('/board/notices', wrap(async (req, res) => {
  const lk = like(req.query.keyword, 'title', 'content')
  const where = ["status='public'", lk.c]; const params = [...lk.p]
  if (req.query.type) { where.push('type=?'); params.push(req.query.type) }
  const rows = await query(`SELECT * FROM notices WHERE ${where.join(' AND ')} ${publicNoticeOrder}`, params)
  const readRows = await query('SELECT notice_id FROM notice_read WHERE user_id=?', [req.user.id])
  const readSet = new Set(readRows.map((r) => r.notice_id))
  let list = rows.map((n) => ({
    id: n.id, title: n.title, type: n.type, top: !!n.top, publishTime: n.publish_time,
    authorName: n.author_name, summary: n.content.slice(0, 60), read: readSet.has(n.id)
  }))
  if (req.query.unread) list = list.filter((n) => !n.read)
  // 补 replyCount
  for (const n of list) {
    const c = await queryOne('SELECT COUNT(*) n FROM notice_reply WHERE notice_id=?', [n.id])
    n.replyCount = c.n
  }
  res.json(ok(paginate(list, req.query)))
}))

router.get('/board/unread', wrap(async (req, res) => {
  const row = await queryOne(
    "SELECT COUNT(*) n FROM notices n WHERE n.status='public' AND n.id NOT IN (SELECT notice_id FROM notice_read WHERE user_id=?)",
    [req.user.id])
  res.json(ok(row.n))
}))

router.get('/board/notices/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)
  const n = await queryOne("SELECT * FROM notices WHERE id=? AND status='public'", [id])
  if (!n) return res.json(fail('公告不存在或已隐藏'))
  const replies = await query('SELECT id, user_id AS userId, name, content, time FROM notice_reply WHERE notice_id=? ORDER BY id', [id])
  const read = await queryOne('SELECT 1 x FROM notice_read WHERE notice_id=? AND user_id=?', [id, req.user.id])
  res.json(ok({
    id: n.id, title: n.title, type: n.type, content: n.content, status: n.status, top: !!n.top,
    publishTime: n.publish_time, authorId: n.author_id, authorName: n.author_name, createTime: n.create_time,
    replies, read: !!read
  }))
}))

router.post('/board/notices/:id/read', wrap(async (req, res) => {
  await query('INSERT IGNORE INTO notice_read (notice_id, user_id) VALUES (?,?)', [Number(req.params.id), req.user.id])
  res.json(ok(null, '已标记为已读'))
}))

router.post('/board/notices/read-all', wrap(async (req, res) => {
  await query(
    "INSERT IGNORE INTO notice_read (notice_id, user_id) SELECT id, ? FROM notices WHERE status='public'",
    [req.user.id])
  res.json(ok(null, '全部标记为已读'))
}))

router.post('/board/notices/:id/replies', wrap(async (req, res) => {
  const perms = await permsForRole(req.user.role)
  if (!perms.includes('notice:reply')) return res.json(fail('当前角色没有留言权限', 403))
  const content = String(req.body.content || '').trim()
  if (!content) return res.json(fail('留言内容不能为空'))
  if (content.length > 200) return res.json(fail('留言最多 200 字'))
  if (!(await queryOne('SELECT id FROM notices WHERE id=?', [Number(req.params.id)]))) return res.json(fail('公告不存在'))
  const time = now()
  const r = await query('INSERT INTO notice_reply (notice_id, user_id, name, content, time) VALUES (?,?,?,?,?)',
    [Number(req.params.id), req.user.id, req.user.name, content, time])
  res.json(ok({ id: r.insertId, userId: req.user.id, name: req.user.name, content, time }, '留言成功'))
}))

router.delete('/board/notices/:id/replies/:rid', wrap(async (req, res) => {
  const reply = await queryOne('SELECT * FROM notice_reply WHERE id=? AND notice_id=?', [Number(req.params.rid), Number(req.params.id)])
  if (!reply) return res.json(fail('留言不存在'))
  if (reply.user_id !== req.user.id && req.user.role !== 'admin') return res.json(fail('只能删除自己的留言', 403))
  await query('DELETE FROM notice_reply WHERE id=?', [reply.id])
  res.json(ok(null, '留言已删除'))
}))

export default router
