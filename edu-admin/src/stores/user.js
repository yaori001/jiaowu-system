/**
 * 用户状态：token、用户信息、登录时间
 * 持久化到 localStorage，刷新页面后保持登录状态
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import router from '@/router'
import { storage } from '@/utils/storage'
import { encryptPassword } from '@/utils/crypto'
import * as authApi from '@/api/auth'
import { useMenuStore } from './menu'

export const useUserStore = defineStore('user', () => {
  const token = ref(storage.get('token', ''))
  const user = ref(storage.get('user', null))
  const loginTime = ref(storage.get('loginTime', ''))

  const role = computed(() => user.value?.role || '')
  const isLogin = computed(() => !!token.value)

  function setUser(u) {
    user.value = u
    storage.set('user', u)
  }

  /** 登录：密码先加密再提交 */
  async function login({ username, password, role }) {
    const res = await authApi.login({ username, password: encryptPassword(password), role })
    token.value = res.data.token
    loginTime.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
    storage.set('token', token.value)
    storage.set('loginTime', loginTime.value)
    setUser(res.data.user)
    return res
  }

  /** 清除本地登录信息和动态路由 */
  function clear() {
    token.value = ''
    user.value = null
    loginTime.value = ''
    storage.remove('token')
    storage.remove('user')
    storage.remove('loginTime')
    useMenuStore().reset()
  }

  /**
   * 退出登录
   * @param {boolean} expired 是否为登录过期（过期时无需再调用退出接口）
   */
  async function logout(expired = false) {
    if (!expired) await authApi.logout().catch(() => {})
    const redirect = router.currentRoute.value.fullPath
    clear()
    router.replace(expired && redirect !== '/login' ? { path: '/login', query: { redirect } } : '/login')
  }

  return { token, user, loginTime, role, isLogin, setUser, login, logout, clear }
})
