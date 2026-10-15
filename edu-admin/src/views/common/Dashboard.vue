<!-- 首页仪表盘：欢迎信息 + 统计卡片 + 图表 + 待办事项（不同角色展示不同数据） -->
<template>
  <div class="page" v-loading="loading">
    <!-- 欢迎栏 -->
    <el-card shadow="never">
      <div class="welcome">
        <el-avatar :size="56" class="avatar">{{ user?.name?.slice(-2) }}</el-avatar>
        <div class="info">
          <h2>{{ greeting }}，{{ user?.name }}</h2>
          <p class="text-muted">
            {{ roleLabel(user?.role) }} · {{ user?.dept }}
            <template v-if="user?.role === 'student'"> · 账号 {{ user?.username }}</template>
            · 本次登录时间：{{ userStore.loginTime }}
          </p>
        </div>
        <div class="today text-muted">{{ today }}</div>
      </div>
    </el-card>

    <!-- 统计卡片 -->
    <div class="cards">
      <el-card v-for="c in data.cards" :key="c.label" shadow="hover" class="stat">
        <div class="stat-icon" :style="{ background: c.color }">
          <el-icon :size="26"><component :is="c.icon" /></el-icon>
        </div>
        <div>
          <div class="stat-value">{{ c.value }}</div>
          <div class="text-muted">
            {{ c.label }}
            <el-tooltip v-if="c.tip" :content="c.tip"><el-icon><QuestionFilled /></el-icon></el-tooltip>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 图表 -->
    <el-row :gutter="16">
      <el-col :xs="24" :md="10">
        <el-card shadow="never" :header="data.pie?.title">
          <EChart v-if="data.pie?.data.length" :option="pieOption" />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="14">
        <el-card shadow="never" :header="data.bar?.title">
          <EChart v-if="data.bar?.x.length" :option="barOption" />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 待办事项 -->
    <el-card shadow="never" header="待办事项">
      <el-empty v-if="!data.todos?.length" description="暂无待办事项" :image-size="60" />
      <div v-for="(t, i) in data.todos" :key="i" class="todo">
        <el-icon color="var(--el-color-warning)"><Warning /></el-icon>{{ t }}
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'
import { getDashboard } from '@/api/auth'
import { roleLabel } from '@/utils/constants'
import EChart from '@/components/EChart.vue'

const userStore = useUserStore()
const app = useAppStore()
const user = computed(() => userStore.user)
const today = dayjs().format('YYYY年M月D日 dddd')

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 13) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const loading = ref(false)
const data = ref({ cards: [], todos: [] })

onMounted(async () => {
  loading.value = true
  try {
    data.value = (await getDashboard()).data
  } finally {
    loading.value = false
  }
})

const textColor = computed(() => (app.dark ? '#cfd3dc' : '#606266'))

const pieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}：{c}（{d}%）' },
  legend: { type: 'scroll', bottom: 0, textStyle: { color: textColor.value } },
  series: [{
    type: 'pie',
    radius: ['40%', '68%'],
    center: ['50%', '45%'],
    itemStyle: { borderRadius: 6, borderColor: app.dark ? '#1d1e1f' : '#fff', borderWidth: 2 },
    label: { show: false },
    emphasis: { label: { show: true, fontWeight: 'bold' } },
    data: data.value.pie.data
  }]
}))

const barOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 20, top: 30, bottom: 60 },
  xAxis: { type: 'category', data: data.value.bar.x, axisLabel: { interval: 0, rotate: data.value.bar.x.length > 4 ? 25 : 0, color: textColor.value } },
  yAxis: { type: 'value', axisLabel: { color: textColor.value } },
  series: [{
    type: 'bar',
    barMaxWidth: 40,
    data: data.value.bar.y,
    label: { show: true, position: 'top', color: textColor.value },
    itemStyle: { borderRadius: [6, 6, 0, 0], color: '#409eff' }
  }]
}))
</script>

<style scoped>
.welcome { display: flex; align-items: center; gap: 16px; }
.avatar { background: var(--el-color-primary); font-size: 18px; flex-shrink: 0; }
.info { flex: 1; }
.info h2 { margin: 0 0 6px; font-size: 20px; }
.info p { margin: 0; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
.el-row { row-gap: 16px; }
.stat :deep(.el-card__body) { display: flex; align-items: center; gap: 16px; }
.stat-icon { width: 52px; height: 52px; border-radius: 10px; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-value { font-size: 26px; font-weight: 600; line-height: 1.2; }
.todo { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px dashed var(--el-border-color); }
.todo:last-child { border-bottom: none; }
@media (max-width: 768px) { .today { display: none; } }
</style>
