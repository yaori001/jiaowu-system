/**
 * 种子数据：首次启动（users 表为空）时写入演示数据
 * 也用于管理员「恢复演示数据」：先清空全部业务表再重新写入
 */
import { pool, query, queryOne, transaction } from './db.js'
import { encryptPassword, DEFAULT_PASSWORD } from './crypto.js'
import { CURRENT_SEMESTER, SEMESTER_START } from './constants.js'

const NOW = '2026-09-01 08:00:00'
const PWD = encryptPassword(DEFAULT_PASSWORD)
const ALL = ['admin', 'teacher', 'student']

// ---------- 随机工具 ----------
const SURNAMES = '王李张刘陈杨黄赵周吴徐孙马朱胡林郭何高罗郑梁谢宋唐许韩冯邓曹彭'
const GIVEN = '伟芳娜秀英敏静丽强磊军洋勇艳杰娟涛明超秀霞平刚桂香文辉力博雪松'
const cname = () => {
  const s = SURNAMES[Math.floor(Math.random() * SURNAMES.length)]
  const n = Math.random() < 0.5
    ? GIVEN[Math.floor(Math.random() * GIVEN.length)]
    : GIVEN[Math.floor(Math.random() * GIVEN.length)] + GIVEN[Math.floor(Math.random() * GIVEN.length)]
  return s + n
}
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
const randScore = (min = 50, max = 99) => Math.max(randInt(min, max), randInt(min, max))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const phone = (p) => p + String(randInt(0, 99999999)).padStart(8, '0')

/** 由学期第一周周一，推算第 week 周的周 weekday 的日期 */
function dateOf(startMonday, week, weekday) {
  const d = new Date(startMonday + 'T00:00:00')
  d.setDate(d.getDate() + (week - 1) * 7 + (weekday - 1))
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 菜单种子（component 对应前端 src/views 下的路径） */
function menuRows() {
  return [
    [1, 0, '首页', '/dashboard', 'common/Dashboard', 'HomeFilled', 1, 0, ALL],
    [10, 0, '系统管理', '/admin', '', 'Setting', 2, 0, ['admin']],
    [11, 10, '用户管理', '/admin/user', 'admin/UserManage', 'User', 1, 0, ['admin']],
    [12, 10, '班级管理', '/admin/class', 'admin/ClassManage', 'School', 2, 0, ['admin']],
    [13, 10, '课程管理', '/admin/course', 'admin/CourseManage', 'Reading', 3, 0, ['admin']],
    [14, 10, '公告管理', '/admin/notice', 'admin/NoticeManage', 'Bell', 4, 0, ['admin']],
    [15, 10, '菜单权限', '/admin/menu', 'admin/MenuManage', 'Menu', 5, 0, ['admin']],
    [20, 0, '教学管理', '/teacher', '', 'Notebook', 3, 0, ['teacher']],
    [21, 20, '我的课程', '/teacher/course', 'teacher/MyCourse', 'Collection', 1, 0, ['teacher']],
    [22, 20, '成绩管理', '/teacher/score', 'teacher/ScoreManage', 'EditPen', 2, 0, ['teacher']],
    [23, 20, '考勤管理', '/teacher/attendance', 'teacher/AttendanceManage', 'Calendar', 3, 0, ['teacher']],
    [24, 20, '教务公告', '/teacher/notice', 'common/NoticeBoard', 'ChatLineSquare', 4, 0, ['teacher']],
    [30, 0, '学习中心', '/student', '', 'Management', 4, 0, ['student']],
    [31, 30, '我的课表', '/student/timetable', 'student/Timetable', 'Grid', 1, 0, ['student']],
    [32, 30, '成绩查询', '/student/score', 'student/MyScore', 'Trophy', 2, 0, ['student']],
    [33, 30, '考勤查询', '/student/attendance', 'student/MyAttendance', 'Clock', 3, 0, ['student']],
    [34, 30, '公告浏览', '/student/notice', 'common/NoticeBoard', 'ChatLineSquare', 4, 0, ['student']],
    [90, 0, '个人中心', '/profile', 'common/Profile', 'Avatar', 99, 0, ALL]
  ]
}

const TABLES = [
  'attendance_record', 'attendance', 'scores', 'course_schedule', 'course_class',
  'courses', 'notice_reply', 'notice_read', 'notices', 'menu_role', 'role_perm',
  'menus', 'classes', 'users'
]

async function clearAll(conn) {
  await conn.query('SET FOREIGN_KEY_CHECKS = 0')
  for (const t of TABLES) await conn.query(`TRUNCATE TABLE ${t}`)
  await conn.query('SET FOREIGN_KEY_CHECKS = 1')
}

/** 写入全部演示数据 */
export async function seed() {
  await transaction(async (conn) => {
    await clearAll(conn)

    // 1. 用户：管理员
    await conn.query(
      'INSERT INTO users (id, username, name, password, role, class_id, dept, phone, status, create_time) VALUES (?,?,?,?,?,?,?,?,1,?)',
      [1, 'admin', '系统管理员', PWD, 'admin', null, '教务处', '13800000000', NOW]
    )

    // 教师 t001~t008（id 2~9）
    const teacherNames = ['张明', '李华', '王芳', '刘洋', '陈静', '杨帆', '赵磊', '周敏']
    for (let i = 0; i < teacherNames.length; i++) {
      await conn.query(
        'INSERT INTO users (id, username, name, password, role, dept, phone, status, create_time) VALUES (?,?,?,?,?,?,?,1,?)',
        [i + 2, `t00${i + 1}`, teacherNames[i], PWD, 'teacher', '信息工程学院', phone('139'), NOW]
      )
    }

    // 2. 班级
    const classes = [
      [1, '软件技术2401', '软件技术', 2024, 2],
      [2, '软件技术2402', '软件技术', 2024, 3],
      [3, '计算机应用2401', '计算机应用技术', 2024, 4],
      [4, '大数据技术2401', '大数据技术', 2024, 5]
    ]
    for (const [id, name, major, year, counselor] of classes) {
      await conn.query(
        'INSERT INTO classes (id, name, major, year, counselor_id, status, create_time) VALUES (?,?,?,?,?,1,?)',
        [id, name, major, year, counselor, NOW]
      )
    }

    // 3. 学生 s001~s120，每班 30 人（id 从 100 起）
    let sid = 100
    for (let ci = 0; ci < classes.length; ci++) {
      for (let i = 1; i <= 30; i++) {
        const no = ci * 30 + i
        const name = no === 1 ? '林小雨' : cname()
        await conn.query(
          'INSERT INTO users (id, username, name, password, role, class_id, dept, phone, status, create_time) VALUES (?,?,?,?,?,?,?,?,1,?)',
          [sid++, 's' + String(no).padStart(3, '0'), name, PWD, 'student', classes[ci][0], '信息工程学院', phone('137'), NOW]
        )
      }
    }

    // 4. 课程 + 班级关联 + 排课
    const cur = CURRENT_SEMESTER
    const prev = '2025-2026-2'
    // [id, code, name, type, credit, hours, semester, teacherId, classIds, schedule[[weekday,section,location,weeks]]]
    const courses = [
      [1, 'RJ2001', 'Vue.js前端框架开发', '必修', 4, 64, cur, 2, [1, 2], [[1, 1, '实训楼A301', '1-16'], [3, 2, '实训楼A301', '1-16']]],
      [2, 'RJ2002', 'Java Web应用开发', '必修', 4, 64, cur, 3, [1, 2], [[2, 1, '实训楼A302', '1-16'], [4, 2, '实训楼A302', '1-16']]],
      [3, 'JS2003', 'MySQL数据库技术', '必修', 3, 48, cur, 4, [1, 2, 3], [[1, 3, '实训楼B201', '1-16']]],
      [4, 'JS2004', 'Python程序设计', '必修', 4, 64, cur, 5, [3, 4], [[1, 1, '实训楼B202', '1-16'], [3, 2, '实训楼B202', '1-16']]],
      [5, 'GG2005', '大学英语', '必修', 3, 54, cur, 6, [1, 2, 3, 4], [[5, 1, '教学楼C101', '1-18']]],
      [6, 'JS2006', 'Linux操作系统', '必修', 3, 48, cur, 7, [3, 4], [[2, 1, '实训楼A303', '1-16'], [4, 3, '实训楼A303', '1-16']]],
      [7, 'XX2007', 'UI设计基础', '选修', 2, 32, cur, 8, [1, 3], [[3, 5, '艺术楼C205', '1-16']]],
      [8, 'DS2008', '大数据技术导论', '必修', 3, 48, cur, 9, [4], [[2, 3, '实训楼B301', '1-16'], [5, 2, '实训楼B301', '1-16']]],
      [9, 'XX2009', '软件测试技术', '选修', 2, 32, cur, 2, [2, 4], [[4, 4, '实训楼A301', '1-16']]],
      [10, 'XX2010', '职业生涯规划', '选修', 1, 16, cur, 4, [1, 2, 3, 4], [[5, 3, '教学楼C101', '1-8']]],
      [11, 'RJ1011', 'JavaScript程序设计', '必修', 4, 64, prev, 2, [1, 2, 3, 4], [[1, 1, '实训楼A301', '1-16']]],
      [12, 'RJ1012', 'HTML5与CSS3网页设计', '必修', 4, 64, prev, 3, [1, 2, 3, 4], [[2, 2, '实训楼A302', '1-16']]],
      [13, 'JS1013', '计算机网络基础', '必修', 3, 48, prev, 7, [1, 2, 3, 4], [[3, 1, '实训楼A303', '1-16']]],
      [14, 'GG1014', '高等数学', '必修', 4, 64, prev, 6, [1, 2, 3, 4], [[4, 1, '教学楼C101', '1-16']]]
    ]
    for (const [id, code, name, type, credit, hours, semester, teacherId, classIds, schedule] of courses) {
      await conn.query(
        'INSERT INTO courses (id, code, name, type, credit, hours, semester, teacher_id, create_time) VALUES (?,?,?,?,?,?,?,?,?)',
        [id, code, name, type, credit, hours, semester, teacherId, NOW]
      )
      for (const cid of classIds) await conn.query('INSERT INTO course_class (course_id, class_id) VALUES (?,?)', [id, cid])
      for (const [wd, sec, loc, wk] of schedule) {
        await conn.query('INSERT INTO course_schedule (course_id, weekday, section, location, weeks) VALUES (?,?,?,?,?)', [id, wd, sec, loc, wk])
      }
    }

    // 查出各班学生 id，供成绩/考勤使用
    const studentsOf = async (classIds) => {
      const [rows] = await conn.query(
        `SELECT id FROM users WHERE role='student' AND class_id IN (${classIds.map(() => '?').join(',')}) ORDER BY username`,
        classIds
      )
      return rows.map((r) => r.id)
    }

    // 5. 成绩：上学期全部录入；本学期课程 3、5 仅录入平时成绩
    for (const c of courses) {
      const [, , , , , , semester, , classIds] = c
      const ids = await studentsOf(classIds)
      if (semester === prev) {
        for (const stu of ids) {
          const usual = randScore(60, 99)
          const final = randScore(40, 99)
          await conn.query(
            'INSERT INTO scores (course_id, student_id, usual, final, total, semester) VALUES (?,?,?,?,?,?)',
            [c[0], stu, usual, final, Math.round(usual * 0.4 + final * 0.6), semester]
          )
        }
      } else if ([3, 5].includes(c[0])) {
        for (const stu of ids) {
          await conn.query(
            'INSERT INTO scores (course_id, student_id, usual, final, total, semester) VALUES (?,?,?,NULL,NULL,?)',
            [c[0], stu, randScore(65, 99), semester]
          )
        }
      }
    }

    // 6. 考勤：本学期每门课每个班前 5 周各一条
    const statusPool = ['present', 'present', 'present', 'present', 'present', 'present', 'present', 'present', 'late', 'leave', 'absent']
    for (const c of courses) {
      if (c[6] !== cur) continue
      const classIds = c[8]
      const firstWeekday = c[9][0][0]
      for (const classId of classIds) {
        const ids = await studentsOf([classId])
        for (let week = 1; week <= 5; week++) {
          const date = dateOf(SEMESTER_START, week, firstWeekday)
          const [r] = await conn.query(
            'INSERT INTO attendance (course_id, class_id, date, create_time) VALUES (?,?,?,?)',
            [c[0], classId, date, NOW]
          )
          const attId = r.insertId
          for (const stu of ids) {
            await conn.query('INSERT INTO attendance_record (attendance_id, student_id, status) VALUES (?,?,?)', [attId, stu, pick(statusPool)])
          }
        }
      }
    }

    // 7. 公告
    const notices = [
      ['关于2026-2027学年第一学期期中考试安排的通知', '考试安排', 1, '2026-10-10 09:00:00', 'public',
        '各位师生：\n本学期期中考试定于第9周（11月2日—11月6日）进行，具体考场安排请登录教务系统查看。\n请各位任课教师于10月25日前提交试卷，学生请提前做好复习准备，携带学生证参加考试。'],
      ['2026年国庆节放假安排', '放假通知', 0, '2026-09-25 10:00:00', 'public',
        '根据学校校历安排，国庆节放假时间为10月1日至10月7日，共7天。10月8日（周四）正常上课。\n假期期间请同学们注意出行安全，按时返校。'],
      ['关于开展2026年职业技能竞赛校内选拔赛的通知', '教务公告', 1, '2026-10-08 14:30:00', 'public',
        '为选拔优秀选手参加省级职业院校技能大赛，学校将举办“Web应用软件开发”赛项校内选拔赛。\n报名时间：10月10日—10月20日\n比赛时间：10月30日\n请有意参赛的同学向辅导员报名。'],
      ['本学期教材领取通知', '通知', 0, '2026-09-05 08:30:00', 'public',
        '请各班学习委员于9月8日（周二）下午2:00—5:00到图书馆一楼领取本班教材，领取时请核对数量并签字确认。'],
      ['关于教师提交本学期教学进度表的通知', '教务公告', 0, '2026-09-02 16:00:00', 'public',
        '请各位任课教师于第2周周五前，将本学期所授课程的教学进度表提交至教务处邮箱。'],
      ['实训楼网络设备维护通知', '通知', 0, '2026-10-12 11:00:00', 'public',
        '10月17日（周六）8:00—18:00，实训楼A、B栋将进行网络设备维护，期间机房网络中断，请合理安排时间。'],
      ['计算机等级考试报名通知（草稿）', '考试安排', 0, '2026-10-13 09:00:00', 'hidden',
        '报名具体时间待定，本公告暂不公开。']
    ]
    for (const [title, type, top, time, status, content] of notices) {
      await conn.query(
        'INSERT INTO notices (title, type, content, status, top, publish_time, author_id, author_name, create_time) VALUES (?,?,?,?,?,?,1,?,?)',
        [title, type, content, status, top, time, '系统管理员', time]
      )
    }
    // 第一条公告加两条教师留言
    await conn.query('INSERT INTO notice_reply (notice_id, user_id, name, content, time) VALUES (1,2,?,?,?)', ['张明', '请问试卷模板在哪里下载？', '2026-10-10 10:12:00'])
    await conn.query('INSERT INTO notice_reply (notice_id, user_id, name, content, time) VALUES (1,3,?,?,?)', ['李华', '回复 @张明：在教务处网站“下载专区”里。', '2026-10-10 10:40:00'])

    // 8. 菜单 + 角色关联
    for (const [id, parentId, title, path, component, icon, sort, hidden, roles] of menuRows()) {
      await conn.query(
        'INSERT INTO menus (id, parent_id, title, path, component, icon, sort, hidden) VALUES (?,?,?,?,?,?,?,?)',
        [id, parentId, title, path, component, icon, sort, hidden]
      )
      for (const role of roles) await conn.query('INSERT INTO menu_role (menu_id, role) VALUES (?,?)', [id, role])
    }

    // 9. 角色按钮权限
    const adminPerms = ['user:add', 'user:edit', 'user:delete', 'user:status', 'user:reset',
      'class:add', 'class:edit', 'class:delete', 'class:assign', 'course:add', 'course:edit', 'course:delete',
      'notice:add', 'notice:edit', 'notice:delete', 'notice:top', 'menu:add', 'menu:edit', 'menu:delete', 'role:assign']
    const teacherPerms = ['score:edit', 'score:export', 'attendance:edit', 'notice:reply']
    for (const p of adminPerms) await conn.query('INSERT INTO role_perm (role, perm) VALUES (?,?)', ['admin', p])
    for (const p of teacherPerms) await conn.query('INSERT INTO role_perm (role, perm) VALUES (?,?)', ['teacher', p])
  })
  console.log('[seed] 演示数据写入完成')
}

/** 若库为空则自动写入演示数据 */
export async function seedIfEmpty() {
  const row = await queryOne('SELECT COUNT(*) AS n FROM users')
  if (row.n === 0) {
    console.log('[seed] 检测到空库，开始写入演示数据 ...')
    await seed()
  } else {
    console.log(`[seed] 已有 ${row.n} 个用户，跳过初始化`)
  }
}
