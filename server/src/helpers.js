/** 路由共用的查询与组装工具 */
import { query } from './db.js'

/** 扁平菜单 → 树形 */
export function buildTree(list, parentId = 0) {
  return list
    .filter((m) => m.parentId === parentId)
    .sort((a, b) => a.sort - b.sort)
    .map((m) => {
      const children = buildTree(list, m.id)
      return children.length ? { ...m, children } : { ...m }
    })
}

/** 取某角色可访问的菜单（扁平，含 roles 数组） */
export async function menusForRole(role) {
  const rows = await query(
    `SELECT m.*, GROUP_CONCAT(mr2.role) AS roles
     FROM menus m
     JOIN menu_role mr ON mr.menu_id = m.id AND mr.role = ?
     LEFT JOIN menu_role mr2 ON mr2.menu_id = m.id
     GROUP BY m.id`,
    [role]
  )
  return rows.map(normalizeMenu)
}

/** 取全部菜单（扁平，含 roles 数组） */
export async function allMenus() {
  const rows = await query(
    `SELECT m.*, GROUP_CONCAT(mr.role) AS roles
     FROM menus m LEFT JOIN menu_role mr ON mr.menu_id = m.id
     GROUP BY m.id`
  )
  return rows.map(normalizeMenu)
}

function normalizeMenu(m) {
  return {
    id: m.id, parentId: m.parent_id, title: m.title, path: m.path,
    component: m.component, icon: m.icon, sort: m.sort, hidden: !!m.hidden,
    roles: m.roles ? m.roles.split(',') : []
  }
}

/** 某角色的按钮权限码数组 */
export async function permsForRole(role) {
  const rows = await query('SELECT perm FROM role_perm WHERE role = ?', [role])
  return rows.map((r) => r.perm)
}

/** 班级 id → 名称映射 */
export async function classNameMap() {
  const rows = await query('SELECT id, name FROM classes')
  return Object.fromEntries(rows.map((r) => [r.id, r.name]))
}

/** 用户 id → 姓名映射 */
export async function userNameMap() {
  const rows = await query('SELECT id, name FROM users')
  return Object.fromEntries(rows.map((r) => [r.id, r.name]))
}

/** 模糊查询辅助：生成 LIKE 条件（返回 { clause, params }） */
export const likeClause = (keyword, ...fields) => {
  if (!keyword) return { clause: '1=1', params: [] }
  return {
    clause: '(' + fields.map((f) => `${f} LIKE ?`).join(' OR ') + ')',
    params: fields.map(() => `%${keyword}%`)
  }
}
