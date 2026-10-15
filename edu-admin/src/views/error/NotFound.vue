<template>
  <div class="wrap">
    <el-result icon="error" title="404" sub-title="您访问的页面不存在">
      <template #extra>
        <el-button type="primary" @click="$router.replace('/')">返回首页</el-button>
      </template>
    </el-result>
  </div>
</template>

<style scoped>
.wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
</style>
