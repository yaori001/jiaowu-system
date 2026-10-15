/**
 * 按钮权限指令：v-perm="'user:add'" 或 v-perm="['user:edit', 'user:delete']"
 * 没有权限时直接把元素从页面移除
 */
import { useMenuStore } from '@/stores/menu'

export default {
  mounted(el, binding) {
    if (!useMenuStore().hasPerm(binding.value)) el.parentNode?.removeChild(el)
  }
}
