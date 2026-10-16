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
const results = []

async function test(name, fn) {
  try {
    await fn()
    passed++
    results.push({ name, ok: true })
    console.log(`  ✓ ${name}`)
  } catch (e) {
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

/* ========================== 汇总 ========================== */
const total = passed + failed
console.log('\n' + '='.repeat(48))
console.log(`测试结束：共 ${total} 条，通过 ${passed} 条，失败 ${failed} 条，通过率 ${total ? Math.round((passed / total) * 100) : 0}%`)
console.log('='.repeat(48) + '\n')

process.exit(failed ? 1 : 0)
