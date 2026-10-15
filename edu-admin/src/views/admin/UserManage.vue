<!-- 用户管理：搜索、分页、新增/批量新增、编辑、删除/批量删除、启用禁用、重置密码 -->
<template>
  <div class="page">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-bar">
      <el-form :model="query" inline>
        <el-form-item label="关键字">
          <el-input v-model.trim="query.keyword" placeholder="姓名 / 账号" clearable @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="query.role" placeholder="全部" clearable style="width: 130px">
            <el-option v-for="r in ROLES" :key="r.value" :label="r.label" :value="r.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="班级">
          <el-select v-model="query.classId" placeholder="全部" clearable style="width: 150px">
            <el-option v-for="c in classOptions" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 100px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="search">搜索</el-button>
          <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <!-- 操作栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <el-button v-perm="'user:add'" type="primary" :icon="Plus" @click="openForm()">新增用户</el-button>
          <el-button v-perm="'user:add'" type="success" :icon="DocumentAdd" @click="batchVisible = true">批量添加学生</el-button>
          <el-button v-perm="'user:delete'" type="danger" :icon="Delete" :disabled="!selected.length" @click="handleDelete(selected)">
            批量删除{{ selected.length ? `（${selected.length}）` : '' }}
          </el-button>
        </div>
        <el-tooltip content="刷新">
          <el-button :icon="RefreshRight" circle @click="load" />
        </el-tooltip>
      </div>

      <!-- 表格 -->
      <el-table v-loading="loading" :data="list" border stripe @selection-change="(rows) => (selected = rows)">
        <el-table-column type="selection" width="45" :selectable="(row) => row.id !== userStore.user.id" />
        <el-table-column prop="username" label="账号" min-width="100" />
        <el-table-column prop="name" label="姓名" min-width="90" />
        <el-table-column label="角色" width="110">
          <template #default="{ row }">
            <el-tag :type="roleTag(row.role)">{{ roleLabel(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="班级 / 部门" min-width="140">
          <template #default="{ row }">{{ row.role === 'student' ? row.className || '未分班' : row.dept }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" min-width="120" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 1"
              :disabled="row.id === userStore.user.id || !menuStore.hasPerm('user:status')"
              @change="(v) => toggleStatus(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" min-width="160" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button v-perm="'user:edit'" link type="primary" :icon="Edit" @click="openForm(row)">编辑</el-button>
            <el-button v-perm="'user:reset'" link type="warning" :icon="Key" @click="handleResetPwd(row)">重置密码</el-button>
            <el-button
              v-perm="'user:delete'"
              link
              type="danger"
              :icon="Delete"
              :disabled="row.id === userStore.user.id"
              @click="handleDelete([row])"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.size"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @change="load"
        />
      </div>
    </el-card>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="form.id ? '编辑用户' : '新增用户'" width="520px" @closed="formRef.resetFields()">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="角色" prop="role">
          <el-radio-group v-model="form.role" :disabled="form.id === userStore.user.id">
            <el-radio v-for="r in ROLES" :key="r.value" :value="r.value">{{ r.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="账号" prop="username">
          <el-input v-model.trim="form.username" placeholder="3-16 位字母、数字或下划线" />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model.trim="form.name" />
        </el-form-item>
        <el-form-item v-if="!form.id" label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="默认 123456" />
        </el-form-item>
        <el-form-item v-if="form.role === 'student'" label="所属班级" prop="classId">
          <el-select v-model="form.classId" placeholder="请选择班级" style="width: 100%">
            <el-option v-for="c in classOptions" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-else label="所属部门" prop="dept">
          <el-input v-model.trim="form.dept" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model.trim="form.phone" maxlength="11" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量添加学生 -->
    <el-dialog v-model="batchVisible" title="批量添加学生" width="560px" @closed="batchRef.resetFields()">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 16px">
        按“账号前缀 + 序号”自动生成账号，例如前缀 s25、起始 1、位数 3 → s25001、s25002…，初始密码均为 123456。
      </el-alert>
      <el-form ref="batchRef" :model="batch" :rules="batchRules" label-width="100px">
        <el-form-item label="所属班级" prop="classId">
          <el-select v-model="batch.classId" placeholder="请选择班级" style="width: 100%">
            <el-option v-for="c in classOptions" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="账号前缀" prop="prefix">
          <el-input v-model.trim="batch.prefix" placeholder="如 s25" />
        </el-form-item>
        <el-form-item label="起始序号">
          <el-input-number v-model="batch.start" :min="1" :max="9999" />
          <span class="text-muted" style="margin: 0 8px 0 16px">序号位数</span>
          <el-input-number v-model="batch.digits" :min="1" :max="6" />
        </el-form-item>
        <el-form-item label="学生姓名" prop="names">
          <el-input v-model="batch.names" type="textarea" :rows="6" placeholder="每行一个姓名，或用逗号、空格分隔" />
        </el-form-item>
        <el-form-item label="账号预览">
          <span class="text-muted">{{ batchPreview }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitBatch">批量添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Delete, Edit, Key, RefreshRight, DocumentAdd } from '@element-plus/icons-vue'
import * as api from '@/api/admin'
import { useUserStore } from '@/stores/user'
import { useMenuStore } from '@/stores/menu'
import { encryptPassword } from '@/utils/crypto'
import { ROLES, roleLabel, roleTag } from '@/utils/constants'
import { textRule, usernameRule, phoneRule, requiredRule, noIllegalChar } from '@/utils/validate'

const userStore = useUserStore()
const menuStore = useMenuStore()

// ---------- 列表查询 ----------
const query = reactive({ keyword: '', role: '', classId: '', status: '', page: 1, size: 10 })
const list = ref([])
const total = ref(0)
const loading = ref(false)
const selected = ref([])
const classOptions = ref([])

async function load() {
  loading.value = true
  try {
    const res = await api.getUsers(query)
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
  Object.assign(query, { keyword: '', role: '', classId: '', status: '' })
  search()
}

onMounted(async () => {
  load()
  classOptions.value = (await api.getClassOptions()).data
})

// ---------- 新增 / 编辑 ----------
const formVisible = ref(false)
const formRef = ref()
const saving = ref(false)
const emptyForm = () => ({ id: null, role: 'student', username: '', name: '', password: '', classId: null, dept: '信息工程学院', phone: '' })
const form = reactive(emptyForm())

const rules = {
  role: requiredRule('角色'),
  username: usernameRule,
  name: textRule('姓名', 2, 20),
  password: [{ pattern: /^\S{6,20}$/, message: '密码为 6-20 位非空白字符', trigger: 'blur' }],
  classId: requiredRule('所属班级'),
  dept: [{ validator: noIllegalChar, trigger: 'blur' }],
  phone: phoneRule
}

function openForm(row) {
  formVisible.value = true
  // 等弹窗打开后再赋值，保证 resetFields 能恢复到空表单
  Object.assign(form, emptyForm(), row ? { ...row } : {})
}

async function submitForm() {
  if (!(await formRef.value.validate().catch(() => false))) return
  saving.value = true
  try {
    const data = { ...form, password: form.password ? encryptPassword(form.password) : undefined }
    const res = form.id ? await api.updateUser(form.id, data) : await api.addUser(data)
    ElMessage.success(res.msg)
    formVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

// ---------- 批量添加 ----------
const batchVisible = ref(false)
const batchRef = ref()
const batch = reactive({ classId: null, prefix: '', start: 1, digits: 3, names: '' })
const batchRules = {
  classId: requiredRule('班级'),
  prefix: [
    { required: true, message: '请输入账号前缀', trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9_]{0,9}$/, message: '前缀以字母开头，最多 10 位', trigger: 'blur' }
  ],
  names: [{ required: true, message: '请输入学生姓名', trigger: 'blur' }, { validator: noIllegalChar, trigger: 'blur' }]
}
const batchNames = computed(() => batch.names.split(/[\s,，、]+/).filter(Boolean))
const accountOf = (i) => batch.prefix + String(batch.start + i).padStart(batch.digits, '0')
const batchPreview = computed(() => {
  const n = batchNames.value.length
  if (!n || !batch.prefix) return '—'
  return `共 ${n} 人：${accountOf(0)}${n > 1 ? ` ~ ${accountOf(n - 1)}` : ''}`
})

async function submitBatch() {
  if (!(await batchRef.value.validate().catch(() => false))) return
  const users = batchNames.value.map((name, i) => ({ username: accountOf(i), name, role: 'student', classId: batch.classId }))
  if (users.length > 100) return ElMessage.warning('单次最多添加 100 人')
  saving.value = true
  try {
    const res = await api.batchAddUsers(users)
    if (res.data.errors.length) {
      ElMessageBox.alert(res.data.errors.join('<br>'), res.msg, { dangerouslyUseHTMLString: true, type: 'warning' })
    } else {
      ElMessage.success(res.msg)
    }
    batchVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

// ---------- 删除 / 状态 / 重置密码 ----------
async function handleDelete(rows) {
  const names = rows.map((r) => r.name).join('、')
  try {
    await ElMessageBox.confirm(`确定删除用户「${names}」吗？学生的成绩记录将一并删除。`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  const res = await api.deleteUsers(rows.map((r) => r.id))
  ElMessage.success(res.msg)
  // 当前页删空了就回到上一页
  if (list.value.length === rows.length && query.page > 1) query.page--
  load()
}

async function toggleStatus(row, value) {
  const status = value ? 1 : 0
  const res = await api.setUserStatus(row.id, status)
  row.status = status
  ElMessage.success(res.msg)
}

async function handleResetPwd(row) {
  try {
    await ElMessageBox.confirm(`确定将「${row.name}」的密码重置为 123456 吗？`, '重置密码', { type: 'warning' })
  } catch {
    return
  }
  const res = await api.resetUserPassword(row.id)
  ElMessage.success(res.msg)
}
</script>
