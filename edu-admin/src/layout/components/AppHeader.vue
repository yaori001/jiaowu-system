<!-- 顶部导航：折叠按钮、面包屑、公告提醒、主题切换、用户菜单 -->
<template>
  <el-header class="header">
    <div class="left">
      <el-icon class="trigger" @click="app.collapsed = !app.collapsed">
        <Expand v-if="app.collapsed" /><Fold v-else />
      </el-icon>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
        <el-breadcrumb-item v-if="route.meta.parentTitle">{{ route.meta.parentTitle }}</el-breadcrumb-item>
        <el-breadcrumb-item v-if="route.meta.title && route.path !== '/dashboard'">{{ route.meta.title }}</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="right">
      <el-tooltip v-if="userStore.role === 'admin'" content="恢复初始演示数据">
        <el-button text circle :icon="RefreshLeft" @click="handleReset" />
      </el-tooltip>

      <el-tooltip v-if="noticePath" content="教务公告">
        <el-badge :value="app.unread" :hidden="!app.unread" :max="99" class="bell">
          <el-button text circle :icon="Bell" @click="router.push(noticePath)" />
        </el-badge>
      </el-tooltip>

      <el-tooltip :content="app.dark ? '切换到亮色模式' : '切换到暗黑模式'">
        <el-button text circle :icon="app.dark ? Sunny : Moon" @click="app.dark = !app.dark" />
      </el-tooltip>

      <el-dropdown trigger="click" @command="handleCommand">
        <div class="user">
          <el-avatar :size="32" class="avatar">{{ userStore.user?.name?.slice(-2) }}</el-avatar>
          <span class="name">{{ userStore.user?.name }}</span>
          <el-tag size="small" :type="roleTag(userStore.role)">{{ roleLabel(userStore.role) }}</el-tag>
          <el-icon><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile" :icon="User">个人中心</el-dropdown-item>
            <el-dropdown-item command="logout" :icon="SwitchButton" divided>退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </el-header>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bell, Moon, Sunny, User, SwitchButton, RefreshLeft } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useMenuStore } from '@/stores/menu'
import { useAppStore } from '@/stores/app'
import { resetSystem } from '@/api/auth'
import { roleLabel, roleTag } from '@/utils/constants'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const menuStore = useMenuStore()
const app = useAppStore()

/** 从菜单中找到“公告浏览”页面的地址（教师、学生才有） */
const noticePath = computed(() => {
  const find = (list) => {
    for (const m of list) {
      if (m.component === 'common/NoticeBoard') return m.path
      const p = m.children && find(m.children)
      if (p) return p
    }
    return null
  }
  return find(menuStore.menus)
})

// 每次切换页面刷新一次未读数
watch(() => route.path, () => noticePath.value && app.refreshUnread(), { immediate: true })

function handleCommand(cmd) {
  if (cmd === 'profile') router.push('/profile')
  if (cmd === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' })
      .then(() => userStore.logout())
      .catch(() => {})
  }
}

async function handleReset() {
  try {
    await ElMessageBox.confirm('将清空所有修改并恢复初始演示数据，确定继续？', '恢复演示数据', { type: 'warning' })
  } catch {
    return // 用户点击了取消
  }
  const res = await resetSystem()
  ElMessage.success(res.msg)
  // 数据已重置，重新登录以加载最新菜单
  userStore.logout()
}
</script>

<style scoped>
.header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.06);
}
.left, .right { display: flex; align-items: center; gap: 12px; }
.right { gap: 4px; }
.trigger { font-size: 20px; cursor: pointer; }
.trigger:hover { color: var(--el-color-primary); }
.bell :deep(.el-badge__content) { top: 6px; right: 10px; }
.user { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 0 8px; margin-left: 8px; outline: none; }
.avatar { background: var(--el-color-primary); font-size: 12px; }
.name { font-weight: 500; }
</style>
