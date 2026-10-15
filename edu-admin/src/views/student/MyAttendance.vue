<!-- 学生 - 考勤查询：本学期各课程考勤统计 + 考勤明细筛选 -->
<template>
  <div class="page" v-loading="loading">
    <!-- 总体统计 -->
    <div class="stats">
      <div v-for="s in ATTENDANCE_STATUS" :key="s.value" class="stat">
        <div class="stat-value" :class="s.tag">{{ overall[s.value] }}</div>
        <div class="text-muted">{{ s.label }}（次）</div>
      </div>
      <div class="stat">
        <div class="stat-value">{{ overallRate }}</div>
        <div class="text-muted">总出勤率</div>
      </div>
    </div>

    <el-card shadow="never" header="各课程考勤统计（本学期）">
      <el-table :data="summary" border stripe>
        <el-table-column prop="courseName" label="课程" min-width="160" />
        <el-table-column prop="total" label="考勤次数" width="90" align="center" />
        <el-table-column label="出勤" width="80" align="center"><template #default="{ row }"><el-text type="success">{{ row.present }}</el-text></template></el-table-column>
        <el-table-column label="迟到" width="80" align="center"><template #default="{ row }"><el-text type="warning">{{ row.late }}</el-text></template></el-table-column>
        <el-table-column label="早退" width="80" align="center"><template #default="{ row }"><el-text type="info">{{ row.leave }}</el-text></template></el-table-column>
        <el-table-column label="缺勤" width="80" align="center"><template #default="{ row }"><el-text type="danger">{{ row.absent }}</el-text></template></el-table-column>
        <el-table-column label="出勤率" min-width="180">
          <template #default="{ row }">
            <el-progress
              v-if="row.total"
              :percentage="Math.round((row.present / row.total) * 100)"
              :status="row.present / row.total < 0.8 ? 'exception' : 'success'"
            />
            <span v-else class="text-muted">暂无考勤</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="!row.total" @click="filterCourse(row.courseId)">查看明细</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never" header="考勤明细">
      <el-form inline class="search-bar filter">
        <el-form-item label="课程">
          <el-select v-model="query.courseId" placeholder="全部课程" clearable style="width: 200px">
            <el-option v-for="c in summary" :key="c.courseId" :label="c.courseName" :value="c.courseId" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 120px">
            <el-option v-for="s in ATTENDANCE_STATUS" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-table :data="pagedDetails" border stripe>
        <el-table-column prop="date" label="日期" width="130" />
        <el-table-column label="星期" width="80"><template #default="{ row }">{{ weekdayOf(row.date) }}</template></el-table-column>
        <el-table-column prop="courseName" label="课程" min-width="160" />
        <el-table-column prop="teacherName" label="任课教师" width="110" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="attendanceTag(row.status)">{{ attendanceLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination v-model:current-page="page" :page-size="10" :total="filteredDetails.length" layout="total, prev, pager, next" background />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import dayjs from 'dayjs'
import { getMyAttendance } from '@/api/teaching'
import { ATTENDANCE_STATUS, attendanceLabel, attendanceTag, WEEKDAYS } from '@/utils/constants'

const loading = ref(false)
const summary = ref([])
const details = ref([])

onMounted(async () => {
  loading.value = true
  try {
    const res = await getMyAttendance()
    summary.value = res.data.summary
    details.value = res.data.list
  } finally {
    loading.value = false
  }
})

const overall = computed(() => {
  const c = { present: 0, late: 0, leave: 0, absent: 0 }
  details.value.forEach((d) => c[d.status]++)
  return c
})
const overallRate = computed(() =>
  details.value.length ? `${Math.round((overall.value.present / details.value.length) * 100)}%` : '-'
)

// ---------- 明细筛选（数据量小，直接在前端筛选和分页） ----------
const query = reactive({ courseId: '', status: '' })
const page = ref(1)
const filteredDetails = computed(() =>
  details.value
    .filter((d) => !query.courseId || d.courseId === query.courseId)
    .filter((d) => !query.status || d.status === query.status)
)
const pagedDetails = computed(() => filteredDetails.value.slice((page.value - 1) * 10, page.value * 10))
watch(query, () => (page.value = 1))

const filterCourse = (id) => {
  query.courseId = id
  query.status = ''
}
const weekdayOf = (date) => WEEKDAYS[(dayjs(date).day() + 6) % 7]
</script>

<style scoped>
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.stat { background: var(--el-bg-color); border: 1px solid var(--el-border-color-light); border-radius: 6px; padding: 16px; text-align: center; }
.stat-value { font-size: 26px; font-weight: 600; margin-bottom: 4px; }
.stat-value.success { color: var(--el-color-success); }
.stat-value.warning { color: var(--el-color-warning); }
.stat-value.info { color: var(--el-color-info); }
.stat-value.danger { color: var(--el-color-danger); }
.filter { margin-bottom: 12px; }
</style>
