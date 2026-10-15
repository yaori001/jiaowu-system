/**
 * 模拟数据库
 * - 首次运行时用 Mock.js 生成演示数据（种子数据）
 * - 数据保存在 localStorage，增删改后刷新页面数据依然存在
 * - 调用 resetDb() 可恢复初始演示数据
 */
import Mock from 'mockjs'
import { encryptPassword } from '@/utils/crypto'
import { SEMESTER_START } from '@/utils/constants'

const DB_KEY = 'edu_mock_db'
const DB_VERSION = 1
const Random = Mock.Random

/** 默认密码，所有演示账号相同 */
export const DEFAULT_PASSWORD = '123456'

/** 按钮级权限字典（菜单权限页面展示用） */
export const PERMISSIONS = [
  { group: '用户管理', items: [
    { code: 'user:add', label: '新增' }, { code: 'user:edit', label: '编辑' },
    { code: 'user:delete', label: '删除' }, { code: 'user:status', label: '启用/禁用' },
    { code: 'user:reset', label: '重置密码' }
  ] },
  { group: '班级管理', items: [
    { code: 'class:add', label: '新增' }, { code: 'class:edit', label: '编辑' },
    { code: 'class:delete', label: '删除' }, { code: 'class:assign', label: '分配学生' }
  ] },
  { group: '课程管理', items: [
    { code: 'course:add', label: '新增' }, { code: 'course:edit', label: '编辑' },
    { code: 'course:delete', label: '删除' }
  ] },
  { group: '公告管理', items: [
    { code: 'notice:add', label: '发布' }, { code: 'notice:edit', label: '编辑' },
    { code: 'notice:delete', label: '删除' }, { code: 'notice:top', label: '置顶' }
  ] },
  { group: '菜单权限', items: [
    { code: 'menu:add', label: '新增菜单' }, { code: 'menu:edit', label: '编辑菜单' },
    { code: 'menu:delete', label: '删除菜单' }, { code: 'role:assign', label: '角色授权' }
  ] },
  { group: '教学业务', items: [
    { code: 'score:edit', label: '成绩录入' }, { code: 'score:export', label: '成绩导出' },
    { code: 'attendance:edit', label: '考勤登记' }, { code: 'notice:reply', label: '公告留言' }
  ] }
]

const ALL_ROLES = ['admin', 'teacher', 'student']

/** 菜单种子数据：component 对应 src/views 下的文件路径 */
function seedMenus() {
  return [
    { id: 1, parentId: 0, title: '首页', path: '/dashboard', component: 'common/Dashboard', icon: 'HomeFilled', sort: 1, hidden: false, roles: ALL_ROLES },

    { id: 10, parentId: 0, title: '系统管理', path: '/admin', component: '', icon: 'Setting', sort: 2, hidden: false, roles: ['admin'] },
    { id: 11, parentId: 10, title: '用户管理', path: '/admin/user', component: 'admin/UserManage', icon: 'User', sort: 1, hidden: false, roles: ['admin'] },
    { id: 12, parentId: 10, title: '班级管理', path: '/admin/class', component: 'admin/ClassManage', icon: 'School', sort: 2, hidden: false, roles: ['admin'] },
    { id: 13, parentId: 10, title: '课程管理', path: '/admin/course', component: 'admin/CourseManage', icon: 'Reading', sort: 3, hidden: false, roles: ['admin'] },
    { id: 14, parentId: 10, title: '公告管理', path: '/admin/notice', component: 'admin/NoticeManage', icon: 'Bell', sort: 4, hidden: false, roles: ['admin'] },
    { id: 15, parentId: 10, title: '菜单权限', path: '/admin/menu', component: 'admin/MenuManage', icon: 'Menu', sort: 5, hidden: false, roles: ['admin'] },

    { id: 20, parentId: 0, title: '教学管理', path: '/teacher', component: '', icon: 'Notebook', sort: 3, hidden: false, roles: ['teacher'] },
    { id: 21, parentId: 20, title: '我的课程', path: '/teacher/course', component: 'teacher/MyCourse', icon: 'Collection', sort: 1, hidden: false, roles: ['teacher'] },
    { id: 22, parentId: 20, title: '成绩管理', path: '/teacher/score', component: 'teacher/ScoreManage', icon: 'EditPen', sort: 2, hidden: false, roles: ['teacher'] },
    { id: 23, parentId: 20, title: '考勤管理', path: '/teacher/attendance', component: 'teacher/AttendanceManage', icon: 'Calendar', sort: 3, hidden: false, roles: ['teacher'] },
    { id: 24, parentId: 20, title: '教务公告', path: '/teacher/notice', component: 'common/NoticeBoard', icon: 'ChatLineSquare', sort: 4, hidden: false, roles: ['teacher'] },

    { id: 30, parentId: 0, title: '学习中心', path: '/student', component: '', icon: 'Management', sort: 4, hidden: false, roles: ['student'] },
    { id: 31, parentId: 30, title: '我的课表', path: '/student/timetable', component: 'student/Timetable', icon: 'Grid', sort: 1, hidden: false, roles: ['student'] },
    { id: 32, parentId: 30, title: '成绩查询', path: '/student/score', component: 'student/MyScore', icon: 'Trophy', sort: 2, hidden: false, roles: ['student'] },
    { id: 33, parentId: 30, title: '考勤查询', path: '/student/attendance', component: 'student/MyAttendance', icon: 'Clock', sort: 3, hidden: false, roles: ['student'] },
    { id: 34, parentId: 30, title: '公告浏览', path: '/student/notice', component: 'common/NoticeBoard', icon: 'ChatLineSquare', sort: 4, hidden: false, roles: ['student'] },

    { id: 90, parentId: 0, title: '个人中心', path: '/profile', component: 'common/Profile', icon: 'Avatar', sort: 99, hidden: false, roles: ALL_ROLES }
  ]
}

/** 生成 [min, max] 区间的成绩，偏向中高分 */
const randomScore = (min = 50, max = 99) => {
  const a = Random.integer(min, max)
  const b = Random.integer(min, max)
  return Math.max(a, b)
}

/** 由 yyyy-mm-dd 起，找到第 n 周的周 weekday（1=周一） */
function dateOf(startMonday, week, weekday) {
  const d = new Date(startMonday)
  d.setDate(d.getDate() + (week - 1) * 7 + (weekday - 1))
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function seed() {
  const pwd = encryptPassword(DEFAULT_PASSWORD)
  const now = '2026-09-01 08:00:00'
  const users = []

  // 1. 管理员
  users.push({ id: 1, username: 'admin', name: '系统管理员', password: pwd, role: 'admin', classId: null, dept: '教务处', phone: '13800000000', status: 1, createTime: now })

  // 2. 教师 t001 ~ t008（id 2~9）
  const teacherNames = ['张明', '李华', '王芳', '刘洋', '陈静', '杨帆', '赵磊', '周敏']
  teacherNames.forEach((name, i) => {
    users.push({
      id: i + 2, username: `t00${i + 1}`, name, password: pwd, role: 'teacher', classId: null,
      dept: '信息工程学院', phone: '139' + Random.string('number', 8), status: 1, createTime: now
    })
  })

  // 3. 班级
  const classes = [
    { id: 1, name: '软件技术2401', major: '软件技术', year: 2024, counselorId: 2, status: 1, createTime: now },
    { id: 2, name: '软件技术2402', major: '软件技术', year: 2024, counselorId: 3, status: 1, createTime: now },
    { id: 3, name: '计算机应用2401', major: '计算机应用技术', year: 2024, counselorId: 4, status: 1, createTime: now },
    { id: 4, name: '大数据技术2401', major: '大数据技术', year: 2024, counselorId: 5, status: 1, createTime: now }
  ]

  // 4. 学生 s001 ~ s120，每班 30 人（id 从 100 开始）
  let sid = 100
  classes.forEach((c, ci) => {
    for (let i = 1; i <= 30; i++) {
      const no = ci * 30 + i
      users.push({
        id: sid++, username: 's' + String(no).padStart(3, '0'), name: no === 1 ? '林小雨' : Random.cname(),
        password: pwd, role: 'student', classId: c.id, dept: '信息工程学院',
        phone: '137' + Random.string('number', 8), status: 1, createTime: now
      })
    }
  })

  // 5. 课程：schedule.section 为大节（1~5），weeks 为上课周次
  const s = (weekday, section, location, weeks = '1-16') => ({ weekday, section, location, weeks })
  const cur = '2026-2027-1'
  const prev = '2025-2026-2'
  const courses = [
    { id: 1, code: 'RJ2001', name: 'Vue.js前端框架开发', type: '必修', credit: 4, hours: 64, semester: cur, teacherId: 2, classIds: [1, 2], schedule: [s(1, 1, '实训楼A301'), s(3, 2, '实训楼A301')] },
    { id: 2, code: 'RJ2002', name: 'Java Web应用开发', type: '必修', credit: 4, hours: 64, semester: cur, teacherId: 3, classIds: [1, 2], schedule: [s(2, 1, '实训楼A302'), s(4, 2, '实训楼A302')] },
    { id: 3, code: 'JS2003', name: 'MySQL数据库技术', type: '必修', credit: 3, hours: 48, semester: cur, teacherId: 4, classIds: [1, 2, 3], schedule: [s(1, 3, '实训楼B201')] },
    { id: 4, code: 'JS2004', name: 'Python程序设计', type: '必修', credit: 4, hours: 64, semester: cur, teacherId: 5, classIds: [3, 4], schedule: [s(1, 1, '实训楼B202'), s(3, 2, '实训楼B202')] },
    { id: 5, code: 'GG2005', name: '大学英语', type: '必修', credit: 3, hours: 54, semester: cur, teacherId: 6, classIds: [1, 2, 3, 4], schedule: [s(5, 1, '教学楼C101', '1-18')] },
    { id: 6, code: 'JS2006', name: 'Linux操作系统', type: '必修', credit: 3, hours: 48, semester: cur, teacherId: 7, classIds: [3, 4], schedule: [s(2, 1, '实训楼A303'), s(4, 3, '实训楼A303')] },
    { id: 7, code: 'XX2007', name: 'UI设计基础', type: '选修', credit: 2, hours: 32, semester: cur, teacherId: 8, classIds: [1, 3], schedule: [s(3, 5, '艺术楼C205')] },
    { id: 8, code: 'DS2008', name: '大数据技术导论', type: '必修', credit: 3, hours: 48, semester: cur, teacherId: 9, classIds: [4], schedule: [s(2, 3, '实训楼B301'), s(5, 2, '实训楼B301')] },
    { id: 9, code: 'XX2009', name: '软件测试技术', type: '选修', credit: 2, hours: 32, semester: cur, teacherId: 2, classIds: [2, 4], schedule: [s(4, 4, '实训楼A301')] },
    { id: 10, code: 'XX2010', name: '职业生涯规划', type: '选修', credit: 1, hours: 16, semester: cur, teacherId: 4, classIds: [1, 2, 3, 4], schedule: [s(5, 3, '教学楼C101', '1-8')] },
    { id: 11, code: 'RJ1011', name: 'JavaScript程序设计', type: '必修', credit: 4, hours: 64, semester: prev, teacherId: 2, classIds: [1, 2, 3, 4], schedule: [s(1, 1, '实训楼A301')] },
    { id: 12, code: 'RJ1012', name: 'HTML5与CSS3网页设计', type: '必修', credit: 4, hours: 64, semester: prev, teacherId: 3, classIds: [1, 2, 3, 4], schedule: [s(2, 2, '实训楼A302')] },
    { id: 13, code: 'JS1013', name: '计算机网络基础', type: '必修', credit: 3, hours: 48, semester: prev, teacherId: 7, classIds: [1, 2, 3, 4], schedule: [s(3, 1, '实训楼A303')] },
    { id: 14, code: 'GG1014', name: '高等数学', type: '必修', credit: 4, hours: 64, semester: prev, teacherId: 6, classIds: [1, 2, 3, 4], schedule: [s(4, 1, '教学楼C101')] }
  ]

  // 6. 成绩：上学期课程全部已录入；本学期仅部分课程录入了平时成绩
  const scores = []
  let scoreId = 1
  const studentsOf = (classIds) => users.filter((u) => u.role === 'student' && classIds.includes(u.classId))
  courses.forEach((c) => {
    if (c.semester === prev) {
      studentsOf(c.classIds).forEach((st) => {
        const usual = randomScore(60, 99)
        const final = randomScore(40, 99)
        scores.push({ id: scoreId++, courseId: c.id, studentId: st.id, usual, final, total: Math.round(usual * 0.4 + final * 0.6), semester: c.semester })
      })
    } else if ([3, 5].includes(c.id)) {
      studentsOf(c.classIds).forEach((st) => {
        scores.push({ id: scoreId++, courseId: c.id, studentId: st.id, usual: randomScore(65, 99), final: null, total: null, semester: c.semester })
      })
    }
  })

  // 7. 考勤：本学期每门课的前 5 周、每个班级各一条记录
  const attendance = []
  let attId = 1
  courses.filter((c) => c.semester === cur).forEach((c) => {
    c.classIds.forEach((classId) => {
      for (let week = 1; week <= 5; week++) {
        const records = studentsOf([classId]).map((st) => ({
          studentId: st.id,
          status: Random.pick(['present', 'present', 'present', 'present', 'present', 'present', 'present', 'present', 'late', 'leave', 'absent'])
        }))
        attendance.push({ id: attId++, courseId: c.id, classId, date: dateOf(SEMESTER_START, week, c.schedule[0].weekday), records, createTime: now })
      }
    })
  })

  // 8. 公告
  const notices = [
    { title: '关于2026-2027学年第一学期期中考试安排的通知', type: '考试安排', top: true, publishTime: '2026-10-10 09:00:00',
      content: '各位师生：\n本学期期中考试定于第9周（11月2日—11月6日）进行，具体考场安排请登录教务系统查看。\n请各位任课教师于10月25日前提交试卷，学生请提前做好复习准备，携带学生证参加考试。' },
    { title: '2026年国庆节放假安排', type: '放假通知', top: false, publishTime: '2026-09-25 10:00:00',
      content: '根据学校校历安排，国庆节放假时间为10月1日至10月7日，共7天。10月8日（周四）正常上课。\n假期期间请同学们注意出行安全，按时返校。' },
    { title: '关于开展2026年职业技能竞赛校内选拔赛的通知', type: '教务公告', top: true, publishTime: '2026-10-08 14:30:00',
      content: '为选拔优秀选手参加省级职业院校技能大赛，学校将举办“Web应用软件开发”赛项校内选拔赛。\n报名时间：10月10日—10月20日\n比赛时间：10月30日\n请有意参赛的同学向辅导员报名。' },
    { title: '本学期教材领取通知', type: '通知', top: false, publishTime: '2026-09-05 08:30:00',
      content: '请各班学习委员于9月8日（周二）下午2:00—5:00到图书馆一楼领取本班教材，领取时请核对数量并签字确认。' },
    { title: '关于教师提交本学期教学进度表的通知', type: '教务公告', top: false, publishTime: '2026-09-02 16:00:00',
      content: '请各位任课教师于第2周周五前，将本学期所授课程的教学进度表提交至教务处邮箱。' },
    { title: '实训楼网络设备维护通知', type: '通知', top: false, publishTime: '2026-10-12 11:00:00',
      content: '10月17日（周六）8:00—18:00，实训楼A、B栋将进行网络设备维护，期间机房网络中断，请合理安排时间。' },
    { title: '计算机等级考试报名通知（草稿）', type: '考试安排', top: false, publishTime: '2026-10-13 09:00:00', status: 'hidden',
      content: '报名具体时间待定，本公告暂不公开。' }
  ].map((n, i) => ({
    id: i + 1, status: 'public', authorId: 1, authorName: '系统管理员', readBy: [], replies: [], createTime: n.publishTime, ...n
  }))
  notices[0].replies.push({ id: 1, userId: 2, name: '张明', content: '请问试卷模板在哪里下载？', time: '2026-10-10 10:12:00' })
  notices[0].replies.push({ id: 2, userId: 3, name: '李华', content: '回复 @张明：在教务处网站“下载专区”里。', time: '2026-10-10 10:40:00' })

  // 9. 角色 → 按钮权限
  const adminPerms = PERMISSIONS.slice(0, 5).flatMap((g) => g.items.map((i) => i.code))
  const rolePerms = {
    admin: adminPerms,
    teacher: ['score:edit', 'score:export', 'attendance:edit', 'notice:reply'],
    student: []
  }

  return { version: DB_VERSION, users, classes, courses, scores, attendance, notices, menus: seedMenus(), rolePerms }
}

let db = null

/** 获取数据库（首次调用时从 localStorage 读取，没有则初始化） */
export function getDb() {
  if (db) return db
  try {
    const raw = JSON.parse(localStorage.getItem(DB_KEY))
    if (raw && raw.version === DB_VERSION) db = raw
  } catch {
    db = null
  }
  if (!db) {
    db = seed()
    saveDb()
  }
  return db
}

/** 持久化到 localStorage */
export function saveDb() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch (e) {
    console.warn('模拟数据库保存失败', e)
  }
}

/** 恢复初始演示数据 */
export function resetDb() {
  db = seed()
  saveDb()
}

/** 生成某张表的下一个自增 id */
export function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id), 0) + 1
}
