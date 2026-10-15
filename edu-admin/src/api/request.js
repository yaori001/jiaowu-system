/**
 * Axios 二次封装
 * - 统一 baseURL、超时时间
 * - 请求拦截：自动携带 token
 * - 响应拦截：统一处理业务错误码和登录过期
 */
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { storage } from '@/utils/storage'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

request.interceptors.request.use((config) => {
  const token = storage.get('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

request.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code === 200) return res // 成功：直接返回 { code, msg, data }

    // 401：登录过期，清除登录状态并回到登录页
    if (res.code === 401) {
      ElMessage.error(res.msg)
      // 动态导入，避免与 store 产生循环依赖
      import('@/stores/user').then(({ useUserStore }) => useUserStore().logout(true))
    } else if (!response.config.silent) {
      ElMessage.error(res.msg || '请求失败')
    }
    return Promise.reject(new Error(res.msg))
  },
  (error) => {
    ElMessage.error(error.message.includes('timeout') ? '请求超时，请稍后再试' : '网络异常：' + error.message)
    return Promise.reject(error)
  }
)

export default request
