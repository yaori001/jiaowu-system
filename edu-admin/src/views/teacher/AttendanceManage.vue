<!-- 教师 - 考勤管理：按课程/班级/日期登记考勤，标记出勤状态；查询与修改历史记录 -->
<template>
  <el-card shadow="never">
    <el-tabs v-model="tab">
      <!-- ================= 考勤登记 ================= -->
      <el-tab-pane label="考勤登记" name="register">
        <el-form inline class="search-bar">
          <el-form-item label="课程">
            <el-select v-model="form.courseId" placeholder="请选择课程" style="width: 220px" @change="onCourseChange">
              <el-option v-for="c in courses" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="班级">
            <el-select v-model="form.classId" placeholder="请选择班级" style="width: 160px" @change="loadRecord">
              <el-option v-for="c in currentCourse?.classes || []" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="日期">
            <el-date-picker
              v-model="form.date"
              value-format="YYYY-MM-DD"
              :disabled-date="(d) => d > new Date()"
              :clearable="false"
              style="width: 150px"
              @change="loadRecord"
            />
          </el-form-item>
          <el-form-item>
            <el-tag v-if="exists" type="warning">该日期已有考勤记录，修改后保存将覆盖</el-tag>
            <el-tag v-else-if="students.length" type="success">新考勤，默认全部出勤</el-tag>
          </el-form-item>
        </el-form>

        <div v-if="students.length" class="summary">
          <span v-for="s in ATTENDANCE_STATUS" :key="s.value">
            <el-tag :type="s.tag" effect="plain">{{ s.label }} {{ counts[s.value] }}</el-tag>
          </span>
          <span class="text-muted">出勤率 {{ rate }}</span>
          <div class="spacer"></div>
          <template v-if="canEdit">
            <el-button size="small" @click="setAll('present')">全部出勤</el-button>
            <el-button type="primary" :icon="Check" :loading="saving" @click="save">保存考勤</el-button>
          </template>
        </div>

        <el-table v-loading="loading" :data="students" border stripe max-height="560">
          <el-table-column type="index" label="#" width="55" align="center" />
          <el-table-column prop="username" label="学号" width="110" />
          <el-table-column prop="name" label="姓名" width="120" />
          <el-table-column label="考勤状态" min-width="320">
            <template #default="{ row }">
              <el-radio-group v-model="statusMap[row.id]" :disabled="!canEdit" size="small">
                <el-radio-button v-for="s in ATTENDANCE_STATUS" :key="s.value" :value="s.value">{{ s.label }}</el-radio-button>
              </el-radio-group>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!form.classId" description="请选择课程、班级和日期" />
      </el-tab-pane>

      <!-- ================= 历史记录 ================= -->
      <el-tab-pane label="历史记录" name="history">
        <el-form inline class="search-bar">
          <el-form-item label="课程">
            <el-select v-model="hq.courseId" placeholder="全部课程" clearable style="width: 220px" @change="searchHistory">
              <el-option v-for="c in courses" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button :icon="RefreshRight" @click="loadHistory">刷新</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="historyLoading" :data="history" border stripe>
          <el-table-column prop="date" label="日期" width="120" sortable />
          <el-table-column prop="courseName" label="课程" min-width="160" />
          <el-table-column prop="className" label="班级" min-width="130" />
          <el-table-column label="出勤" width="70" align="center"><template #default="{ row }"><el-text type="success">{{ row.present }}</el-text></template></el-table-column>
          <el-table-column label="迟到" width="70" align="center"><template #default="{ row }"><el-text type="warning">{{ row.late }}</el-text></template></el-table-column>
          <el-table-column label="早退" width="70" align="center"><template #default="{ row }"><el-text type="info">{{ row.leave }}</el-text></template></el-table-column>
          <el-table-column label="缺勤" width="70" align="center"><template #default="{ row }"><el-text type="danger">{{ row.absent }}</el-text></template></el-table-column>
          <el-table-column label="出勤率" width="150">
            <template #default="{ row }">
              <el-progress :percentage="Math.round((row.present / row.total) * 100)" :stroke-width="10" />
            </template>
          </el-table-column>
          <el-table-column prop="updateTime" label="最后修改" width="170" />
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" :icon="canEdit ? Edit : View" @click="openRecord(row)">{{ canEdit ? '修改' : '查看' }}</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination
            v-model:current-page="hq.page"
            v-model:page-size="hq.size"
            :total="historyTotal"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            background
            @change="loadHistory"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { Check, Edit, View, RefreshRight } from '@element-plus/icons-vue'
import { getTeacherCourses, getAttendance, saveAttendance, getAttendanceHistory } from '@/api/teaching'
import { useMenuStore } from '@/stores/menu'
import { ATTENDANCE_STATUS, CURRENT_SEMESTER } from '@/utils/constants'

const route = useRoute()
const menuStore = useMenuStore()
const canEdit = computed(() => menuStore.hasPerm('attendance:edit'))
const tab = ref('register')

// ---------- 考勤登记 ----------
const courses = ref([])
const form = reactive({ courseId: null, classId: null, date: dayjs().format('YYYY-MM-DD') })
const currentCourse = computed(() => courses.value.find((c) => c.id === form.courseId))

const students = ref([])
const statusMap = ref({}) // { 学生id: 状态 }
const exists = ref(false)
const loading = ref(false)
const saving = ref(false)

const counts = computed(() => {
  const c = { present: 0, late: 0, leave: 0, absent: 0 }
  Object.values(statusMap.value).forEach((s) => c[s]++)
  return c
})
const rate = computed(() => (students.value.length ? `${Math.round((counts.value.present / students.value.length) * 100)}%` : '-'))

function onCourseChange() {
  form.classId = currentCourse.value?.classes[0]?.id ?? null
  loadRecord()
}

async function loadRecord() {
  if (!form.courseId || !form.classId || !form.date) return
  loading.value = true
  try {
    const { data } = await getAttendance(form)
    students.value = data.students
    exists.value = !!data.record
    const saved = Object.fromEntries((data.record?.records || []).map((r) => [r.studentId, r.status]))
    // 已有记录则回显，没有则默认“出勤”
    statusMap.value = Object.fromEntries(data.students.map((s) => [s.id, saved[s.id] || 'present']))
  } finally {
    loading.value = false
  }
}

const setAll = (status) => Object.keys(statusMap.value).forEach((k) => (statusMap.value[k] = status))

async function save() {
  saving.value = true
  try {
    const records = students.value.map((s) => ({ studentId: s.id, status: statusMap.value[s.id] }))
    const res = await saveAttendance({ ...form, records })
    ElMessage.success(res.msg)
    exists.value = true
  } finally {
    saving.value = false
  }
}

// ---------- 历史记录 ----------
const hq = reactive({ courseId: '', page: 1, size: 10 })
const history = ref([])
const historyTotal = ref(0)
const historyLoading = ref(false)

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await getAttendanceHistory(hq)
    history.value = res.data.list
    historyTotal.value = res.data.total
  } finally {
    historyLoading.value = false
  }
}
const searchHistory = () => {
  hq.page = 1
  loadHistory()
}

/** 从历史记录跳回登记页进行修改 */
function openRecord(row) {
  Object.assign(form, { courseId: row.courseId, classId: row.classId, date: row.date })
  tab.value = 'register'
  loadRecord()
}

watch(tab, (t) => t === 'history' && loadHistory())

onMounted(async () => {
  // 考勤登记只针对本学期课程
  courses.value = (await getTeacherCourses({ semester: CURRENT_SEMESTER })).data
  const fromQuery = Number(route.query.courseId)
  form.courseId = courses.value.some((c) => c.id === fromQuery) ? fromQuery : courses.value[0]?.id ?? null
  onCourseChange()
})
</script>

<style scoped>
.search-bar { margin-bottom: 12px; }
.summary { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.spacer { flex: 1; }
</style>
