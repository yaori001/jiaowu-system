/**
 * 应用界面状态：侧边栏折叠、暗黑模式、未读公告数
 */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { storage } from '@/utils/storage'
import { getUnreadCount } from '@/api/teaching'

export const useAppStore = defineStore('app', () => {
  const collapsed = ref(storage.get('collapsed', false))
  const dark = ref(storage.get('dark', false))
  const unread = ref(0)

  watch(collapsed, (v) => storage.set('collapsed', v))
  watch(dark, (v) => {
    storage.set('dark', v)
    document.documentElement.classList.toggle('dark', v)
  }, { immediate: true })

  async function refreshUnread() {
    try {
      unread.value = (await getUnreadCount()).data
    } catch {
      unread.value = 0
    }
  }

  return { collapsed, dark, unread, refreshUnread }
})
