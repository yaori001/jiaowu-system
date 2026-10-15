/**
 * 菜单 & 权限状态
 * 登录后从接口获取当前角色的菜单树，再转换成路由动态添加（addRoute）
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import router from '@/router'
import { getMenus } from '@/api/auth'

// 自动收集 views 下的所有页面组件，菜单里的 component 字段与之对应
const views = import.meta.glob('../views/**/*.vue')

export const useMenuStore = defineStore('menu', () => {
  const menus = ref([]) // 侧边栏菜单树
  const perms = ref([]) // 按钮权限码
  const loaded = ref(false) // 动态路由是否已添加
  let removers = [] // addRoute 返回的移除函数

  /** 菜单树 → 路由列表（只有配置了 component 的菜单才生成路由） */
  function toRoutes(list, parent = null) {
    return list.flatMap((m) => {
      const routes = []
      if (m.component) {
        const component = views[`../views/${m.component}.vue`]
        if (component) {
          routes.push({
            path: m.path,
            name: `menu-${m.id}`,
            component,
            meta: { title: m.title, icon: m.icon, parentTitle: parent?.title }
          })
        } else {
          console.warn(`菜单「${m.title}」的组件 ${m.component} 不存在`)
        }
      }
      if (m.children) routes.push(...toRoutes(m.children, m))
      return routes
    })
  }

  async function loadMenus() {
    const res = await getMenus()
    reset()
    menus.value = res.data.menus
    perms.value = res.data.perms
    toRoutes(menus.value).forEach((r) => removers.push(router.addRoute('Layout', r)))
    loaded.value = true
  }

  function reset() {
    removers.forEach((remove) => remove())
    removers = []
    menus.value = []
    perms.value = []
    loaded.value = false
  }

  /** 判断是否拥有某个按钮权限（可传数组，满足其一即可） */
  const hasPerm = (code) => [].concat(code).some((c) => perms.value.includes(c))

  return { menus, perms, loaded, loadMenus, reset, hasPerm }
})
