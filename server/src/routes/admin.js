/** 管理员接口：用户、班级、课程、公告、菜单权限 */
import { Router } from 'express'
import dayjs from 'dayjs'
import { query, queryOne, transaction } from '../db.js'
import { ok, fail, wrap, paginate } from '../response.js'
import { safeUser, requireRole } from '../auth.js'
import { encryptPassword, DEFAULT_PASSWORD } from '../crypto.js'
import { allMenus, classNameMap, userNameMap, permsForRole } from '../helpers.js'
import { PERMISSIONS, PROTECTED_ADMIN_MENUS } from '../constants.js'

const router = Router()
// 管理员路由在 index.js 中注册在最后：师生的请求已被前面的路由处理，
// 能走到这里的只有管理员路径或未知路径，这里统一要求 admin 角色。
router.use(requireRole('admin'))
const now = () => dayjs().format('YYYY-MM-DD HH:mm:ss')
const like = (kw, ...f) => (kw ? { c: '(' + f.map((x) => `${x} LIKE ?`).join(' OR ') + ')', p: f.map(() => `%${kw}%`) } : { c: '1=1', p: [] })

// ======================== 用户管理 ========================
router.get('/users', wrap(async (req, res) => {
  const { keyword, role, status, classId } = req.query
  const lk = like(keyword, 'name', 'username')
  const where = [lk.c]
  const params = [...lk.p]
  if (role) { where.push('role=?'); params.push(role) }
  if (status !== undefined && status !== '') { where.push('status=?'); params.push(Number(status)) }
  if (classId) { where.push('class_id=?'); params.push(Number(classId)) }
  const rows = await query(`SELECT * FROM users WHERE ${where.join(' AND ')} ORDER BY id`, params)
  const cls = await classNameMap()
  const list = rows.map((u) => ({ ...safeUser(u), classId: u.class_id, className: cls[u.class_id] || '' }))
  res.json(ok(paginate(list, req.query)))
}))

router.get('/users/options', wrap(async (req, res) => {
  const where = req.query.role ? 'WHERE role=?' : ''
  const rows = await query(`SELECT id, name, username, class_id FROM users ${where}`, req.query.role ? [req.query.role] : [])
  res.json(ok(rows.map((r) => ({ id: r.id, name: r.name, username: r.username, classId: r.class_id }))))
}))

/** 校验并插入一个用户，返回错误串或 null */
async function insertUser(conn, data) {
  const exist = await conn.query('SELECT id FROM users WHERE username=?', [data.username])
  if (exist[0].length) return `账号 ${data.username} 已存在`
  if (data.role === 'student') {
    const c = await conn.query('SELECT id FROM classes WHERE id=?', [data.classId])
    if (!c[0].length) return `学生 ${data.username} 未指定有效班级`
  }
  await conn.query(
    'INSERT INTO users (username, name, password, role, class_id, dept, phone, status, create_time) VALUES (?,?,?,?,?,?,?,1,?)',
    [data.username, data.name, data.password || encryptPassword(DEFAULT_PASSWORD), data.role,
      data.role === 'student' ? data.classId : null, data.dept || '信息工程学院', data.phone || '', now()]
  )
  return null
}

router.post('/users', wrap(async (req, res) => {
  const result = await transaction(async (conn) => {
    const err = await insertUser(conn, req.body)
    if (err) return { err }
    const [[u]] = await conn.query('SELECT * FROM users WHERE username=?', [req.body.username])
    return { u }
  })
  if (result.err) return res.json(fail(result.err))
  res.json(ok(safeUser(result.u), '新增成功'))
}))

router.post('/users/batch', wrap(async (req, res) => {
  const { users = [] } = req.body
  const out = await transaction(async (conn) => {
    const errors = []
    let success = 0
    for (const item of users) {
      const err = await insertUser(conn, item)
      if (err) errors.push(err)
      else success++
    }
    return { success, errors }
  })
  res.json(ok(out, `成功添加 ${out.success} 个用户${out.errors.length ? `，失败 ${out.errors.length} 个` : ''}`))
}))

router.put('/users/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)
  const b = req.body
  const target = await queryOne('SELECT * FROM users WHERE id=?', [id])
  if (!target) return res.json(fail('用户不存在'))
  if (id === req.user.id && b.role !== req.user.role) return res.json(fail('不能修改自己的角色'))
  const dup = await queryOne('SELECT id FROM users WHERE username=? AND id<>?', [b.username, id])
  if (dup) return res.json(fail('账号已存在'))
  if (b.role === 'student' && !b.classId) return res.json(fail('学生必须选择所属班级'))
  await query('UPDATE users SET username=?, name=?, role=?, phone=?, dept=?, class_id=? WHERE id=?',
    [b.username, b.name, b.role, b.phone || '', b.dept || '', b.role === 'student' ? b.classId : null, id])
  res.json(ok(null, '修改成功'))
}))

router.put('/users/:id/status', wrap(async (req, res) => {
  const id = Number(req.params.id)
  if (id === req.user.id) return res.json(fail('不能禁用当前登录账号'))
  const r = await query('UPDATE users SET status=? WHERE id=?', [req.body.status, id])
  if (!r.affectedRows) return res.json(fail('用户不存在'))
  res.json(ok(null, req.body.status === 1 ? '已启用' : '已禁用'))
}))

router.put('/users/:id/password', wrap(async (req, res) => {
  const target = await queryOne('SELECT name FROM users WHERE id=?', [Number(req.params.id)])
  if (!target) return res.json(fail('用户不存在'))
  await query('UPDATE users SET password=? WHERE id=?', [encryptPassword(DEFAULT_PASSWORD), Number(req.params.id)])
  res.json(ok(null, `已将 ${target.name} 的密码重置为 ${DEFAULT_PASSWORD}`))
}))

router.delete('/users', wrap(async (req, res) => {
  const ids = req.body.ids || []
  if (!ids.length) return res.json(ok(null, '未选择用户'))
  if (ids.includes(req.user.id)) return res.json(fail('不能删除当前登录账号'))
  const ph = ids.map(() => '?').join(',')
  const teaching = await query(`SELECT id FROM courses WHERE teacher_id IN (${ph})`, ids)
  if (teaching.length) return res.json(fail('所选教师仍有授课课程，请先在课程管理中更换授课教师'))
  await transaction(async (conn) => {
    await conn.query(`DELETE FROM scores WHERE student_id IN (${ph})`, ids)
    await conn.query(`DELETE FROM attendance_record WHERE student_id IN (${ph})`, ids)
    await conn.query(`UPDATE classes SET counselor_id=NULL WHERE counselor_id IN (${ph})`, ids)
    await conn.query(`DELETE FROM users WHERE id IN (${ph})`, ids)
  })
  res.json(ok(null, `成功删除 ${ids.length} 个用户`))
}))

// ======================== 班级管理 ========================
async function classView(c, cls, names) {
  const cnt = await queryOne("SELECT COUNT(*) n FROM users WHERE role='student' AND class_id=?", [c.id])
  return {
    id: c.id, name: c.name, major: c.major, year: c.year, counselorId: c.counselor_id,
    status: c.status, createTime: c.create_time,
    counselorName: names[c.counselor_id] || '', studentCount: cnt.n
  }
}

router.get('/classes', wrap(async (req, res) => {
  const { keyword, status, major } = req.query
  const lk = like(keyword, 'name', 'major')
  const where = [lk.c]; const params = [...lk.p]
  if (major) { where.push('major=?'); params.push(major) }
  if (status !== undefined && status !== '') { where.push('status=?'); params.push(Number(status)) }
  const rows = await query(`SELECT * FROM classes WHERE ${where.join(' AND ')} ORDER BY id`, params)
  const names = await userNameMap()
  const list = await Promise.all(rows.map((c) => classView(c, null, names)))
  res.json(ok(paginate(list, req.query)))
}))

router.get('/classes/options', wrap(async (req, res) => {
  const rows = await query('SELECT id, name, major FROM classes')
  res.json(ok(rows))
}))

router.post('/classes', wrap(async (req, res) => {
  const b = req.body
  if (await queryOne('SELECT id FROM classes WHERE name=?', [b.name])) return res.json(fail('班级名称已存在'))
  const r = await query('INSERT INTO classes (name, major, year, counselor_id, status, create_time) VALUES (?,?,?,?,?,?)',
    [b.name, b.major, b.year, b.counselorId || null, b.status ?? 1, now()])
  res.json(ok({ id: r.insertId }, '新增成功'))
}))

router.put('/classes/:id', wrap(async (req, res) => {
  const id = Number(req.params.id); const b = req.body
  if (!(await queryOne('SELECT id FROM classes WHERE id=?', [id]))) return res.json(fail('班级不存在'))
  if (await queryOne('SELECT id FROM classes WHERE name=? AND id<>?', [b.name, id])) return res.json(fail('班级名称已存在'))
  await query('UPDATE classes SET name=?, major=?, year=?, counselor_id=?, status=? WHERE id=?',
    [b.name, b.major, b.year, b.counselorId || null, b.status, id])
  res.json(ok(null, '修改成功'))
}))

router.put('/classes/:id/status', wrap(async (req, res) => {
  const r = await query('UPDATE classes SET status=? WHERE id=?', [req.body.status, Number(req.params.id)])
  if (!r.affectedRows) return res.json(fail('班级不存在'))
  res.json(ok(null, '状态已更新'))
}))

router.put('/classes/:id/students', wrap(async (req, res) => {
  const id = Number(req.params.id)
  const ids = req.body.studentIds || []
  await transaction(async (conn) => {
    // 先把原本属于该班、但不在新名单里的学生移出
    await conn.query("UPDATE users SET class_id=NULL WHERE role='student' AND class_id=?", [id])
    if (ids.length) {
      const ph = ids.map(() => '?').join(',')
      await conn.query(`UPDATE users SET class_id=? WHERE role='student' AND id IN (${ph})`, [id, ...ids])
    }
  })
  res.json(ok(null, `分配完成，当前班级共 ${ids.length} 名学生`))
}))

router.delete('/classes', wrap(async (req, res) => {
  const ids = req.body.ids || []
  if (!ids.length) return res.json(ok(null, '未选择班级'))
  const ph = ids.map(() => '?').join(',')
  const used = await query(`SELECT c.name FROM classes c WHERE c.id IN (${ph}) AND EXISTS (SELECT 1 FROM users u WHERE u.class_id=c.id)`, ids)
  if (used.length) return res.json(fail(`班级「${used.map((c) => c.name).join('、')}」下还有学生，无法删除`))
  await transaction(async (conn) => {
    await conn.query(`DELETE FROM course_class WHERE class_id IN (${ph})`, ids)
    await conn.query(`DELETE FROM classes WHERE id IN (${ph})`, ids)
  })
  res.json(ok(null, '删除成功'))
}))

// ======================== 课程管理 ========================
async function courseView(c, names, cls) {
  const ccRows = await query('SELECT class_id FROM course_class WHERE course_id=?', [c.id])
  const sch = await query('SELECT weekday, section, location, weeks FROM course_schedule WHERE course_id=? ORDER BY weekday, section', [c.id])
  const classIds = ccRows.map((x) => x.class_id)
  return {
    id: c.id, code: c.code, name: c.name, type: c.type, credit: Number(c.credit), hours: c.hours,
    semester: c.semester, teacherId: c.teacher_id, teacherName: names[c.teacher_id] || '',
    classIds, classNames: classIds.map((id) => cls[id]).filter(Boolean), schedule: sch
  }
}

router.get('/courses', wrap(async (req, res) => {
  const { keyword, type, semester, teacherId } = req.query
  const lk = like(keyword, 'name', 'code')
  const where = [lk.c]; const params = [...lk.p]
  if (type) { where.push('type=?'); params.push(type) }
  if (semester) { where.push('semester=?'); params.push(semester) }
  if (teacherId) { where.push('teacher_id=?'); params.push(Number(teacherId)) }
  const rows = await query(`SELECT * FROM courses WHERE ${where.join(' AND ')} ORDER BY id`, params)
  const names = await userNameMap(); const cls = await classNameMap()
  const list = await Promise.all(rows.map((c) => courseView(c, names, cls)))
  res.json(ok(paginate(list, req.query)))
}))

async function saveCourseRelations(conn, courseId, b) {
  await conn.query('DELETE FROM course_class WHERE course_id=?', [courseId])
  await conn.query('DELETE FROM course_schedule WHERE course_id=?', [courseId])
  for (const cid of b.classIds || []) await conn.query('INSERT INTO course_class (course_id, class_id) VALUES (?,?)', [courseId, cid])
  for (const s of b.schedule || []) {
    await conn.query('INSERT INTO course_schedule (course_id, weekday, section, location, weeks) VALUES (?,?,?,?,?)',
      [courseId, s.weekday, s.section, s.location, s.weeks])
  }
}

router.post('/courses', wrap(async (req, res) => {
  const b = req.body
  if (await queryOne('SELECT id FROM courses WHERE code=?', [b.code])) return res.json(fail('课程编号已存在'))
  const id = await transaction(async (conn) => {
    const [r] = await conn.query('INSERT INTO courses (code, name, type, credit, hours, semester, teacher_id, create_time) VALUES (?,?,?,?,?,?,?,?)',
      [b.code, b.name, b.type, b.credit, b.hours, b.semester, b.teacherId || null, now()])
    await saveCourseRelations(conn, r.insertId, b)
    return r.insertId
  })
  res.json(ok({ id }, '新增成功'))
}))

router.put('/courses/:id', wrap(async (req, res) => {
  const id = Number(req.params.id); const b = req.body
  if (!(await queryOne('SELECT id FROM courses WHERE id=?', [id]))) return res.json(fail('课程不存在'))
  if (await queryOne('SELECT id FROM courses WHERE code=? AND id<>?', [b.code, id])) return res.json(fail('课程编号已存在'))
  await transaction(async (conn) => {
    await conn.query('UPDATE courses SET code=?, name=?, type=?, credit=?, hours=?, semester=?, teacher_id=? WHERE id=?',
      [b.code, b.name, b.type, b.credit, b.hours, b.semester, b.teacherId || null, id])
    await saveCourseRelations(conn, id, b)
  })
  res.json(ok(null, '修改成功'))
}))

router.delete('/courses', wrap(async (req, res) => {
  const ids = req.body.ids || []
  if (!ids.length) return res.json(ok(null, '未选择课程'))
  const ph = ids.map(() => '?').join(',')
  await transaction(async (conn) => {
    const [atts] = await conn.query(`SELECT id FROM attendance WHERE course_id IN (${ph})`, ids)
    if (atts.length) {
      const aph = atts.map(() => '?').join(',')
      await conn.query(`DELETE FROM attendance_record WHERE attendance_id IN (${aph})`, atts.map((a) => a.id))
    }
    await conn.query(`DELETE FROM attendance WHERE course_id IN (${ph})`, ids)
    await conn.query(`DELETE FROM scores WHERE course_id IN (${ph})`, ids)
    await conn.query(`DELETE FROM course_schedule WHERE course_id IN (${ph})`, ids)
    await conn.query(`DELETE FROM course_class WHERE course_id IN (${ph})`, ids)
    await conn.query(`DELETE FROM courses WHERE id IN (${ph})`, ids)
  })
  res.json(ok(null, '删除成功'))
}))

// ======================== 公告管理 ========================
const NOTICE_ORDER = 'ORDER BY top DESC, publish_time DESC'

router.get('/notices', wrap(async (req, res) => {
  const { keyword, type, status } = req.query
  const lk = like(keyword, 'title', 'content')
  const where = [lk.c]; const params = [...lk.p]
  if (type) { where.push('type=?'); params.push(type) }
  if (status) { where.push('status=?'); params.push(status) }
  const rows = await query(
    `SELECT n.*,
       (SELECT COUNT(*) FROM notice_reply r WHERE r.notice_id=n.id) replyCount,
       (SELECT COUNT(*) FROM notice_read rd WHERE rd.notice_id=n.id) readCount
     FROM notices n WHERE ${where.join(' AND ')} ${NOTICE_ORDER}`, params)
  const list = rows.map((n) => ({
    id: n.id, title: n.title, type: n.type, status: n.status, top: !!n.top,
    publishTime: n.publish_time, authorId: n.author_id, authorName: n.author_name,
    createTime: n.create_time, replyCount: n.replyCount, readCount: n.readCount
  }))
  res.json(ok(paginate(list, req.query)))
}))

router.post('/notices', wrap(async (req, res) => {
  const b = req.body
  const r = await query('INSERT INTO notices (title, type, content, status, top, publish_time, author_id, author_name, create_time) VALUES (?,?,?,?,?,?,?,?,?)',
    [b.title, b.type, b.content, b.status || 'public', b.top ? 1 : 0, b.publishTime || now(), req.user.id, req.user.name, now()])
  res.json(ok({ id: r.insertId }, '发布成功'))
}))

router.put('/notices/:id', wrap(async (req, res) => {
  const b = req.body
  const r = await query('UPDATE notices SET title=?, type=?, content=?, status=?, top=?, publish_time=? WHERE id=?',
    [b.title, b.type, b.content, b.status || 'public', b.top ? 1 : 0, b.publishTime || now(), Number(req.params.id)])
  if (!r.affectedRows) return res.json(fail('公告不存在'))
  res.json(ok(null, '修改成功'))
}))

router.put('/notices/:id/top', wrap(async (req, res) => {
  const top = req.body.top ? 1 : 0
  const r = await query('UPDATE notices SET top=? WHERE id=?', [top, Number(req.params.id)])
  if (!r.affectedRows) return res.json(fail('公告不存在'))
  res.json(ok(null, top ? '已置顶' : '已取消置顶'))
}))

router.delete('/notices', wrap(async (req, res) => {
  const ids = req.body.ids || []
  if (!ids.length) return res.json(ok(null, '未选择公告'))
  const ph = ids.map(() => '?').join(',')
  await transaction(async (conn) => {
    await conn.query(`DELETE FROM notice_reply WHERE notice_id IN (${ph})`, ids)
    await conn.query(`DELETE FROM notice_read WHERE notice_id IN (${ph})`, ids)
    await conn.query(`DELETE FROM notices WHERE id IN (${ph})`, ids)
  })
  res.json(ok(null, '删除成功'))
}))

// ======================== 菜单 & 角色权限 ========================
router.get('/menus/all', wrap(async (req, res) => res.json(ok(await allMenus()))))

const pickMenu = (b) => [b.parentId || 0, b.title, b.path, b.component || '', b.icon || '', Number(b.sort) || 0, b.hidden ? 1 : 0]

router.post('/menus', wrap(async (req, res) => {
  const b = req.body
  if (await queryOne('SELECT id FROM menus WHERE path=?', [b.path])) return res.json(fail('路由地址已存在'))
  const id = await transaction(async (conn) => {
    const [r] = await conn.query('INSERT INTO menus (parent_id, title, path, component, icon, sort, hidden) VALUES (?,?,?,?,?,?,?)', pickMenu(b))
    for (const role of b.roles || ['admin']) await conn.query('INSERT INTO menu_role (menu_id, role) VALUES (?,?)', [r.insertId, role])
    return r.insertId
  })
  res.json(ok({ id }, '新增成功'))
}))

router.put('/menus/:id', wrap(async (req, res) => {
  const id = Number(req.params.id); const b = req.body
  const m = await queryOne('SELECT * FROM menus WHERE id=?', [id])
  if (!m) return res.json(fail('菜单不存在'))
  if (await queryOne('SELECT id FROM menus WHERE path=? AND id<>?', [b.path, id])) return res.json(fail('路由地址已存在'))
  if (b.parentId === id) return res.json(fail('上级菜单不能是自己'))
  if (PROTECTED_ADMIN_MENUS.includes(id) && b.hidden) return res.json(fail('该菜单为系统保护菜单，不能隐藏'))
  await query('UPDATE menus SET parent_id=?, title=?, path=?, component=?, icon=?, sort=?, hidden=? WHERE id=?', [...pickMenu(b), id])
  res.json(ok(null, '修改成功'))
}))

router.delete('/menus/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)
  if (PROTECTED_ADMIN_MENUS.includes(id)) return res.json(fail('该菜单为系统保护菜单，不能删除'))
  if (await queryOne('SELECT id FROM menus WHERE parent_id=?', [id])) return res.json(fail('请先删除子菜单'))
  await transaction(async (conn) => {
    await conn.query('DELETE FROM menu_role WHERE menu_id=?', [id])
    await conn.query('DELETE FROM menus WHERE id=?', [id])
  })
  res.json(ok(null, '删除成功'))
}))

router.get('/roles/perms', wrap(async (req, res) => {
  const roles = ['admin', 'teacher', 'student']
  const rolePerms = {}; const roleMenus = {}
  for (const r of roles) {
    rolePerms[r] = await permsForRole(r)
    const menus = await query('SELECT menu_id FROM menu_role WHERE role=?', [r])
    roleMenus[r] = menus.map((m) => m.menu_id)
  }
  res.json(ok({ permissions: PERMISSIONS, rolePerms, roleMenus }))
}))

router.put('/roles/:role', wrap(async (req, res) => {
  const role = req.params.role
  const menuIds = new Set(req.body.menuIds || [])
  if (role === 'admin') PROTECTED_ADMIN_MENUS.forEach((id) => menuIds.add(id))
  // 勾了子菜单，自动带上父级
  const all = await allMenus()
  all.forEach((m) => { if (menuIds.has(m.id) && m.parentId) menuIds.add(m.parentId) })
  await transaction(async (conn) => {
    await conn.query('DELETE FROM menu_role WHERE role=?', [role])
    for (const id of menuIds) await conn.query('INSERT INTO menu_role (menu_id, role) VALUES (?,?)', [id, role])
    await conn.query('DELETE FROM role_perm WHERE role=?', [role])
    for (const p of req.body.perms || []) await conn.query('INSERT INTO role_perm (role, perm) VALUES (?,?)', [role, p])
  })
  res.json(ok(null, '授权已保存'))
}))

export default router
