<!-- 递归菜单项：有子菜单渲染 el-sub-menu，否则渲染 el-menu-item -->
<template>
  <template v-if="!item.hidden">
    <el-sub-menu v-if="visibleChildren.length" :index="item.path">
      <template #title>
        <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
        <span>{{ item.title }}</span>
      </template>
      <MenuItem v-for="child in visibleChildren" :key="child.id" :item="child" />
    </el-sub-menu>
    <el-menu-item v-else-if="item.component" :index="item.path">
      <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
      <template #title>{{ item.title }}</template>
    </el-menu-item>
  </template>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'MenuItem' })
const props = defineProps({ item: { type: Object, required: true } })
const visibleChildren = computed(() => (props.item.children || []).filter((c) => !c.hidden))
</script>
