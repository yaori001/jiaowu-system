/**
 * localStorage 封装：统一加前缀、自动 JSON 序列化，读写异常时不让页面崩溃
 */
const PREFIX = 'edu_'

export const storage = {
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw === null ? defaultValue : JSON.parse(raw)
    } catch {
      return defaultValue
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch (e) {
      console.warn('localStorage 写入失败', e)
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key)
    } catch {
      /* 忽略 */
    }
  }
}
