<template>
  <el-result icon="warning" title="403" sub-title="抱歉，当前角色无权访问该页面">
    <template #extra>
      <el-button type="primary" @click="$router.replace('/')">返回首页</el-button>
    </template>
  </el-result>
</template>
