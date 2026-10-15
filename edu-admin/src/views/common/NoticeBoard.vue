<!-- 公告浏览（教师 / 学生共用）：公告列表、详情、已读标记、留言回复 -->
<template>
  <div class="page">
    <el-card shadow="never" class="search-bar">
      <el-form :model="query" inline>
        <el-form-item label="关键字">
          <el-input v-model.trim="query.keyword" placeholder="标题 / 内容" clearable @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="query.type" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="t in NOTICE_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="query.unread" @change="search">只看未读</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="search">搜索</el-button>
          <el-button :icon="Refresh" @click="reset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <div class="toolbar">
        <span class="text-muted">共 {{ total }} 条公告，未读 {{ app.unread }} 条</span>
        <el-button :icon="Finished" :disabled="!app.unread" @click="readAll">全部标为已读</el-button>
      </div>

      <div v-loading="loading" class="list">
        <el-empty v-if="!list.length && !loading" description="暂无公告" />
        <div v-for="n in list" :key="n.id" class="item" :class="{ unread: !n.read }" @click="openDetail(n.id)">
          <div class="item-title">
            <el-badge is-dot :hidden="n.read" class="dot">
              <span class="title">{{ n.title }}</span>
            </el-badge>
            <el-tag v-if="n.top" type="danger" size="small" effect="dark">置顶</el-tag>
            <el-tag size="small" :type="typeTag(n.type)">{{ n.type }}</el-tag>
          </div>
          <p class="summary">{{ n.summary }}{{ n.summary.length >= 60 ? '…' : '' }}</p>
          <div class="meta text-muted">
            <span><el-icon><User /></el-icon>{{ n.authorName }}</span>
            <span><el-icon><Clock /></el-icon>{{ n.publishTime }}</span>
            <span><el-icon><ChatDotRound /></el-icon>{{ n.replyCount }} 条留言</span>
            <span>{{ n.read ? '已读' : '未读' }}</span>
          </div>
        </div>
      </div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.size"
          :total="total"
          :page-sizes="[5, 10, 20]"
          layout="total, sizes, prev, pager, next"
          background
          @change="load"
        />
      </div>
    </el-card>

    <!-- 公告详情 -->
    <el-drawer v-model="drawer" size="560px" :title="detail?.type" destroy-on-close>
      <div v-if="detail" v-loading="detailLoading">
        <h2 class="detail-title">{{ detail.title }}</h2>
        <div class="meta text-muted">
          <span>发布人：{{ detail.authorName }}</span>
          <span>发布时间：{{ detail.publishTime }}</span>
        </div>
        <el-divider />
        <div class="content">{{ detail.content }}</div>

        <el-divider content-position="left">留言（{{ detail.replies.length }}）</el-divider>
        <div v-if="menuStore.hasPerm('notice:reply')" class="reply-box">
          <el-input
            ref="replyInput"
            v-model="replyText"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="发表你的留言…"
          />
          <el-button type="primary" :loading="replying" @click="submitReply">发表留言</el-button>
        </div>
        <el-empty v-if="!detail.replies.length" description="还没有留言" :image-size="60" />
        <div v-for="r in detail.replies" :key="r.id" class="reply">
          <el-avatar :size="32" class="avatar">{{ r.name.slice(-1) }}</el-avatar>
          <div class="reply-body">
            <div class="reply-head">
              <b>{{ r.name }}</b>
              <span class="text-muted">{{ r.time }}</span>
            </div>
            <div class="reply-content">{{ r.content }}</div>
            <div class="reply-actions">
              <el-link v-if="menuStore.hasPerm('notice:reply')" type="primary" :underline="false" @click="replyTo(r)">回复</el-link>
              <el-link v-if="r.userId === userStore.user.id" type="danger" :underline="false" @click="removeReply(r)">删除</el-link>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Finished } from '@element-plus/icons-vue'
import { getBoardNotices, getBoardNotice, markRead, markAllRead, addReply, deleteReply } from '@/api/teaching'
import { useUserStore } from '@/stores/user'
import { useMenuStore } from '@/stores/menu'
import { useAppStore } from '@/stores/app'
import { NOTICE_TYPES } from '@/utils/constants'

const userStore = useUserStore()
const menuStore = useMenuStore()
const app = useAppStore()

const typeTag = (t) => ({ 考试安排: 'warning', 放假通知: 'success', 通知: 'info' })[t] || 'primary'

// ---------- 列表 ----------
const query = reactive({ keyword: '', type: '', unread: false, page: 1, size: 10 })
const list = ref([])
const total = ref(0)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await getBoardNotices({ ...query, unread: query.unread ? 1 : '' })
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
const reset = () => {
  Object.assign(query, { keyword: '', type: '', unread: false })
  search()
}
onMounted(load)

async function readAll() {
  const res = await markAllRead()
  ElMessage.success(res.msg)
  app.refreshUnread()
  load()
}

// ---------- 详情 ----------
const drawer = ref(false)
const detail = ref(null)
const detailLoading = ref(false)

async function openDetail(id) {
  drawer.value = true
  detailLoading.value = true
  try {
    detail.value = (await getBoardNotice(id)).data
    if (!detail.value.read) {
      await markRead(id)
      // 本地同步已读状态，不必重新请求列表
      const item = list.value.find((n) => n.id === id)
      if (item) item.read = true
      app.refreshUnread()
    }
  } catch {
    drawer.value = false
  } finally {
    detailLoading.value = false
  }
}

// ---------- 留言 ----------
const replyText = ref('')
const replying = ref(false)
const replyInput = ref()

async function submitReply() {
  const content = replyText.value.trim()
  if (!content) return ElMessage.warning('请输入留言内容')
  if (/[<>]/.test(content)) return ElMessage.warning('留言不能包含 < > 字符')
  replying.value = true
  try {
    const res = await addReply(detail.value.id, content)
    detail.value.replies.push(res.data)
    replyText.value = ''
    ElMessage.success(res.msg)
    const item = list.value.find((n) => n.id === detail.value.id)
    if (item) item.replyCount++
  } finally {
    replying.value = false
  }
}

function replyTo(r) {
  replyText.value = `回复 @${r.name}：`
  nextTick(() => replyInput.value?.focus())
}

async function removeReply(r) {
  try {
    await ElMessageBox.confirm('确定删除这条留言吗？', '提示', { type: 'warning' })
  } catch {
    return
  }
  await deleteReply(detail.value.id, r.id)
  detail.value.replies = detail.value.replies.filter((x) => x.id !== r.id)
  const item = list.value.find((n) => n.id === detail.value.id)
  if (item) item.replyCount--
  ElMessage.success('留言已删除')
}
</script>

<style scoped>
.list { min-height: 200px; }
.item {
  padding: 14px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s;
}
.item:hover { background: var(--el-fill-color-light); }
.item-title { display: flex; align-items: center; gap: 8px; }
.title { font-size: 15px; color: var(--el-text-color-regular); }
.unread .title { font-weight: 600; color: var(--el-text-color-primary); }
.dot :deep(.el-badge__content.is-dot) { top: 4px; right: -2px; }
.summary { margin: 8px 0; color: var(--el-text-color-secondary); font-size: 13px; }
.meta { display: flex; flex-wrap: wrap; gap: 18px; }
.meta span { display: inline-flex; align-items: center; gap: 4px; }
.detail-title { margin: 0 0 10px; font-size: 20px; }
.content { white-space: pre-wrap; line-height: 1.9; }
.reply-box { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; margin-bottom: 16px; }
.reply { display: flex; gap: 10px; padding: 12px 0; border-bottom: 1px dashed var(--el-border-color); }
.avatar { background: var(--el-color-success); flex-shrink: 0; }
.reply-body { flex: 1; }
.reply-head { display: flex; justify-content: space-between; }
.reply-content { margin: 6px 0; white-space: pre-wrap; }
.reply-actions { display: flex; gap: 12px; }
</style>
