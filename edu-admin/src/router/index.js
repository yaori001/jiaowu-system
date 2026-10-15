/**
 * 路由配置
 * - 静态路由：登录页、布局框架、403、404
 * - 动态路由：登录后根据角色菜单通过 addRoute 添加到 Layout 下（见 stores/menu.js）
 */
import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useMenuStore } from '@/stores/menu'

const routes = [
  { path: '/login', name: 'Login', component: () => import('@/views/Login.vue'), meta: { title: '登录' } },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/layout/Layout.vue'),
    redirect: '/dashboard',
    children: [
      { path: '/403', name: 'Forbidden', component: () => import('@/views/error/Forbidden.vue'), meta: { title: '无权访问' } }
    ]
  },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('@/views/error/NotFound.vue'), meta: { title: '页面不存在' } }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

/** 全局前置守卫：登录校验 + 动态路由加载 */
router.beforeEach(async (to) => {
  const userStore = useUserStore()
  const menuStore = useMenuStore()

  // 1. 访问登录页：已登录则直接进首页
  if (to.path === '/login') return userStore.isLogin ? '/' : true

  // 2. 未登录：拦截到登录页，并记录原本想访问的地址
  if (!userStore.isLogin) return { path: '/login', query: { redirect: to.fullPath } }

  // 3. 已登录但动态路由还没加载（首次进入或刷新页面）
  if (!menuStore.loaded) {
    try {
      await menuStore.loadMenus()
    } catch {
      userStore.clear()
      return '/login'
    }
    // 路由表已变化，需要按路径重新匹配一次
    return { path: to.path, query: to.query, hash: to.hash, replace: true }
  }

  // 4. 访问了角色无权访问的业务页面 → 403
  if (to.name === 'NotFound' && /^\/(admin|teacher|student)(\/|$)/.test(to.path)) return '/403'
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} - 教务管理系统` : '教务管理系统'
})

export default router
