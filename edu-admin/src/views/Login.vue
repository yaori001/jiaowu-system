<!-- 登录页：全屏校园视频背景 + 登录表单 -->
<template>
  <div class="login-page">
    <!-- 背景视频：静音、循环；加载完成前显示封面图 -->
    <video
      ref="videoRef"
      class="bg-video"
      src="/video/login-bg.mp4"
      poster="/video/login-poster.jpg"
      muted
      loop
      playsinline
      preload="auto"
    ></video>
    <div class="bg-mask"></div>

    <header class="top">
      <img src="/logo.png" alt="辽宁建筑职业学院院徽" class="logo" />
      <div>
        <div class="school">辽宁建筑职业学院</div>
        <div class="system">教务管理系统</div>
      </div>
    </header>

    <main class="main">
      <section class="box">
        <h2>用户登录</h2>

        <!-- 身份切换 -->
        <div class="role-tabs">
          <span
            v-for="r in ROLES"
            :key="r.value"
            :class="{ active: form.role === r.value }"
            @click="form.role = r.value"
          >{{ r.label === '超级管理员' ? '管理员' : r.label }}</span>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleLogin">
          <el-form-item prop="username">
            <el-input v-model.trim="form.username" :placeholder="placeholder" :prefix-icon="User" clearable />
          </el-form-item>
          <el-form-item prop="password">
            <el-input v-model="form.password" type="password" placeholder="密码" :prefix-icon="Lock" show-password />
          </el-form-item>
          <div class="options">
            <el-checkbox v-model="remember">记住账号</el-checkbox>
            <span class="tip">忘记密码请联系教务处</span>
          </div>
          <el-button type="primary" class="submit" :loading="loading" @click="handleLogin">登 录</el-button>
        </el-form>

        <p class="demo">
          演示账号：
          <a v-for="d in demos" :key="d.role" @click="fillDemo(d)">{{ d.username }}</a>
          <span>（密码 123456）</span>
        </p>
      </section>
    </main>

    <footer class="footer">
      <span>© 2026 辽宁建筑职业学院 教务处</span>
      <span class="sep">|</span>
      <span>建议使用 Chrome、Edge 浏览器访问</span>
      <a class="video-toggle" @click="toggleVideo">{{ playing ? '暂停背景视频' : '播放背景视频' }}</a>
    </footer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { ROLES } from '@/utils/constants'
import { usernameRule, passwordRule } from '@/utils/validate'
import { storage } from '@/utils/storage'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// ---------- 背景视频 ----------
const videoRef = ref()
const playing = ref(false)

onMounted(() => {
  // 系统设置了“减少动态效果”时不自动播放，只显示封面
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  videoRef.value.play().then(() => (playing.value = true)).catch(() => {})
})

function toggleVideo() {
  const v = videoRef.value
  if (v.paused) v.play().then(() => (playing.value = true)).catch(() => {})
  else {
    v.pause()
    playing.value = false
  }
}

// ---------- 登录表单 ----------
const saved = storage.get('remember', null)
const remember = ref(!!saved)
const form = reactive({
  role: saved?.role || 'student',
  username: saved?.username || '',
  password: ''
})

const placeholder = computed(() => ({ admin: '管理员账号', teacher: '教师工号', student: '学号' })[form.role])

const rules = {
  username: usernameRule,
  password: passwordRule
}

const demos = [
  { role: 'admin', username: 'admin' },
  { role: 'teacher', username: 't001' },
  { role: 'student', username: 's001' }
]

function fillDemo(d) {
  Object.assign(form, { role: d.role, username: d.username, password: '123456' })
  formRef.value?.clearValidate()
}

const formRef = ref()
const loading = ref(false)

async function handleLogin() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await userStore.login(form)
    storage.set('remember', remember.value ? { role: form.role, username: form.username } : null)
    router.replace(route.query.redirect || '/')
  } catch {
    // 错误提示已在 axios 拦截器中统一处理
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #fff;
  background: #1a2433 url('/video/login-poster.jpg') center / cover no-repeat;
}
.bg-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
/* 左深右浅的遮罩：保证左上角校名和右侧表单都看得清 */
.bg-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(8, 18, 32, 0.72) 0%, rgba(8, 18, 32, 0.45) 55%, rgba(8, 18, 32, 0.6) 100%);
}
.top, .main, .footer { position: relative; z-index: 1; }

.top { display: flex; align-items: center; gap: 14px; padding: 28px 48px; }
.logo { width: 56px; height: 56px; }
.school {
  font-family: 'STZhongsong', 'STSong', 'SimSun', 'Noto Serif SC', serif;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 4px;
}
.system { font-size: 14px; letter-spacing: 6px; opacity: 0.85; margin-top: 2px; }

.main { flex: 1; display: flex; align-items: center; justify-content: flex-end; padding: 24px 10vw; }
.box {
  width: 380px;
  max-width: 100%;
  padding: 32px 32px 24px;
  background: #fff;
  color: #303133;
  border-radius: 4px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}
.box h2 { margin: 0 0 20px; font-size: 20px; font-weight: 600; }

.role-tabs { display: flex; border-bottom: 1px solid #e4e7ed; margin-bottom: 22px; }
.role-tabs span {
  flex: 1;
  text-align: center;
  padding: 0 0 10px;
  cursor: pointer;
  color: #606266;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.role-tabs span.active { color: var(--el-color-primary); border-bottom-color: var(--el-color-primary); font-weight: 600; }

.options { display: flex; justify-content: space-between; align-items: center; margin: -6px 0 16px; }
.tip { font-size: 13px; color: #909399; }
.submit { width: 100%; letter-spacing: 4px; }

.demo { margin: 18px 0 0; font-size: 12px; color: #909399; }
.demo a { color: var(--el-color-primary); cursor: pointer; margin-right: 8px; }
.demo a:hover { text-decoration: underline; }

.footer { padding: 16px 48px; font-size: 12px; opacity: 0.75; display: flex; gap: 10px; flex-wrap: wrap; }
.sep { opacity: 0.5; }
.video-toggle { margin-left: auto; cursor: pointer; color: #fff; }
.video-toggle:hover { text-decoration: underline; }

@media (max-width: 768px) {
  .top { padding: 20px 16px; }
  .school { font-size: 20px; letter-spacing: 2px; }
  .main { justify-content: center; padding: 16px; }
  .footer { padding: 12px 16px; }
}
</style>
