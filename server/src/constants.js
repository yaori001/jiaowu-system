/** 后端共用常量（与前端 utils/constants.js 对齐） */

export const SEMESTERS = ['2026-2027-1', '2025-2026-2', '2025-2026-1']
export const CURRENT_SEMESTER = SEMESTERS[0]
export const SEMESTER_START = '2026-09-07'

/** 综合成绩 = 平时 40% + 期末 60% */
export const calcTotal = (usual, final) => {
  if (usual == null || final == null) return null
  return Math.round(usual * 0.4 + final * 0.6)
}

/** 权限字典（菜单权限页面展示用） */
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

/** 受保护菜单：保证管理员始终能进首页和菜单权限页 */
export const PROTECTED_ADMIN_MENUS = [1, 10, 15]
