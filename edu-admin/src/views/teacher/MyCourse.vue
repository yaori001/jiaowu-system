<!-- 教师 - 我的课程：查看授课课程、班级、上课时间，支持筛选和详情查看 -->
<template>
  <div class="page">
    <el-card shadow="never" class="search-bar">
      <el-form :model="query" inline>
        <el-form-item label="关键字">
          <el-input v-model.trim="query.keyword" placeholder="课程名称 / 编号" clearable @keyup.enter="load" />
        </el-form-item>
        <el-form-item label="学期">
          <el-select v-model="query.semester" placeholder="全部" clearable style="width: 140px" @change="load">
            <el-option v-for="s in SEMESTERS" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="query.type" placeholder="全部" clearable style="width: 100px" @change="load">
            <el-option v-for="t in COURSE_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="load">搜索</el-button>
          <el-button :icon="Refresh" @click="reset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div v-loading="loading" class="grid">
      <el-empty v-if="!list.length && !loading" description="暂无课程" class="empty" />
      <el-card v-for="c in list" :key="c.id" shadow="hover" class="course">
        <template #header>
          <div class="course-head">
            <span class="course-name">{{ c.name }}</span>
            <el-tag :type="c.type === '必修' ? 'primary' : 'success'" size="small">{{ c.type }}</el-tag>
          </div>
        </template>
        <div class="row"><span class="text-muted">课程编号</span>{{ c.code }}</div>
        <div class="row"><span class="text-muted">开课学期</span>{{ c.semester }}</div>
        <div class="row"><span class="text-muted">学分 / 课时</span>{{ c.credit }} 学分 / {{ c.hours }} 课时</div>
        <div class="row">
          <span class="text-muted">授课班级</span>
          <div>
            <el-tag v-for="cls in c.classes" :key="cls.id" size="small" type="info" class="mr">{{ cls.name }}</el-tag>
          </div>
        </div>
        <div class="row"><span class="text-muted">学生人数</span>{{ c.studentCount }} 人</div>
        <div class="row">
          <span class="text-muted">上课时间</span>
          <div>
            <div v-for="(s, i) in c.schedule" :key="i">{{ scheduleText(s) }}</div>
          </div>
        </div>
        <div class="actions">
          <el-button size="small" :icon="View" @click="detail = c">详情</el-button>
          <el-button size="small" type="primary" plain :icon="EditPen" @click="goto('/teacher/score', c)">成绩</el-button>
          <el-button size="small" type="success" plain :icon="Calendar" @click="goto('/teacher/attendance', c)">考勤</el-button>
        </div>
      </el-card>
    </div>

    <!-- 课程详情 -->
    <el-dialog :model-value="!!detail" :title="detail?.name" width="620px" @close="detail = null">
      <template v-if="detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="课程编号">{{ detail.code }}</el-descriptions-item>
          <el-descriptions-item label="课程类型">{{ detail.type }}</el-descriptions-item>
          <el-descriptions-item label="学分">{{ detail.credit }}</el-descriptions-item>
          <el-descriptions-item label="课时">{{ detail.hours }}</el-descriptions-item>
          <el-descriptions-item label="开课学期" :span="2">{{ detail.semester }}</el-descriptions-item>
        </el-descriptions>
        <h4>授课班级</h4>
        <el-table :data="detail.classes" border size="small">
          <el-table-column prop="name" label="班级" />
          <el-table-column prop="studentCount" label="人数" width="100" align="center" />
        </el-table>
        <h4>上课安排</h4>
        <el-table :data="detail.schedule" border size="small">
          <el-table-column label="星期" width="80"><template #default="{ row }">{{ WEEKDAYS[row.weekday - 1] }}</template></el-table-column>
          <el-table-column label="节次"><template #default="{ row }">{{ SECTIONS[row.section - 1].label }}（{{ SECTIONS[row.section - 1].time }}）</template></el-table-column>
          <el-table-column prop="location" label="地点" />
          <el-table-column prop="weeks" label="周次" width="80" />
        </el-table>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Refresh, View, EditPen, Calendar } from '@element-plus/icons-vue'
import { getTeacherCourses } from '@/api/teaching'
import { SEMESTERS, CURRENT_SEMESTER, COURSE_TYPES, WEEKDAYS, SECTIONS, scheduleText } from '@/utils/constants'

const router = useRouter()
const query = reactive({ keyword: '', semester: CURRENT_SEMESTER, type: '' })
const list = ref([])
const loading = ref(false)
const detail = ref(null)

async function load() {
  loading.value = true
  try {
    list.value = (await getTeacherCourses(query)).data
  } finally {
    loading.value = false
  }
}
const reset = () => {
  Object.assign(query, { keyword: '', semester: CURRENT_SEMESTER, type: '' })
  load()
}
onMounted(load)

/** 跳转到成绩 / 考勤页面，并通过 query 带上课程 id */
const goto = (path, c) => router.push({ path, query: { courseId: c.id } })
</script>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; min-height: 200px; }
.empty { grid-column: 1 / -1; }
.course-head { display: flex; justify-content: space-between; align-items: center; }
.course-name { font-weight: 600; font-size: 16px; }
.row { display: flex; gap: 12px; padding: 5px 0; line-height: 1.6; }
.row > .text-muted { width: 80px; flex-shrink: 0; }
.mr { margin: 0 4px 4px 0; }
.actions { display: flex; justify-content: flex-end; margin-top: 12px; border-top: 1px dashed var(--el-border-color); padding-top: 12px; }
h4 { margin: 18px 0 8px; }
</style>
