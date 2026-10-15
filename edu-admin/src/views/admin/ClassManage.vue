<!-- 班级管理：增删改查、绑定辅导员、批量分配学生、状态管理 -->
<template>
  <div class="page">
    <el-card shadow="never" class="search-bar">
      <el-form :model="query" inline>
        <el-form-item label="关键字">
          <el-input v-model.trim="query.keyword" placeholder="班级名称 / 专业" clearable @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="专业">
          <el-select v-model="query.major" placeholder="全部" clearable style="width: 160px">
            <el-option v-for="m in MAJORS" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 100px">
            <el-option label="正常" :value="1" />
            <el-option label="停用" :value="0" />
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
          <el-button v-perm="'class:add'" type="primary" :icon="Plus" @click="openForm()">新增班级</el-button>
          <el-button v-perm="'class:delete'" type="danger" :icon="Delete" :disabled="!selected.length" @click="handleDelete(selected)">批量删除</el-button>
        </div>
        <el-button :icon="RefreshRight" circle @click="load" />
      </div>

      <el-table v-loading="loading" :data="list" border stripe @selection-change="(rows) => (selected = rows)">
        <el-table-column type="selection" width="45" />
        <el-table-column prop="name" label="班级名称" min-width="140" />
        <el-table-column prop="major" label="所属专业" min-width="140" />
        <el-table-column prop="year" label="入学年份" width="100" align="center" />
        <el-table-column label="班级人数" width="100" align="center">
          <template #default="{ row }">
            <el-tag type="info">{{ row.studentCount }} 人</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="辅导员" min-width="100">
          <template #default="{ row }">{{ row.counselorName || '未分配' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 1"
              :disabled="!menuStore.hasPerm('class:edit')"
              @change="(v) => toggleStatus(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button v-perm="'class:assign'" link type="success" :icon="UserFilled" @click="openAssign(row)">分配学生</el-button>
            <el-button v-perm="'class:edit'" link type="primary" :icon="Edit" @click="openForm(row)">编辑</el-button>
            <el-button v-perm="'class:delete'" link type="danger" :icon="Delete" @click="handleDelete([row])">删除</el-button>
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
    <el-dialog v-model="formVisible" :title="form.id ? '编辑班级' : '新增班级'" width="480px" @closed="formRef.resetFields()">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="班级名称" prop="name">
          <el-input v-model.trim="form.name" placeholder="如：软件技术2501" />
        </el-form-item>
        <el-form-item label="所属专业" prop="major">
          <el-select v-model="form.major" filterable allow-create placeholder="可选择或直接输入" style="width: 100%">
            <el-option v-for="m in MAJORS" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="入学年份" prop="year">
          <el-input-number v-model="form.year" :min="2000" :max="2100" controls-position="right" />
        </el-form-item>
        <el-form-item label="辅导员" prop="counselorId">
          <el-select v-model="form.counselorId" filterable clearable placeholder="请选择教师" style="width: 100%">
            <el-option v-for="t in teachers" :key="t.id" :label="`${t.name}（${t.username}）`" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">正常</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- 分配学生 -->
    <el-dialog v-model="assignVisible" :title="`分配学生 - ${assignClass?.name}`" width="760px">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
        右侧为本班学生名单。从其他班级移入的学生会自动从原班级移出；从右侧移出的学生将变为“未分班”。
      </el-alert>
      <el-transfer
        v-model="assignIds"
        v-loading="assignLoading"
        :data="studentData"
        filterable
        :filter-method="(q, item) => item.label.includes(q)"
        filter-placeholder="搜索姓名 / 账号"
        :titles="['全部学生', '本班学生']"
        class="transfer"
      />
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitAssign">保存（{{ assignIds.length }} 人）</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Delete, Edit, RefreshRight, UserFilled } from '@element-plus/icons-vue'
import * as api from '@/api/admin'
import { useMenuStore } from '@/stores/menu'
import { textRule, requiredRule } from '@/utils/validate'

const menuStore = useMenuStore()
const MAJORS = ['软件技术', '计算机应用技术', '大数据技术', '计算机网络技术', '人工智能技术应用']

// ---------- 列表 ----------
const query = reactive({ keyword: '', major: '', status: '', page: 1, size: 10 })
const list = ref([])
const total = ref(0)
const loading = ref(false)
const selected = ref([])
const teachers = ref([])

async function load() {
  loading.value = true
  try {
    const res = await api.getClasses(query)
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
  Object.assign(query, { keyword: '', major: '', status: '' })
  search()
}
onMounted(async () => {
  load()
  teachers.value = (await api.getUserOptions({ role: 'teacher' })).data
})

// ---------- 新增 / 编辑 ----------
const formVisible = ref(false)
const formRef = ref()
const saving = ref(false)
const emptyForm = () => ({ id: null, name: '', major: '', year: new Date().getFullYear(), counselorId: null, status: 1 })
const form = reactive(emptyForm())
const rules = {
  name: textRule('班级名称', 2, 30),
  major: requiredRule('所属专业'),
  year: requiredRule('入学年份')
}

function openForm(row) {
  formVisible.value = true
  Object.assign(form, emptyForm(), row ? { ...row } : {})
}

async function submitForm() {
  if (!(await formRef.value.validate().catch(() => false))) return
  saving.value = true
  try {
    const res = form.id ? await api.updateClass(form.id, form) : await api.addClass(form)
    ElMessage.success(res.msg)
    formVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function toggleStatus(row, v) {
  const res = await api.setClassStatus(row.id, v ? 1 : 0)
  row.status = v ? 1 : 0
  ElMessage.success(res.msg)
}

async function handleDelete(rows) {
  try {
    await ElMessageBox.confirm(`确定删除班级「${rows.map((r) => r.name).join('、')}」吗？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  const res = await api.deleteClasses(rows.map((r) => r.id))
  ElMessage.success(res.msg)
  if (list.value.length === rows.length && query.page > 1) query.page--
  load()
}

// ---------- 分配学生 ----------
const assignVisible = ref(false)
const assignLoading = ref(false)
const assignClass = ref(null)
const assignIds = ref([])
const students = ref([])
const classOptions = ref([])

const studentData = computed(() =>
  students.value.map((s) => {
    const cls = classOptions.value.find((c) => c.id === s.classId)
    const from = s.classId === assignClass.value?.id ? '' : `【${cls ? cls.name : '未分班'}】`
    return { key: s.id, label: `${s.name}（${s.username}）${from}` }
  })
)

async function openAssign(row) {
  assignClass.value = row
  assignVisible.value = true
  assignLoading.value = true
  try {
    const [s, c] = await Promise.all([api.getUserOptions({ role: 'student' }), api.getClassOptions()])
    students.value = s.data
    classOptions.value = c.data
    assignIds.value = s.data.filter((x) => x.classId === row.id).map((x) => x.id)
  } finally {
    assignLoading.value = false
  }
}

async function submitAssign() {
  saving.value = true
  try {
    const res = await api.assignStudents(assignClass.value.id, assignIds.value)
    ElMessage.success(res.msg)
    assignVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.transfer { display: flex; align-items: center; justify-content: center; }
.transfer :deep(.el-transfer-panel) { width: 300px; }
</style>
