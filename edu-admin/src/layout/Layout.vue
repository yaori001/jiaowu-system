<!-- 后台整体布局：左侧菜单 + 顶部导航 + 主体内容 -->
<template>
  <el-container class="layout">
    <!-- 侧边栏 -->
    <el-aside :width="app.collapsed ? '64px' : 'var(--sidebar-width)'" class="aside">
      <div class="logo">
        <img src="/logo.png" alt="院徽" />
        <span v-show="!app.collapsed">辽宁建筑职业学院</span>
      </div>
      <el-scrollbar>
        <el-menu
          :default-active="route.path"
          :collapse="app.collapsed"
          :collapse-transition="false"
          background-color="var(--sidebar-bg)"
          text-color="var(--sidebar-text)"
          active-text-color="#ffffff"
          unique-opened
          router
        >
          <MenuItem v-for="item in menuStore.menus" :key="item.id" :item="item" />
        </el-menu>
      </el-scrollbar>
    </el-aside>

    <el-container direction="vertical" class="right">
      <AppHeader />
      <el-main class="main">
        <router-view v-slot="{ Component, route: r }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" :key="r.path" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useMenuStore } from '@/stores/menu'
import { useAppStore } from '@/stores/app'
import MenuItem from './components/MenuItem.vue'
import AppHeader from './components/AppHeader.vue'

const route = useRoute()
const menuStore = useMenuStore()
const app = useAppStore()
</script>

<style scoped>
.layout { height: 100vh; }
.aside {
  background: var(--sidebar-bg);
  transition: width 0.25s;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.logo {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  white-space: nowrap;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.logo img { width: 30px; height: 30px; }
.aside :deep(.el-menu) { border-right: none; }
.aside :deep(.el-menu-item.is-active) { background: var(--el-color-primary) !important; }
.right { min-width: 0; }
.main { padding: 16px; overflow-x: hidden; }
</style>
