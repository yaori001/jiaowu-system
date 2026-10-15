<!-- 教师 - 成绩管理：按课程/班级筛选学生，录入平时与期末成绩，批量录入，保存与导出 -->
<template>
  <div class="page">
    <el-card shadow="never" class="search-bar">
      <el-form inline>
        <el-form-item label="课程">
          <el-select :model-value="courseId" placeholder="请选择课程" filterable style="width: 260px" @change="(v) => switchFilter({ courseId: v, classId: '' })">
            <el-option-group v-for="g in courseGroups" :key="g.semester" :label="g.semester">
              <el-option v-for="c in g.courses" :key="c.id" :label="c.name" :value="c.id" />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="班级">
          <el-select :model-value="classId" placeholder="全部班级" clearable style="width: 160px" @change="(v) => switchFilter({ classId: v || '' })">
            <el-option v-for="c in currentCourse?.classes || []" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="学生">
          <el-input v-model.trim="keyword" placeholder="姓名 / 学号" clearable style="width: 160px" />
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 成绩统计 -->
    <div v-if="rows.length" class="stats">
      <div v-for="s in stats" :key="s.label" class="stat">
        <div class="stat-value" :style="{ color: s.color }">{{ s.value }}</div>
        <div class="text-muted">{{ s.label }}</div>
      </div>
    </div>

    <el-card shadow="never">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-button v-perm="'score:edit'" type="primary" :icon="Check" :disabled="!dirtyCount" :loading="saving" @click="save">
            保存成绩{{ dirtyCount ? `（${dirtyCount} 条修改）` : '' }}
          </el-button>
          <el-button v-perm="'score:edit'" :icon="Operation" :disabled="!rows.length" @click="batchVisible = true">批量录入</el-button>
          <el-button v-if="dirtyCount" :icon="RefreshLeft" @click="load">撤销修改</el-button>
          <el-button v-perm="'score:export'" type="success" plain :icon="Download" :disabled="!rows.length" @click="handleExport">导出成绩</el-button>
        </div>
        <span class="text-muted">综合成绩 = 平时成绩 × 40% + 期末成绩 × 60%</span>
      </div>

      <el-table v-loading="loading" :data="filteredRows" border stripe max-height="560" :row-class-name="({ row }) => (isDirty(row) ? 'dirty' : '')">
        <el-table-column type="index" label="#" width="55" align="center" />
        <el-table-column prop="username" label="学号" width="100" sortable />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="className" label="班级" min-width="140" />
        <el-table-column label="平时成绩" width="160" align="center">
          <template #default="{ row }">
            <el-input-number v-if="canEdit" v-model="row.usual" :min="0" :max="100" :precision="0" size="small" controls-position="right" :value-on-clear="null" />
            <span v-else>{{ row.usual ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="期末成绩" width="160" align="center">
          <template #default="{ row }">
            <el-input-number v-if="canEdit" v-model="row.final" :min="0" :max="100" :precision="0" size="small" controls-position="right" :value-on-clear="null" />
            <span v-else>{{ row.final ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="综合成绩" width="100" align="center" sortable :sort-method="(a, b) => (totalOf(a) ?? -1) - (totalOf(b) ?? -1)">
          <template #default="{ row }">
            <b :class="{ fail: totalOf(row) !== null && totalOf(row) < 60 }">{{ totalOf(row) ?? '-' }}</b>
          </template>
        </el-table-column>
        <el-table-column label="等级" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="totalOf(row) !== null" :type="gradeOf(totalOf(row)).tag" size="small">{{ gradeOf(totalOf(row)).label }}</el-tag>
            <span v-else class="text-muted">未录入</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!courseId" description="请先选择课程" />
    </el-card>

    <!-- 批量录入 -->
    <el-dialog v-model="batchVisible" title="批量录入成绩" width="440px">
      <el-form label-width="90px">
        <el-form-item label="成绩项">
          <el-radio-group v-model="batch.field">
            <el-radio value="usual">平时成绩</el-radio>
            <el-radio value="final">期末成绩</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="分数">
          <el-input-number v-model="batch.value" :min="0" :max="100" :precision="0" />
        </el-form-item>
        <el-form-item label="应用范围">
          <el-radio-group v-model="batch.scope">
            <el-radio value="empty">仅未录入的学生</el-radio>
            <el-radio value="all">当前列表全部学生</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button type="primary" @click="applyBatch">应用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Operation, Download, RefreshLeft } from '@element-plus/icons-vue'
import { getTeacherCourses, getCourseScores, saveScores } from '@/api/teaching'
import { useMenuStore } from '@/stores/menu'
import { calcTotal } from '@/utils/constants'
import { exportCsv } from '@/utils/export'

const route = useRoute()
const menuStore = useMenuStore()
const canEdit = computed(() => menuStore.hasPerm('score:edit'))

// ---------- 课程筛选 ----------
const courses = ref([])
const courseId = ref(null)
const classId = ref('')
const keyword = ref('')
const currentCourse = computed(() => courses.value.find((c) => c.id === courseId.value))

/** 课程按学期分组，方便下拉选择 */
const courseGroups = computed(() => {
  const map = {}
  courses.value.forEach((c) => (map[c.semester] ||= []).push(c))
  return Object.keys(map).sort().reverse().map((semester) => ({ semester, courses: map[semester] }))
})

// ---------- 成绩数据 ----------
const rows = ref([])
let original = {} // 记录加载时的原始成绩，用于判断哪些行被修改
const loading = ref(false)
const saving = ref(false)

const filteredRows = computed(() =>
  rows.value.filter((r) => !keyword.value || r.name.includes(keyword.value) || r.username.includes(keyword.value))
)
const totalOf = (row) => calcTotal(row.usual, row.final)
const isDirty = (row) => {
  const o = original[row.studentId]
  return o.usual !== row.usual || o.final !== row.final
}
const dirtyCount = computed(() => rows.value.filter(isDirty).length)

const gradeOf = (t) => {
  if (t >= 90) return { label: '优秀', tag: 'success' }
  if (t >= 80) return { label: '良好', tag: 'primary' }
  if (t >= 70) return { label: '中等', tag: 'info' }
  if (t >= 60) return { label: '及格', tag: 'warning' }
  return { label: '不及格', tag: 'danger' }
}

const stats = computed(() => {
  const totals = rows.value.map(totalOf).filter((t) => t !== null)
  const n = totals.length
  const avg = n ? (totals.reduce((s, t) => s + t, 0) / n).toFixed(1) : '-'
  const pass = n ? `${Math.round((totals.filter((t) => t >= 60).length / n) * 100)}%` : '-'
  return [
    { label: '学生人数', value: rows.value.length },
    { label: '已出综合成绩', value: n, color: n < rows.value.length ? 'var(--el-color-warning)' : '' },
    { label: '平均分', value: avg },
    { label: '及格率', value: pass, color: 'var(--el-color-success)' },
    { label: '最高分', value: n ? Math.max(...totals) : '-' },
    { label: '最低分', value: n ? Math.min(...totals) : '-', color: 'var(--el-color-danger)' }
  ]
})

async function load() {
  if (!courseId.value) return
  loading.value = true
  try {
    const res = await getCourseScores({ courseId: courseId.value, classId: classId.value })
    rows.value = res.data
    original = Object.fromEntries(res.data.map((r) => [r.studentId, { usual: r.usual, final: r.final }]))
  } finally {
    loading.value = false
  }
}

/** 切换筛选条件前，若有未保存的修改先确认 */
async function confirmDiscard() {
  if (!dirtyCount.value) return true
  try {
    await ElMessageBox.confirm(`有 ${dirtyCount.value} 条成绩修改尚未保存，确定放弃吗？`, '提示', { type: 'warning' })
    return true
  } catch {
    return false
  }
}

async function switchFilter(change) {
  if (!(await confirmDiscard())) return
  if ('courseId' in change) courseId.value = change.courseId
  classId.value = change.classId
  load()
}

onBeforeRouteLeave(() => confirmDiscard())

onMounted(async () => {
  courses.value = (await getTeacherCourses()).data
  // 从“我的课程”跳转过来时带有 courseId
  const fromQuery = Number(route.query.courseId)
  courseId.value = courses.value.some((c) => c.id === fromQuery) ? fromQuery : courseGroups.value[0]?.courses[0]?.id ?? null
  load()
})

// ---------- 保存 ----------
async function save() {
  const items = rows.value.filter(isDirty).map((r) => ({ studentId: r.studentId, usual: r.usual, final: r.final }))
  saving.value = true
  try {
    const res = await saveScores({ courseId: courseId.value, items })
    ElMessage.success(res.msg)
    await load()
  } finally {
    saving.value = false
  }
}

// ---------- 批量录入 ----------
const batchVisible = ref(false)
const batch = reactive({ field: 'usual', value: 80, scope: 'empty' })

function applyBatch() {
  let n = 0
  filteredRows.value.forEach((r) => {
    if (batch.scope === 'all' || r[batch.field] === null) {
      r[batch.field] = batch.value
      n++
    }
  })
  batchVisible.value = false
  ElMessage.success(`已为 ${n} 名学生填入成绩，记得点击“保存成绩”`)
}

// ---------- 导出 ----------
function handleExport() {
  const c = currentCourse.value
  exportCsv(`${c.name}_成绩单_${c.semester}`, [
    { label: '学号', prop: 'username' },
    { label: '姓名', prop: 'name' },
    { label: '班级', prop: 'className' },
    { label: '平时成绩', prop: 'usual' },
    { label: '期末成绩', prop: 'final' },
    { label: '综合成绩', prop: totalOf },
    { label: '等级', prop: (r) => (totalOf(r) === null ? '' : gradeOf(totalOf(r)).label) }
  ], filteredRows.value)
  ElMessage.success('导出成功')
}
</script>

<style scoped>
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
.stat { background: var(--el-bg-color); border: 1px solid var(--el-border-color-light); border-radius: 6px; padding: 14px; text-align: center; }
.stat-value { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
.fail { color: var(--el-color-danger); }
:deep(.dirty) { --el-table-tr-bg-color: var(--el-color-warning-light-9); }
:deep(.el-table--striped .el-table__body tr.el-table__row--striped.dirty td.el-table__cell) { background: var(--el-color-warning-light-9); }
</style>
