/**
 * 教学业务接口：教师（课程、成绩、考勤）、学生（课表、成绩、考勤）、公告浏览
 */
import { route, ok, fail, paginate, like } from '../server'
import { nextId } from '../db'
import { sortNotices } from './admin'
import { CURRENT_SEMESTER, calcTotal } from '@/utils/constants'
import dayjs from 'dayjs'

const now = () => dayjs().format('YYYY-MM-DD HH:mm:ss')
const className = (db, id) => db.classes.find((c) => c.id === id)?.name || ''
const userName = (db, id) => db.users.find((u) => u.id === id)?.name || '未分配'
const studentsOfClass = (db, classIds) =>
  db.users.filter((u) => u.role === 'student' && classIds.includes(u.classId)).sort((a, b) => a.username.localeCompare(b.username))

/** 校验课程属于当前教师，返回课程或 null */
const ownCourse = (db, user, courseId) => db.courses.find((c) => c.id === Number(courseId) && c.teacherId === user.id) || null

// ======================== 教师：我的课程 ========================
route('get', '/api/teacher/courses', ({ query, user, db }) => {
  const { keyword, type, semester } = query
  const list = db.courses
    .filter((c) => c.teacherId === user.id)
    .filter((c) => like(keyword, c.name, c.code))
    .filter((c) => !type || c.type === type)
    .filter((c) => !semester || c.semester === semester)
    .map((c) => {
      const classes = c.classIds.map((id) => ({ id, name: className(db, id), studentCount: studentsOfClass(db, [id]).length }))
      return { ...c, classes, studentCount: classes.reduce((s, x) => s + x.studentCount, 0) }
    })
  return ok(list)
})

// ======================== 教师：成绩管理 ========================
route('get', '/api/teacher/scores', ({ query, user, db }) => {
  const course = ownCourse(db, user, query.courseId)
  if (!course) return fail('课程不存在或不是您的授课课程')
  const classIds = query.classId ? [Number(query.classId)] : course.classIds
  const list = studentsOfClass(db, classIds)
    .filter((s) => like(query.keyword, s.name, s.username))
    .map((s) => {
      const sc = db.scores.find((x) => x.courseId === course.id && x.studentId === s.id)
      return {
        studentId: s.id, username: s.username, name: s.name, className: className(db, s.classId),
        usual: sc?.usual ?? null, final: sc?.final ?? null, total: sc?.total ?? null
      }
    })
  return ok(list)
})

/** 批量保存成绩（新增或更新） */
route('post', '/api/teacher/scores', ({ body, user, db }) => {
  const course = ownCourse(db, user, body.courseId)
  if (!course) return fail('课程不存在或不是您的授课课程')
  const valid = (v) => v === null || (typeof v === 'number' && v >= 0 && v <= 100)
  for (const item of body.items || []) {
    if (!valid(item.usual) || !valid(item.final)) return fail('成绩必须在 0-100 之间')
  }
  let count = 0
  ;(body.items || []).forEach((item) => {
    let sc = db.scores.find((x) => x.courseId === course.id && x.studentId === item.studentId)
    if (!sc) {
      if (item.usual === null && item.final === null) return
      sc = { id: nextId(db.scores), courseId: course.id, studentId: item.studentId, semester: course.semester }
      db.scores.push(sc)
    }
    sc.usual = item.usual
    sc.final = item.final
    sc.total = calcTotal(item.usual, item.final)
    count++
  })
  return ok(null, `已保存 ${count} 条成绩`)
})

// ======================== 教师：考勤管理 ========================
route('get', '/api/teacher/attendance', ({ query, user, db }) => {
  const course = ownCourse(db, user, query.courseId)
  if (!course) return fail('课程不存在或不是您的授课课程')
  const classId = Number(query.classId)
  const record = db.attendance.find((a) => a.courseId === course.id && a.classId === classId && a.date === query.date) || null
  const students = studentsOfClass(db, [classId]).map((s) => ({ id: s.id, username: s.username, name: s.name }))
  return ok({ record, students })
})

/** 保存考勤：同一课程 + 班级 + 日期只保留一条记录 */
route('post', '/api/teacher/attendance', ({ body, user, db }) => {
  const course = ownCourse(db, user, body.courseId)
  if (!course) return fail('课程不存在或不是您的授课课程')
  if (!body.date) return fail('请选择考勤日期')
  if (dayjs(body.date).isAfter(dayjs(), 'day')) return fail('不能登记未来日期的考勤')
  let rec = db.attendance.find((a) => a.courseId === course.id && a.classId === body.classId && a.date === body.date)
  if (rec) {
    rec.records = body.records
    rec.updateTime = now()
    return ok(null, '考勤记录已更新')
  }
  rec = { id: nextId(db.attendance), courseId: course.id, classId: body.classId, date: body.date, records: body.records, createTime: now() }
  db.attendance.push(rec)
  return ok(null, '考勤记录已保存')
})

const countStatus = (records) => {
  const c = { present: 0, late: 0, leave: 0, absent: 0 }
  records.forEach((r) => c[r.status]++)
  return c
}

route('get', '/api/teacher/attendance/history', ({ query, user, db }) => {
  const mine = db.courses.filter((c) => c.teacherId === user.id).map((c) => c.id)
  const list = db.attendance
    .filter((a) => mine.includes(a.courseId))
    .filter((a) => !query.courseId || a.courseId === Number(query.courseId))
    .filter((a) => !query.classId || a.classId === Number(query.classId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((a) => ({
      id: a.id, courseId: a.courseId, classId: a.classId, date: a.date,
      courseName: db.courses.find((c) => c.id === a.courseId)?.name, className: className(db, a.classId),
      total: a.records.length, ...countStatus(a.records), updateTime: a.updateTime || a.createTime
    }))
  return ok(paginate(list, query))
})

// ======================== 学生：课表 / 成绩 / 考勤 ========================
route('get', '/api/student/timetable', ({ query, user, db }) => {
  const semester = query.semester || CURRENT_SEMESTER
  const list = db.courses
    .filter((c) => c.semester === semester && c.classIds.includes(user.classId))
    .map((c) => ({ ...c, teacherName: userName(db, c.teacherId) }))
  return ok({ className: className(db, user.classId), list })
})

route('get', '/api/student/scores', ({ query, user, db }) => {
  const all = db.scores
    .filter((s) => s.studentId === user.id)
    .filter((s) => !query.semester || s.semester === query.semester)
    .map((s) => {
      const c = db.courses.find((x) => x.id === s.courseId) || {}
      return { ...s, courseName: c.name, courseCode: c.code, courseType: c.type, credit: c.credit, hours: c.hours, teacherName: userName(db, c.teacherId) }
    })
    .sort((a, b) => b.semester.localeCompare(a.semester) || a.courseCode.localeCompare(b.courseCode))
  const courses = all.map((s) => ({ id: s.courseId, name: s.courseName }))
  const list = all.filter((s) => !query.courseId || s.courseId === Number(query.courseId))
  return ok({ list, courses })
})

route('get', '/api/student/attendance', ({ query, user, db }) => {
  const myCourses = db.courses.filter((c) => c.semester === CURRENT_SEMESTER && c.classIds.includes(user.classId))
  const details = []
  db.attendance.forEach((a) => {
    const course = myCourses.find((c) => c.id === a.courseId)
    if (!course) return
    const r = a.records.find((x) => x.studentId === user.id)
    if (r) details.push({ id: a.id, date: a.date, courseId: course.id, courseName: course.name, teacherName: userName(db, course.teacherId), status: r.status })
  })
  const summary = myCourses.map((c) => {
    const rows = details.filter((d) => d.courseId === c.id)
    return { courseId: c.id, courseName: c.name, total: rows.length, ...countStatus(rows) }
  })
  const list = details
    .filter((d) => !query.courseId || d.courseId === Number(query.courseId))
    .filter((d) => !query.status || d.status === query.status)
    .sort((a, b) => b.date.localeCompare(a.date))
  return ok({ summary, list })
})

// ======================== 公告浏览（教师 / 学生） ========================
route('get', '/api/board/notices', ({ query, user, db }) => {
  const list = sortNotices(db.notices.filter((n) => n.status === 'public'))
    .filter((n) => like(query.keyword, n.title, n.content))
    .filter((n) => !query.type || n.type === query.type)
    .filter((n) => !query.unread || !n.readBy.includes(user.id))
    .map(({ replies, readBy, content, ...n }) => ({
      ...n, summary: content.slice(0, 60), replyCount: replies.length, read: readBy.includes(user.id)
    }))
  return ok(paginate(list, query))
})

route('get', '/api/board/unread', ({ user, db }) =>
  ok(db.notices.filter((n) => n.status === 'public' && !n.readBy.includes(user.id)).length)
)

route('get', '/api/board/notices/:id', ({ params, user, db }) => {
  const n = db.notices.find((x) => x.id === Number(params.id) && x.status === 'public')
  if (!n) return fail('公告不存在或已隐藏')
  const { readBy, ...rest } = n
  return ok({ ...rest, read: readBy.includes(user.id) })
})

route('post', '/api/board/notices/:id/read', ({ params, user, db }) => {
  const n = db.notices.find((x) => x.id === Number(params.id))
  if (n && !n.readBy.includes(user.id)) n.readBy.push(user.id)
  return ok(null, '已标记为已读')
})

route('post', '/api/board/notices/read-all', ({ user, db }) => {
  db.notices.forEach((n) => {
    if (n.status === 'public' && !n.readBy.includes(user.id)) n.readBy.push(user.id)
  })
  return ok(null, '全部标记为已读')
})

route('post', '/api/board/notices/:id/replies', ({ params, body, user, db }) => {
  if (!(db.rolePerms[user.role] || []).includes('notice:reply')) return fail('当前角色没有留言权限', 403)
  const n = db.notices.find((x) => x.id === Number(params.id))
  if (!n) return fail('公告不存在')
  const content = String(body.content || '').trim()
  if (!content) return fail('留言内容不能为空')
  if (content.length > 200) return fail('留言最多 200 字')
  const reply = { id: nextId(n.replies), userId: user.id, name: user.name, content, time: now() }
  n.replies.push(reply)
  return ok(reply, '留言成功')
})

route('delete', '/api/board/notices/:id/replies/:rid', ({ params, user, db }) => {
  const n = db.notices.find((x) => x.id === Number(params.id))
  const reply = n?.replies.find((r) => r.id === Number(params.rid))
  if (!reply) return fail('留言不存在')
  if (reply.userId !== user.id && user.role !== 'admin') return fail('只能删除自己的留言', 403)
  n.replies = n.replies.filter((r) => r.id !== reply.id)
  return ok(null, '留言已删除')
})
