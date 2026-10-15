<!-- 学生 - 成绩查询：按学期/课程筛选，成绩统计、可视化图表、成绩详情 -->
<template>
  <div class="page">
    <el-card shadow="never" class="search-bar">
      <el-form inline>
        <el-form-item label="学期">
          <el-select v-model="query.semester" placeholder="全部学期" clearable style="width: 150px" @change="onSemesterChange">
            <el-option v-for="s in SEMESTERS" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="课程">
          <el-select v-model="query.courseId" placeholder="全部课程" clearable filterable style="width: 200px" @change="load">
            <el-option v-for="c in courseOptions" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 统计 -->
    <div class="stats">
      <div v-for="s in stats" :key="s.label" class="stat">
        <div class="stat-value" :style="{ color: s.color }">{{ s.value }}</div>
        <div class="text-muted">{{ s.label }}</div>
      </div>
    </div>

    <el-row :gutter="16" class="row">
      <el-col :xs="24" :lg="14">
        <el-card shadow="never" header="成绩明细">
          <el-table v-loading="loading" :data="list" border stripe @row-click="(row) => (detail = row)" class="clickable">
            <el-table-column prop="semester" label="学期" width="120" />
            <el-table-column prop="courseName" label="课程" min-width="150" show-overflow-tooltip />
            <el-table-column prop="credit" label="学分" width="60" align="center" />
            <el-table-column label="平时" width="65" align="center"><template #default="{ row }">{{ row.usual ?? '-' }}</template></el-table-column>
            <el-table-column label="期末" width="65" align="center"><template #default="{ row }">{{ row.final ?? '-' }}</template></el-table-column>
            <el-table-column label="综合" width="70" align="center">
              <template #default="{ row }">
                <b v-if="row.total !== null" :class="{ fail: row.total < 60 }">{{ row.total }}</b>
                <el-tag v-else size="small" type="info">待出分</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="10">
        <el-card shadow="never" header="成绩分布">
          <EChart v-if="chartData.length" :option="chartOption" height="360px" />
          <el-empty v-else description="暂无已出分的课程" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 详情 -->
    <el-dialog :model-value="!!detail" title="成绩详情" width="480px" @close="detail = null">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="课程" :span="2">{{ detail.courseName }}（{{ detail.courseCode }}）</el-descriptions-item>
        <el-descriptions-item label="学期">{{ detail.semester }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ detail.courseType }}</el-descriptions-item>
        <el-descriptions-item label="学分">{{ detail.credit }}</el-descriptions-item>
        <el-descriptions-item label="授课教师">{{ detail.teacherName }}</el-descriptions-item>
        <el-descriptions-item label="平时成绩">{{ detail.usual ?? '未录入' }}</el-descriptions-item>
        <el-descriptions-item label="期末成绩">{{ detail.final ?? '未录入' }}</el-descriptions-item>
        <el-descriptions-item label="综合成绩">{{ detail.total ?? '待出分' }}</el-descriptions-item>
        <el-descriptions-item label="绩点">{{ detail.total !== null ? gpaOf(detail.total).toFixed(1) : '-' }}</el-descriptions-item>
      </el-descriptions>
      <p class="text-muted">综合成绩 = 平时 × 40% + 期末 × 60%；绩点 = (综合成绩 − 50) ÷ 10，不及格为 0。</p>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { getMyScores } from '@/api/teaching'
import { useAppStore } from '@/stores/app'
import { SEMESTERS } from '@/utils/constants'
import EChart from '@/components/EChart.vue'

const app = useAppStore()
const query = reactive({ semester: '', courseId: '' })
const list = ref([])
const courseOptions = ref([])
const loading = ref(false)
const detail = ref(null)

async function load() {
  loading.value = true
  try {
    const res = await getMyScores(query)
    list.value = res.data.list
    courseOptions.value = res.data.courses
  } finally {
    loading.value = false
  }
}
const onSemesterChange = () => {
  query.courseId = ''
  load()
}
onMounted(load)

const gpaOf = (t) => (t >= 60 ? (t - 50) / 10 : 0)

const stats = computed(() => {
  const done = list.value.filter((s) => s.total !== null)
  const credits = done.reduce((sum, s) => sum + s.credit, 0)
  const avg = done.length ? (done.reduce((s, x) => s + x.total, 0) / done.length).toFixed(1) : '-'
  // 学分加权平均绩点
  const gpa = credits ? (done.reduce((s, x) => s + gpaOf(x.total) * x.credit, 0) / credits).toFixed(2) : '-'
  const failed = done.filter((s) => s.total < 60).length
  return [
    { label: '课程数', value: list.value.length },
    { label: '平均成绩', value: avg, color: 'var(--el-color-primary)' },
    { label: '平均绩点', value: gpa, color: 'var(--el-color-success)' },
    { label: '已获学分', value: done.filter((s) => s.total >= 60).reduce((sum, s) => sum + s.credit, 0) },
    { label: '不及格', value: failed, color: failed ? 'var(--el-color-danger)' : '' }
  ]
})

const chartData = computed(() => list.value.filter((s) => s.total !== null))
const chartOption = computed(() => {
  const color = app.dark ? '#cfd3dc' : '#606266'
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 110, right: 40, top: 10, bottom: 30 },
    xAxis: { type: 'value', min: 0, max: 100, axisLabel: { color } },
    yAxis: { type: 'category', data: chartData.value.map((s) => s.courseName), axisLabel: { color, width: 100, overflow: 'truncate' } },
    series: [{
      type: 'bar',
      barMaxWidth: 22,
      data: chartData.value.map((s) => ({
        value: s.total,
        itemStyle: { color: s.total >= 90 ? '#67c23a' : s.total >= 60 ? '#409eff' : '#f56c6c', borderRadius: [0, 4, 4, 0] }
      })),
      label: { show: true, position: 'right', color },
      markLine: { symbol: 'none', data: [{ xAxis: 60, label: { formatter: '及格线' } }], lineStyle: { color: '#f56c6c', type: 'dashed' } }
    }]
  }
})
</script>

<style scoped>
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.stat { background: var(--el-bg-color); border: 1px solid var(--el-border-color-light); border-radius: 6px; padding: 16px; text-align: center; }
.stat-value { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
.row { row-gap: 16px; }
.fail { color: var(--el-color-danger); }
.clickable :deep(tr) { cursor: pointer; }
</style>
