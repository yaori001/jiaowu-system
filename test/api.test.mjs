/**
 * 教务管理系统 —— 后端接口自动化测试
 *
 * 不依赖任何第三方库，使用 Node 20 内置的 fetch 与 node:assert。
 * 覆盖：登录鉴权、角色越权拦截、三类角色核心接口。
 *
 * 运行：
 *   node test/api.test.mjs                 # 默认测线上 http://106.126.2.38:8000/api
 *   BASE_URL=http://localhost:8000/api node test/api.test.mjs   # 测本地
 */
import assert from 'node:assert'

const BASE = (process.env.BASE_URL || 'http://106.126.2.38:8000/api').replace(/\/$/, '')

/* ---------- 密码哈希：与前端 / 后端 crypto 完全一致 ---------- */
const SALT = 'edu-admin-salt'
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}
const encryptPassword = (pwd) => cyrb53(SALT + pwd, 1) + cyrb53(pwd + SALT, 2)
const PWD = encryptPassword('123456')

/* ---------- 简易测试框架 ---------- */
let passed = 0
let failed = 0
let skipped = 0
const results = []

/** 前置数据缺失时抛出，用例按“跳过”计，不记失败 */
class SkipError extends Error {}
const skip = (msg) => { throw new SkipError(msg) }

async function test(name, fn) {
  try {
    await fn()
    passed++
    results.push({ name, ok: true })
    console.log(`  ✓ ${name}`)
  } catch (e) {
    if (e instanceof SkipError) {
      skipped++
      results.push({ name, skip: true, err: e.message })
      console.log(`  ⊘ ${name}（跳过：${e.message}）`)
      return
    }
    failed++
    results.push({ name, ok: false, err: e.message })
    console.log(`  ✗ ${name}\n      → ${e.message}`)
  }
}

/* ---------- 请求封装 ---------- */
async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  let json = null
  try { json = await res.json() } catch { /* 可能是空响应 */ }
  return { status: res.status, json }
}

async function login(username, role, password = '123456') {
  const { json } = await api('POST', '/login', {
    body: { username, password: encryptPassword(password), role }
  })
  return json
}

/* ========================== 开始测试 ========================== */
console.log(`\n教务系统接口测试  目标：${BASE}\n`)

const tokens = {}

console.log('【模块一】登录与鉴权')
await test('TC-01 管理员正确账号密码登录成功', async () => {
  const r = await login('admin', 'admin')
  assert.strictEqual(r.code, 200, '返回码应为 200')
  assert.ok(r.data.token, '应返回 token')
  assert.strictEqual(r.data.user.role, 'admin')
  tokens.admin = r.data.token
})
await test('TC-02 教师登录成功', async () => {
  const r = await login('t001', 'teacher')
  assert.strictEqual(r.code, 200)
  tokens.teacher = r.data.token
})
await test('TC-03 学生登录成功', async () => {
  const r = await login('s001', 'student')
  assert.strictEqual(r.code, 200)
  tokens.student = r.data.token
})
await test('TC-04 密码错误登录失败', async () => {
  const r = await login('admin', 'admin', 'wrong-pwd')
  assert.notStrictEqual(r.code, 200, '应返回失败码')
  assert.ok(/密码/.test(r.msg), '提示应包含“密码”')
})
await test('TC-05 身份与账号不匹配登录失败', async () => {
  const r = await login('admin', 'student') // admin 账号选学生身份
  assert.notStrictEqual(r.code, 200)
})
await test('TC-06 不存在的账号登录失败', async () => {
  const r = await login('nobody-999', 'admin')
  assert.notStrictEqual(r.code, 200)
})
await test('TC-07 未携带 token 访问受保护接口被拦截(401)', async () => {
  const { json } = await api('GET', '/user/info')
  assert.strictEqual(json.code, 401, '业务码应为 401 未登录')
})
await test('TC-08 非法 token 被拦截(401)', async () => {
  const { json } = await api('GET', '/user/info', { token: 'invalid.token.here' })
  assert.strictEqual(json.code, 401)
})

console.log('\n【模块二】角色权限隔离')
await test('TC-09 学生越权访问管理员用户列表被拒(403)', async () => {
  const { json } = await api('GET', '/users', { token: tokens.student })
  assert.strictEqual(json.code, 403, '学生不应能访问 /users')
})
await test('TC-10 教师越权访问管理员用户列表被拒(403)', async () => {
  const { json } = await api('GET', '/users', { token: tokens.teacher })
  assert.strictEqual(json.code, 403)
})
await test('TC-11 管理员可正常访问用户列表(200)', async () => {
  const { json } = await api('GET', '/users', { token: tokens.admin })
  assert.strictEqual(json.code, 200)
})
await test('TC-12 学生越权访问教师成绩录入接口被拒(403)', async () => {
  const { json } = await api('GET', '/teacher/courses', { token: tokens.student })
  assert.strictEqual(json.code, 403)
})

console.log('\n【模块三】通用接口')
await test('TC-13 获取当前用户信息', async () => {
  const { json } = await api('GET', '/user/info', { token: tokens.admin })
  assert.strictEqual(json.code, 200)
  assert.strictEqual(json.data.username, 'admin')
  assert.ok(!('password' in json.data), '返回数据不应包含密码字段')
})
await test('TC-14 按角色返回菜单与权限', async () => {
  const { json } = await api('GET', '/menus', { token: tokens.student })
  assert.strictEqual(json.code, 200)
  assert.ok(Array.isArray(json.data.menus), '应返回菜单数组')
})
await test('TC-15 管理员首页仪表盘数据', async () => {
  const { json } = await api('GET', '/dashboard', { token: tokens.admin })
  assert.strictEqual(json.code, 200)
  assert.ok(Array.isArray(json.data.cards) && json.data.cards.length, '应返回统计卡片')
})

console.log('\n【模块四】教师业务接口')
await test('TC-16 教师获取我的课程', async () => {
  const { json } = await api('GET', '/teacher/courses', { token: tokens.teacher })
  assert.strictEqual(json.code, 200)
  assert.ok(Array.isArray(json.data))
})

console.log('\n【模块五】学生业务接口')
await test('TC-17 学生获取课表', async () => {
  const { json } = await api('GET', '/student/timetable', { token: tokens.student })
  assert.strictEqual(json.code, 200)
})
await test('TC-18 学生获取个人成绩', async () => {
  const { json } = await api('GET', '/student/scores', { token: tokens.student })
  assert.strictEqual(json.code, 200)
  assert.ok(Array.isArray(json.data.list), '应返回成绩列表')
})
await test('TC-19 学生查询考勤记录', async () => {
  const { json } = await api('GET', '/student/attendance', { token: tokens.student })
  assert.strictEqual(json.code, 200)
})

console.log('\n【模块六】公告模块')
await test('TC-20 获取公告列表', async () => {
  const { json } = await api('GET', '/board/notices', { token: tokens.student })
  assert.strictEqual(json.code, 200)
})

console.log('\n【模块七】写操作（可回滚，执行后恢复原值，不改动数据）')
await test('TC-21 教师录入成绩并校验，随后恢复原值', async () => {
  // 取教师的第一门课与其第一个班级
  const courses = (await api('GET', '/teacher/courses', { token: tokens.teacher })).json.data
  if (!courses?.length) skip('该教师暂无授课课程')
  const course = courses.find((c) => c.classes?.length)
  if (!course) skip('该教师课程下暂无班级')
  const classId = course.classes[0].id

  // 取第一名学生及其当前成绩（原值用于回滚）
  const before = (await api('GET', `/teacher/scores?courseId=${course.id}&classId=${classId}`, { token: tokens.teacher })).json.data
  if (!before?.length) skip('该班级暂无学生')
  const stu = before[0]
  const origin = { studentId: stu.studentId, usual: stu.usual, final: stu.final }

  // 写入一组测试分数
  const TEST = { studentId: stu.studentId, usual: 66, final: 77 }
  const save = await api('POST', '/teacher/scores', { token: tokens.teacher, body: { courseId: course.id, items: [TEST] } })
  assert.strictEqual(save.json.code, 200, '保存成绩应成功')

  // 校验写入结果：综合成绩 = 平时×40% + 期末×60% = 66×0.4 + 77×0.6 = 72.6 → 73（四舍五入）
  const after = (await api('GET', `/teacher/scores?courseId=${course.id}&classId=${classId}`, { token: tokens.teacher })).json.data
  const row = after.find((r) => r.studentId === stu.studentId)
  assert.strictEqual(row.usual, 66, '平时成绩应已写入')
  assert.strictEqual(row.final, 77, '期末成绩应已写入')
  assert.strictEqual(row.total, 73, '综合成绩应按 4:6 自动计算')

  // 回滚为原值
  const restore = await api('POST', '/teacher/scores', { token: tokens.teacher, body: { courseId: course.id, items: [origin] } })
  assert.strictEqual(restore.json.code, 200, '恢复原值应成功')
})

await test('TC-22 教师登记考勤并校验，随后恢复原状', async () => {
  // 从历史记录里找一条已有的考勤（这样可以精确恢复，不新增脏数据）
  const history = (await api('GET', '/teacher/attendance/history', { token: tokens.teacher })).json.data?.list
  if (!history?.length) skip('该教师暂无考勤历史记录')
  const h = history[0]

  // 读取该次考勤明细（原始状态用于回滚）
  const detail = (await api('GET', `/teacher/attendance?courseId=${h.courseId}&classId=${h.classId}&date=${h.date}`, { token: tokens.teacher })).json.data
  const students = detail.students
  if (!students?.length) skip('该考勤无学生')
  const originRecords = detail.record.records.map((r) => ({ studentId: r.studentId, status: r.status }))

  // 把第一名学生的状态改成与原来不同的值
  const first = originRecords[0]
  const flipped = first.status === 'absent' ? 'present' : 'absent'
  const modified = originRecords.map((r, i) => (i === 0 ? { ...r, status: flipped } : r))
  const save = await api('POST', '/teacher/attendance', { token: tokens.teacher, body: { courseId: h.courseId, classId: h.classId, date: h.date, records: modified } })
  assert.strictEqual(save.json.code, 200, '考勤保存应成功')

  // 校验修改已生效
  const check = (await api('GET', `/teacher/attendance?courseId=${h.courseId}&classId=${h.classId}&date=${h.date}`, { token: tokens.teacher })).json.data
  const changed = check.record.records.find((r) => r.studentId === first.studentId)
  assert.strictEqual(changed.status, flipped, '考勤状态应已被修改')

  // 回滚为原始状态
  const restore = await api('POST', '/teacher/attendance', { token: tokens.teacher, body: { courseId: h.courseId, classId: h.classId, date: h.date, records: originRecords } })
  assert.strictEqual(restore.json.code, 200, '恢复原状应成功')
})

/* ========================== 汇总 ========================== */
const total = passed + failed + skipped
const ran = passed + failed
console.log('\n' + '='.repeat(56))
console.log(`测试结束：共 ${total} 条，通过 ${passed} 条，失败 ${failed} 条，跳过 ${skipped} 条，通过率 ${ran ? Math.round((passed / ran) * 100) : 0}%`)
console.log('='.repeat(56) + '\n')

process.exit(failed ? 1 : 0)
