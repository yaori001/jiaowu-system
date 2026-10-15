<!-- 课程管理：课程信息维护、分配授课教师与班级、排课（上课时间地点） -->
<template>
  <div class="page">
    <el-card shadow="never" class="search-bar">
      <el-form :model="query" inline>
        <el-form-item label="关键字">
          <el-input v-model.trim="query.keyword" placeholder="课程名称 / 编号" clearable @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="query.type" placeholder="全部" clearable style="width: 100px">
            <el-option v-for="t in COURSE_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="学期">
          <el-select v-model="query.semester" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="s in SEMESTERS" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="授课教师">
          <el-select v-model="query.teacherId" placeholder="全部" clearable filterable style="width: 130px">
            <el-option v-for="t in teachers" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="search">搜索</el-button>
          <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-button v-perm="'course:add'" type="primary" :icon="Plus" @click="openForm()">新增课程</el-button>
          <el-button v-perm="'course:delete'" type="danger" :icon="Delete" :disabled="!selected.length" @click="handleDelete(selected)">批量删除</el-button>
        </div>
        <el-button :icon="RefreshRight" circle @click="load" />
      </div>

      <el-table v-loading="loading" :data="list" border stripe @selection-change="(rows) => (selected = rows)">
        <el-table-column type="selection" width="45" />
        <el-table-column prop="code" label="课程编号" width="100" />
        <el-table-column prop="name" label="课程名称" min-width="160" show-overflow-tooltip />
        <el-table-column label="类型" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.type === '必修' ? 'primary' : 'success'">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="credit" label="学分" width="70" align="center" />
        <el-table-column prop="hours" label="课时" width="70" align="center" />
        <el-table-column prop="semester" label="学期" width="120" />
        <el-table-column label="授课教师" width="100">
          <template #default="{ row }">{{ row.teacherName || '未分配' }}</template>
        </el-table-column>
        <el-table-column label="授课班级" min-width="180">
          <template #default="{ row }">
            <el-tag v-for="n in row.classNames" :key="n" size="small" type="info" class="mr">{{ n }}</el-tag>
            <span v-if="!row.classNames.length" class="text-muted">未分配</span>
          </template>
        </el-table-column>
        <el-table-column label="上课安排" min-width="260">
          <template #default="{ row }">
            <div v-for="(s, i) in row.schedule" :key="i" class="text-muted">{{ scheduleText(s) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button v-perm="'course:edit'" link type="primary" :icon="Edit" @click="openForm(row)">编辑</el-button>
            <el-button v-perm="'course:delete'" link type="danger" :icon="Delete" @click="handleDelete([row])">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @change="load"
        />
      </div>
    </el-card>

    <!-- 新增 / 编辑 -->
    <el-dialog v-model="formVisible" :title="form.id ? '编辑课程' : '新增课程'" width="760px" top="6vh" @closed="formRef.resetFields()">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="课程编号" prop="code">
              <el-input v-model.trim="form.code" placeholder="如 RJ2001" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="课程名称" prop="name">
              <el-input v-model.trim="form.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="课程类型" prop="type">
              <el-radio-group v-model="form.type">
                <el-radio v-for="t in COURSE_TYPES" :key="t" :value="t">{{ t }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开课学期" prop="semester">
              <el-select v-model="form.semester" style="width: 100%">
                <el-option v-for="s in SEMESTERS" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="学分" prop="credit">
              <el-input-number v-model="form.credit" :min="0.5" :max="10" :step="0.5" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="课时" prop="hours">
              <el-input-number v-model="form.hours" :min="8" :max="200" :step="8" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="授课教师" prop="teacherId">
              <el-select v-model="form.teacherId" filterable placeholder="请选择" style="width: 100%">
                <el-option v-for="t in teachers" :key="t.id" :label="`${t.name}（${t.username}）`" :value="t.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="授课班级" prop="classIds">
              <el-select v-model="form.classIds" multiple collapse-tags collapse-tags-tooltip placeholder="可多选" style="width: 100%">
                <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="上课安排" prop="schedule">
          <div class="schedule">
            <div v-for="(s, i) in form.schedule" :key="i" class="schedule-row">
              <el-select v-model="s.weekday" style="width: 90px">
                <el-option v-for="(w, wi) in WEEKDAYS" :key="w" :label="w" :value="wi + 1" />
              </el-select>
              <el-select v-model="s.section" style="width: 120px">
                <el-option v-for="sec in SECTIONS" :key="sec.value" :label="sec.label" :value="sec.value" />
              </el-select>
              <el-input v-model.trim="s.location" placeholder="上课地点" style="width: 150px" />
              <el-input v-model.trim="s.weeks" placeholder="周次 如1-16" style="width: 110px" />
              <el-button :icon="Minus" circle size="small" @click="form.schedule.splice(i, 1)" />
            </div>
            <el-button :icon="Plus" size="small" @click="addSchedule">添加上课时间</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Minus, Delete, Edit, RefreshRight } from '@element-plus/icons-vue'
import * as api from '@/api/admin'
import { COURSE_TYPES, SEMESTERS, CURRENT_SEMESTER, WEEKDAYS, SECTIONS, scheduleText } from '@/utils/constants'
import { textRule, requiredRule } from '@/utils/validate'

// ---------- 列表 ----------
const query = reactive({ keyword: '', type: '', semester: '', teacherId: '', page: 1, size: 10 })
const list = ref([])
const total = ref(0)
const loading = ref(false)
const selected = ref([])
const teachers = ref([])
const classes = ref([])

async function load() {
  loading.value = true
  try {
    const res = await api.getCourses(query)
    list.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}
const search = () => {
  query.page = 1
  load()
}
const resetQuery = () => {
  Object.assign(query, { keyword: '', type: '', semester: '', teacherId: '' })
  search()
}
onMounted(async () => {
  load()
  const [t, c] = await Promise.all([api.getUserOptions({ role: 'teacher' }), api.getClassOptions()])
  teachers.value = t.data
  classes.value = c.data
})

// ---------- 新增 / 编辑 ----------
const formVisible = ref(false)
const formRef = ref()
const saving = ref(false)
const emptyForm = () => ({
  id: null, code: '', name: '', type: '必修', semester: CURRENT_SEMESTER, credit: 2, hours: 32,
  teacherId: null, classIds: [], schedule: []
})
const form = reactive(emptyForm())

/** 上课安排校验：地点必填、周次格式、同一时间不能重复 */
const scheduleValidator = (rule, value, cb) => {
  for (const s of value) {
    if (!s.location) return cb(new Error('请填写上课地点'))
    if (/[<>"'`\\;{}$]/.test(s.location)) return cb(new Error('上课地点不能包含特殊字符'))
    if (!/^\d{1,2}-\d{1,2}$/.test(s.weeks)) return cb(new Error('周次格式应为“起始-结束”，如 1-16'))
    const [a, b] = s.weeks.split('-').map(Number)
    if (a < 1 || a > b || b > 20) return cb(new Error('周次范围为 1-20，且起始周不大于结束周'))
  }
  const keys = value.map((s) => `${s.weekday}-${s.section}`)
  if (new Set(keys).size !== keys.length) return cb(new Error('存在重复的上课时间'))
  cb()
}

const rules = {
  code: [
    { required: true, message: '请输入课程编号', trigger: 'blur' },
    { pattern: /^[A-Z]{2}\d{4}$/, message: '编号格式：2 位大写字母 + 4 位数字，如 RJ2001', trigger: 'blur' }
  ],
  name: textRule('课程名称', 2, 30),
  type: requiredRule('课程类型'),
  semester: requiredRule('开课学期'),
  credit: requiredRule('学分'),
  hours: requiredRule('课时'),
  teacherId: requiredRule('授课教师'),
  classIds: [{ type: 'array', required: true, min: 1, message: '请至少选择一个班级', trigger: 'change' }],
  schedule: [{ validator: scheduleValidator, trigger: 'change' }]
}

function openForm(row) {
  formVisible.value = true
  // schedule 是数组对象，需要深拷贝，否则取消编辑也会改到表格数据
  Object.assign(form, emptyForm(), row ? JSON.parse(JSON.stringify(row)) : {})
}

const addSchedule = () => form.schedule.push({ weekday: 1, section: 1, location: '', weeks: '1-16' })

async function submitForm() {
  if (!(await formRef.value.validate().catch(() => false))) return
  saving.value = true
  try {
    const res = form.id ? await api.updateCourse(form.id, form) : await api.addCourse(form)
    ElMessage.success(res.msg)
    formVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function handleDelete(rows) {
  try {
    await ElMessageBox.confirm(`确定删除课程「${rows.map((r) => r.name).join('、')}」吗？相关成绩和考勤记录将一并删除。`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  const res = await api.deleteCourses(rows.map((r) => r.id))
  ElMessage.success(res.msg)
  if (list.value.length === rows.length && query.page > 1) query.page--
  load()
}
</script>

<style scoped>
.mr { margin: 2px 4px 2px 0; }
.schedule { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.schedule-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
</style>
