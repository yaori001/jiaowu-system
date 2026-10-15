<!-- 公告管理：发布、编辑、删除、置顶、公开/隐藏、预览 -->
<template>
  <div class="page">
    <el-card shadow="never" class="search-bar">
      <el-form :model="query" inline>
        <el-form-item label="关键字">
          <el-input v-model.trim="query.keyword" placeholder="标题 / 内容" clearable @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="query.type" placeholder="全部" clearable style="width: 130px">
            <el-option v-for="t in NOTICE_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 100px">
            <el-option label="公开" value="public" />
            <el-option label="隐藏" value="hidden" />
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
          <el-button v-perm="'notice:add'" type="primary" :icon="Plus" @click="openForm()">发布公告</el-button>
          <el-button v-perm="'notice:delete'" type="danger" :icon="Delete" :disabled="!selected.length" @click="handleDelete(selected)">批量删除</el-button>
        </div>
        <el-button :icon="RefreshRight" circle @click="load" />
      </div>

      <el-table v-loading="loading" :data="list" border stripe @selection-change="(rows) => (selected = rows)">
        <el-table-column type="selection" width="45" />
        <el-table-column label="标题" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag v-if="row.top" type="danger" size="small" effect="dark" class="mr">置顶</el-tag>
            <el-link :underline="false" @click="preview = row">{{ row.title }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'public' ? 'success' : 'info'">{{ row.status === 'public' ? '公开' : '隐藏' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="readCount" label="已读人数" width="90" align="center" />
        <el-table-column prop="replyCount" label="留言" width="70" align="center" />
        <el-table-column prop="authorName" label="发布人" width="110" />
        <el-table-column prop="publishTime" label="发布时间" width="170" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button v-perm="'notice:top'" link :type="row.top ? 'info' : 'warning'" :icon="Top" @click="toggleTop(row)">
              {{ row.top ? '取消置顶' : '置顶' }}
            </el-button>
            <el-button v-perm="'notice:edit'" link type="primary" :icon="Edit" @click="openForm(row)">编辑</el-button>
            <el-button v-perm="'notice:delete'" link type="danger" :icon="Delete" @click="handleDelete([row])">删除</el-button>
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

    <!-- 发布 / 编辑 -->
    <el-dialog v-model="formVisible" :title="form.id ? '编辑公告' : '发布公告'" width="680px" @closed="formRef.resetFields()">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="公告标题" prop="title">
          <el-input v-model.trim="form.title" maxlength="60" show-word-limit />
        </el-form-item>
        <el-form-item label="公告类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio-button v-for="t in NOTICE_TYPES" :key="t" :value="t">{{ t }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="公告内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="8" maxlength="2000" show-word-limit />
        </el-form-item>
        <el-form-item label="发布时间" prop="publishTime">
          <el-date-picker v-model="form.publishTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="默认当前时间" />
        </el-form-item>
        <el-form-item label="展示状态">
          <el-radio-group v-model="form.status">
            <el-radio value="public">公开</el-radio>
            <el-radio value="hidden">隐藏</el-radio>
          </el-radio-group>
          <el-checkbox v-model="form.top" style="margin-left: 24px">置顶</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">{{ form.id ? '保存' : '发布' }}</el-button>
      </template>
    </el-dialog>

    <!-- 预览 -->
    <el-dialog :model-value="!!preview" :title="preview?.type" width="620px" @close="preview = null">
      <template v-if="preview">
        <h2 style="margin-top: 0">{{ preview.title }}</h2>
        <p class="text-muted">{{ preview.authorName }} · {{ preview.publishTime }}</p>
        <el-divider />
        <div class="content">{{ preview.content }}</div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Delete, Edit, RefreshRight, Top } from '@element-plus/icons-vue'
import * as api from '@/api/admin'
import { NOTICE_TYPES } from '@/utils/constants'
import { textRule, requiredRule, noIllegalChar } from '@/utils/validate'

// ---------- 列表 ----------
const query = reactive({ keyword: '', type: '', status: '', page: 1, size: 10 })
const list = ref([])
const total = ref(0)
const loading = ref(false)
const selected = ref([])
const preview = ref(null)

async function load() {
  loading.value = true
  try {
    const res = await api.getNotices(query)
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
  Object.assign(query, { keyword: '', type: '', status: '' })
  search()
}
onMounted(load)

// ---------- 发布 / 编辑 ----------
const formVisible = ref(false)
const formRef = ref()
const saving = ref(false)
const emptyForm = () => ({ id: null, title: '', type: '教务公告', content: '', publishTime: '', status: 'public', top: false })
const form = reactive(emptyForm())
const rules = {
  title: textRule('公告标题', 4, 60),
  type: requiredRule('公告类型'),
  content: [
    { required: true, message: '请输入公告内容', trigger: 'blur' },
    { min: 10, message: '公告内容至少 10 个字', trigger: 'blur' },
    { validator: noIllegalChar, trigger: 'blur' }
  ]
}

function openForm(row) {
  formVisible.value = true
  Object.assign(form, emptyForm(), row ? { ...row } : {})
}

async function submitForm() {
  if (!(await formRef.value.validate().catch(() => false))) return
  saving.value = true
  try {
    const res = form.id ? await api.updateNotice(form.id, form) : await api.addNotice(form)
    ElMessage.success(res.msg)
    formVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function toggleTop(row) {
  const res = await api.setNoticeTop(row.id, !row.top)
  ElMessage.success(res.msg)
  load() // 置顶会影响排序，重新加载
}

async function handleDelete(rows) {
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${rows.length} 条公告吗？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  const res = await api.deleteNotices(rows.map((r) => r.id))
  ElMessage.success(res.msg)
  if (list.value.length === rows.length && query.page > 1) query.page--
  load()
}
</script>

<style scoped>
.mr { margin-right: 6px; }
.content { white-space: pre-wrap; line-height: 1.9; }
</style>
