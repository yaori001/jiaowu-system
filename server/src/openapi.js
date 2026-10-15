/**
 * OpenAPI 3.0 接口文档定义（通过 swagger-ui-express 展示在 /api-docs）
 * 所有接口统一返回 { code, msg, data }，需登录的接口在右上角 Authorize 填入
 * 登录接口返回的 token 即可在线调试。
 */

// 通用响应包装
const result = (dataSchema = { type: 'object' }) => ({
  type: 'object',
  properties: {
    code: { type: 'integer', example: 200, description: '200 成功，其它为错误码' },
    msg: { type: 'string', example: '操作成功' },
    data: dataSchema
  }
})

const pageParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: '页码' },
  { name: 'size', in: 'query', schema: { type: 'integer', default: 10 }, description: '每页条数' }
]

// 快速定义一个接口
const op = (tag, summary, { params = [], body = null, auth = true } = {}) => {
  const o = { tags: [tag], summary, parameters: params, responses: { 200: { description: '成功', content: { 'application/json': { schema: result() } } } } }
  if (body) o.requestBody = { required: true, content: { 'application/json': { schema: body } } }
  if (auth) o.security = [{ bearerAuth: [] }]
  return o
}

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: '教务管理系统 API',
    version: '1.0.0',
    description:
      '辽宁建筑职业学院 · 教务管理系统后端接口文档。\n\n' +
      '**使用说明**：\n' +
      '1. 先调用「用户登录」接口，密码请填前端 cyrb53 加密后的哈希（演示账号 123456 的哈希为 `4d67691af4dc717744d8f3a1033c6c1c`）。\n' +
      '2. 复制返回的 `data.token`，点右上角 **Authorize**，粘贴后即可调试需要登录的接口。\n' +
      '3. 演示账号：管理员 `admin`，教师 `t001`，学生 `s001`。'
  },
  servers: [
    { url: '/api', description: '当前服务' }
  ],
  tags: [
    { name: '通用', description: '登录、菜单、仪表盘、个人中心（所有角色）' },
    { name: '用户管理', description: '管理员 - 用户' },
    { name: '班级管理', description: '管理员 - 班级' },
    { name: '课程管理', description: '管理员 - 课程' },
    { name: '公告管理', description: '管理员 - 公告' },
    { name: '菜单权限', description: '管理员 - 菜单与角色授权' },
    { name: '教师业务', description: '我的课程、成绩、考勤' },
    { name: '学生业务', description: '课表、成绩、考勤查询' },
    { name: '公告浏览', description: '公告列表、详情、留言（教师/学生）' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: '登录后获得的 token' }
    },
    schemas: {
      LoginBody: {
        type: 'object', required: ['username', 'password', 'role'],
        properties: {
          username: { type: 'string', example: 'admin' },
          password: { type: 'string', example: '4d67691af4dc717744d8f3a1033c6c1c', description: 'cyrb53 加密后的哈希' },
          role: { type: 'string', enum: ['admin', 'teacher', 'student'], example: 'admin' }
        }
      },
      UserBody: {
        type: 'object', required: ['username', 'name', 'role'],
        properties: {
          username: { type: 'string', example: 's121' },
          name: { type: 'string', example: '张三' },
          role: { type: 'string', enum: ['admin', 'teacher', 'student'] },
          password: { type: 'string', description: '可选，cyrb53 哈希；不传则默认 123456' },
          classId: { type: 'integer', description: '学生必填' },
          dept: { type: 'string' },
          phone: { type: 'string' }
        }
      },
      IdsBody: { type: 'object', properties: { ids: { type: 'array', items: { type: 'integer' }, example: [121, 122] } } },
      ClassBody: {
        type: 'object', required: ['name', 'major', 'year'],
        properties: {
          name: { type: 'string', example: '软件技术2501' },
          major: { type: 'string', example: '软件技术' },
          year: { type: 'integer', example: 2025 },
          counselorId: { type: 'integer' },
          status: { type: 'integer', enum: [0, 1], default: 1 }
        }
      },
      CourseBody: {
        type: 'object', required: ['code', 'name', 'type', 'credit', 'hours', 'semester'],
        properties: {
          code: { type: 'string', example: 'RJ2099' },
          name: { type: 'string', example: '小程序开发' },
          type: { type: 'string', enum: ['必修', '选修'] },
          credit: { type: 'number', example: 3 },
          hours: { type: 'integer', example: 48 },
          semester: { type: 'string', example: '2026-2027-1' },
          teacherId: { type: 'integer' },
          classIds: { type: 'array', items: { type: 'integer' }, example: [1, 2] },
          schedule: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                weekday: { type: 'integer', example: 1, description: '1-7' },
                section: { type: 'integer', example: 1, description: '大节 1-5' },
                location: { type: 'string', example: '实训楼A301' },
                weeks: { type: 'string', example: '1-16' }
              }
            }
          }
        }
      },
      NoticeBody: {
        type: 'object', required: ['title', 'type', 'content'],
        properties: {
          title: { type: 'string', example: '关于期末考试安排的通知' },
          type: { type: 'string', example: '考试安排' },
          content: { type: 'string' },
          status: { type: 'string', enum: ['public', 'hidden'], default: 'public' },
          top: { type: 'boolean' },
          publishTime: { type: 'string', example: '2026-10-14 10:00:00' }
        }
      },
      ScoreSaveBody: {
        type: 'object', required: ['courseId', 'items'],
        properties: {
          courseId: { type: 'integer', example: 1 },
          items: {
            type: 'array',
            items: { type: 'object', properties: { studentId: { type: 'integer' }, usual: { type: 'integer', nullable: true }, final: { type: 'integer', nullable: true } } }
          }
        }
      },
      AttendanceBody: {
        type: 'object', required: ['courseId', 'classId', 'date', 'records'],
        properties: {
          courseId: { type: 'integer', example: 1 },
          classId: { type: 'integer', example: 1 },
          date: { type: 'string', example: '2026-09-07' },
          records: {
            type: 'array',
            items: { type: 'object', properties: { studentId: { type: 'integer' }, status: { type: 'string', enum: ['present', 'late', 'leave', 'absent'] } } }
          }
        }
      }
    }
  },
  paths: {
    // ---------- 通用 ----------
    '/login': { post: op('通用', '用户登录（无需 token）', { body: { $ref: '#/components/schemas/LoginBody' }, auth: false }) },
    '/logout': { post: op('通用', '退出登录', { auth: false }) },
    '/user/info': { get: op('通用', '获取当前登录用户信息') },
    '/menus': { get: op('通用', '获取当前角色的菜单树与按钮权限') },
    '/dashboard': { get: op('通用', '首页仪表盘数据（按角色不同）') },
    '/system/reset': { post: op('通用', '恢复演示数据（仅管理员）') },
    '/profile': { put: op('通用', '修改个人资料', { body: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, dept: { type: 'string' } } } }) },
    '/profile/password': { put: op('通用', '修改密码', { body: { type: 'object', properties: { oldPassword: { type: 'string' }, newPassword: { type: 'string' } } } }) },
    '/profile/password/reset': { post: op('通用', '重置自己的密码为 123456') },

    // ---------- 用户管理 ----------
    '/users': {
      get: op('用户管理', '用户列表（分页）', { params: [
        { name: 'keyword', in: 'query', schema: { type: 'string' }, description: '姓名/账号模糊搜索' },
        { name: 'role', in: 'query', schema: { type: 'string', enum: ['admin', 'teacher', 'student'] } },
        { name: 'status', in: 'query', schema: { type: 'integer' } },
        { name: 'classId', in: 'query', schema: { type: 'integer' } },
        ...pageParams
      ] }),
      post: op('用户管理', '新增用户', { body: { $ref: '#/components/schemas/UserBody' } }),
      delete: op('用户管理', '批量删除用户', { body: { $ref: '#/components/schemas/IdsBody' } })
    },
    '/users/options': { get: op('用户管理', '用户下拉选项', { params: [{ name: 'role', in: 'query', schema: { type: 'string' } }] }) },
    '/users/batch': { post: op('用户管理', '批量新增用户', { body: { type: 'object', properties: { users: { type: 'array', items: { $ref: '#/components/schemas/UserBody' } } } } }) },
    '/users/{id}': { put: op('用户管理', '编辑用户', { params: [idParam], body: { $ref: '#/components/schemas/UserBody' } }) },
    '/users/{id}/status': { put: op('用户管理', '启用/禁用用户', { params: [idParam], body: { type: 'object', properties: { status: { type: 'integer', enum: [0, 1] } } } }) },
    '/users/{id}/password': { put: op('用户管理', '重置用户密码为 123456', { params: [idParam] }) },

    // ---------- 班级管理 ----------
    '/classes': {
      get: op('班级管理', '班级列表（分页）', { params: [
        { name: 'keyword', in: 'query', schema: { type: 'string' } },
        { name: 'major', in: 'query', schema: { type: 'string' } },
        { name: 'status', in: 'query', schema: { type: 'integer' } },
        ...pageParams
      ] }),
      post: op('班级管理', '新增班级', { body: { $ref: '#/components/schemas/ClassBody' } }),
      delete: op('班级管理', '批量删除班级', { body: { $ref: '#/components/schemas/IdsBody' } })
    },
    '/classes/options': { get: op('班级管理', '班级下拉选项') },
    '/classes/{id}': { put: op('班级管理', '编辑班级', { params: [idParam], body: { $ref: '#/components/schemas/ClassBody' } }) },
    '/classes/{id}/status': { put: op('班级管理', '启用/停用班级', { params: [idParam], body: { type: 'object', properties: { status: { type: 'integer' } } } }) },
    '/classes/{id}/students': { put: op('班级管理', '批量分配班级学生', { params: [idParam], body: { type: 'object', properties: { studentIds: { type: 'array', items: { type: 'integer' } } } } }) },

    // ---------- 课程管理 ----------
    '/courses': {
      get: op('课程管理', '课程列表（分页）', { params: [
        { name: 'keyword', in: 'query', schema: { type: 'string' } },
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['必修', '选修'] } },
        { name: 'semester', in: 'query', schema: { type: 'string' } },
        { name: 'teacherId', in: 'query', schema: { type: 'integer' } },
        ...pageParams
      ] }),
      post: op('课程管理', '新增课程', { body: { $ref: '#/components/schemas/CourseBody' } }),
      delete: op('课程管理', '批量删除课程', { body: { $ref: '#/components/schemas/IdsBody' } })
    },
    '/courses/{id}': { put: op('课程管理', '编辑课程', { params: [idParam], body: { $ref: '#/components/schemas/CourseBody' } }) },

    // ---------- 公告管理 ----------
    '/notices': {
      get: op('公告管理', '公告列表（分页）', { params: [
        { name: 'keyword', in: 'query', schema: { type: 'string' } },
        { name: 'type', in: 'query', schema: { type: 'string' } },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['public', 'hidden'] } },
        ...pageParams
      ] }),
      post: op('公告管理', '发布公告', { body: { $ref: '#/components/schemas/NoticeBody' } }),
      delete: op('公告管理', '批量删除公告', { body: { $ref: '#/components/schemas/IdsBody' } })
    },
    '/notices/{id}': { put: op('公告管理', '编辑公告', { params: [idParam], body: { $ref: '#/components/schemas/NoticeBody' } }) },
    '/notices/{id}/top': { put: op('公告管理', '置顶/取消置顶', { params: [idParam], body: { type: 'object', properties: { top: { type: 'boolean' } } } }) },

    // ---------- 菜单权限 ----------
    '/menus/all': { get: op('菜单权限', '全部菜单（扁平）') },
    '/menus': { post: op('菜单权限', '新增菜单', { body: { type: 'object', properties: { parentId: { type: 'integer' }, title: { type: 'string' }, path: { type: 'string' }, component: { type: 'string' }, icon: { type: 'string' }, sort: { type: 'integer' }, hidden: { type: 'boolean' }, roles: { type: 'array', items: { type: 'string' } } } } }) },
    '/menus/{id}': { put: op('菜单权限', '编辑菜单', { params: [idParam] }), delete: op('菜单权限', '删除菜单', { params: [idParam] }) },
    '/roles/perms': { get: op('菜单权限', '获取角色授权数据') },
    '/roles/{role}': { put: op('菜单权限', '保存角色授权', { params: [{ name: 'role', in: 'path', required: true, schema: { type: 'string', enum: ['admin', 'teacher', 'student'] } }], body: { type: 'object', properties: { menuIds: { type: 'array', items: { type: 'integer' } }, perms: { type: 'array', items: { type: 'string' } } } } }) },

    // ---------- 教师业务 ----------
    '/teacher/courses': { get: op('教师业务', '我的授课课程', { params: [
      { name: 'keyword', in: 'query', schema: { type: 'string' } },
      { name: 'type', in: 'query', schema: { type: 'string' } },
      { name: 'semester', in: 'query', schema: { type: 'string' } }
    ] }) },
    '/teacher/scores': {
      get: op('教师业务', '课程学生成绩名单', { params: [
        { name: 'courseId', in: 'query', required: true, schema: { type: 'integer' } },
        { name: 'classId', in: 'query', schema: { type: 'integer' } },
        { name: 'keyword', in: 'query', schema: { type: 'string' } }
      ] }),
      post: op('教师业务', '批量保存成绩', { body: { $ref: '#/components/schemas/ScoreSaveBody' } })
    },
    '/teacher/attendance': {
      get: op('教师业务', '某日考勤（含学生名单）', { params: [
        { name: 'courseId', in: 'query', required: true, schema: { type: 'integer' } },
        { name: 'classId', in: 'query', required: true, schema: { type: 'integer' } },
        { name: 'date', in: 'query', required: true, schema: { type: 'string' } }
      ] }),
      post: op('教师业务', '保存考勤', { body: { $ref: '#/components/schemas/AttendanceBody' } })
    },
    '/teacher/attendance/history': { get: op('教师业务', '考勤历史记录（分页）', { params: [
      { name: 'courseId', in: 'query', schema: { type: 'integer' } },
      { name: 'classId', in: 'query', schema: { type: 'integer' } },
      ...pageParams
    ] }) },

    // ---------- 学生业务 ----------
    '/student/timetable': { get: op('学生业务', '我的课表', { params: [{ name: 'semester', in: 'query', schema: { type: 'string' } }] }) },
    '/student/scores': { get: op('学生业务', '我的成绩查询', { params: [
      { name: 'semester', in: 'query', schema: { type: 'string' } },
      { name: 'courseId', in: 'query', schema: { type: 'integer' } }
    ] }) },
    '/student/attendance': { get: op('学生业务', '我的考勤查询', { params: [
      { name: 'courseId', in: 'query', schema: { type: 'integer' } },
      { name: 'status', in: 'query', schema: { type: 'string' } }
    ] }) },

    // ---------- 公告浏览 ----------
    '/board/notices': { get: op('公告浏览', '公告列表', { params: [
      { name: 'keyword', in: 'query', schema: { type: 'string' } },
      { name: 'type', in: 'query', schema: { type: 'string' } },
      { name: 'unread', in: 'query', schema: { type: 'integer' }, description: '1 只看未读' },
      ...pageParams
    ] }) },
    '/board/unread': { get: op('公告浏览', '未读公告数') },
    '/board/notices/{id}': { get: op('公告浏览', '公告详情（含留言）', { params: [idParam] }) },
    '/board/notices/{id}/read': { post: op('公告浏览', '标记公告已读', { params: [idParam] }) },
    '/board/notices/read-all': { post: op('公告浏览', '全部标记已读') },
    '/board/notices/{id}/replies': { post: op('公告浏览', '发表留言', { params: [idParam], body: { type: 'object', properties: { content: { type: 'string' } } } }) },
    '/board/notices/{id}/replies/{rid}': { delete: op('公告浏览', '删除留言', { params: [idParam, { name: 'rid', in: 'path', required: true, schema: { type: 'integer' } }] }) }
  }
}
