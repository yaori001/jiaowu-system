<!-- 学生 - 我的课表：按周（表格）或按天（时间线）查看课程安排，点击查看课程详情 -->
<template>
  <el-card shadow="never" v-loading="loading">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-select v-model="semester" style="width: 150px" @change="load">
          <el-option v-for="s in SEMESTERS" :key="s" :label="s" :value="s" />
        </el-select>
        <el-select v-model="week" style="width: 150px">
          <el-option v-for="w in 20" :key="w" :label="`第 ${w} 周${w === currentWeek ? '（本周）' : ''}`" :value="w" />
        </el-select>
        <el-button-group>
          <el-button :icon="ArrowLeft" :disabled="week <= 1" @click="week--" />
          <el-button @click="week = currentWeek">本周</el-button>
          <el-button :icon="ArrowRight" :disabled="week >= 20" @click="week++" />
        </el-button-group>
      </div>
      <div class="toolbar-left">
        <span class="text-muted">{{ className }} · 共 {{ list.length }} 门课程</span>
        <el-radio-group v-model="mode">
          <el-radio-button value="week">周视图</el-radio-button>
          <el-radio-button value="day">日视图</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 周视图 -->
    <div v-if="mode === 'week'" class="table-wrap">
      <table class="timetable">
        <thead>
          <tr>
            <th class="sec-col">节次</th>
            <th v-for="(w, i) in WEEKDAYS" :key="w" :class="{ today: isToday(i + 1) }">
              {{ w }}<div class="date">{{ dateOfWeekday(i + 1) }}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="sec in SECTIONS" :key="sec.value">
            <td class="sec-col">
              <b>{{ sec.label }}</b>
              <div class="text-muted">{{ sec.time }}</div>
            </td>
            <td v-for="d in 7" :key="d" :class="{ today: isToday(d) }">
              <div
                v-for="item in cellOf(d, sec.value)"
                :key="item.course.id"
                class="lesson"
                :style="{ background: colorOf(item.course.id) }"
                @click="detail = item"
              >
                <div class="lesson-name">{{ item.course.name }}</div>
                <div>{{ item.slot.location }}</div>
                <div>{{ item.course.teacherName }}</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 日视图 -->
    <template v-else>
      <el-segmented v-model="day" :options="dayOptions" block class="days" />
      <el-timeline v-if="dayLessons.length" class="timeline">
        <el-timeline-item
          v-for="item in dayLessons"
          :key="item.course.id + '-' + item.slot.section"
          :timestamp="`${SECTIONS[item.slot.section - 1].label}  ${SECTIONS[item.slot.section - 1].time}`"
          placement="top"
          :color="colorOf(item.course.id)"
          size="large"
        >
          <el-card shadow="hover" class="day-card" @click="detail = item">
            <h4>{{ item.course.name }}</h4>
            <p class="text-muted">
              <el-icon><Location /></el-icon>{{ item.slot.location }}
              <el-icon><User /></el-icon>{{ item.course.teacherName }}
              <el-tag size="small" :type="item.course.type === '必修' ? 'primary' : 'success'">{{ item.course.type }}</el-tag>
            </p>
          </el-card>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="当天没有课程安排" />
    </template>

    <!-- 课程详情 -->
    <el-dialog :model-value="!!detail" title="课程详情" width="520px" @close="detail = null">
      <el-descriptions v-if="detail" :column="1" border>
        <el-descriptions-item label="课程名称">{{ detail.course.name }}</el-descriptions-item>
        <el-descriptions-item label="课程编号">{{ detail.course.code }}</el-descriptions-item>
        <el-descriptions-item label="课程类型">{{ detail.course.type }}</el-descriptions-item>
        <el-descriptions-item label="授课教师">{{ detail.course.teacherName }}</el-descriptions-item>
        <el-descriptions-item label="学分 / 课时">{{ detail.course.credit }} 学分 / {{ detail.course.hours }} 课时</el-descriptions-item>
        <el-descriptions-item label="上课安排">
          <div v-for="(s, i) in detail.course.schedule" :key="i">{{ scheduleText(s) }}</div>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { getTimetable } from '@/api/teaching'
import { SEMESTERS, CURRENT_SEMESTER, SEMESTER_START, WEEKDAYS, SECTIONS, scheduleText, weekOf } from '@/utils/constants'

const semester = ref(CURRENT_SEMESTER)
const currentWeek = Math.min(weekOf(), 20)
const week = ref(currentWeek)
const mode = ref('week')
const todayWeekday = dayjs().day() || 7 // dayjs: 0 = 周日，转换为 7
const day = ref(todayWeekday)
const dayOptions = WEEKDAYS.map((label, i) => ({ label: i + 1 === todayWeekday ? `${label}（今天）` : label, value: i + 1 }))

const list = ref([])
const className = ref('')
const loading = ref(false)
const detail = ref(null)

async function load() {
  loading.value = true
  try {
    const res = await getTimetable({ semester: semester.value })
    list.value = res.data.list
    className.value = res.data.className
  } finally {
    loading.value = false
  }
}
onMounted(load)

/** 判断某个上课安排在第 week 周是否上课 */
const inWeek = (slot) => {
  const [a, b] = slot.weeks.split('-').map(Number)
  return week.value >= a && week.value <= b
}

/** 本周所有课节：[{ course, slot }] */
const lessons = computed(() =>
  list.value.flatMap((course) => course.schedule.filter(inWeek).map((slot) => ({ course, slot })))
)
const cellOf = (weekday, section) => lessons.value.filter((l) => l.slot.weekday === weekday && l.slot.section === section)
const dayLessons = computed(() =>
  lessons.value.filter((l) => l.slot.weekday === day.value).sort((a, b) => a.slot.section - b.slot.section)
)

const dateOfWeekday = (weekday) =>
  dayjs(SEMESTER_START).add((week.value - 1) * 7 + weekday - 1, 'day').format('MM/DD')
const isToday = (weekday) => semester.value === CURRENT_SEMESTER && week.value === currentWeek && weekday === todayWeekday

const COLORS = ['#5b8ff9', '#5ad8a6', '#f6bd16', '#e8684a', '#6dc8ec', '#9270ca', '#ff9d4d', '#269a99', '#ff99c3', '#7a8ba6']
const colorOf = (id) => COLORS[id % COLORS.length]
</script>

<style scoped>
.table-wrap { overflow-x: auto; }
.timetable { width: 100%; min-width: 860px; border-collapse: collapse; table-layout: fixed; }
.timetable th, .timetable td { border: 1px solid var(--el-border-color-light); padding: 6px; vertical-align: top; text-align: center; }
.timetable th { background: var(--el-fill-color-light); font-weight: 600; padding: 10px 6px; }
.timetable td { height: 96px; }
.sec-col { width: 100px; vertical-align: middle !important; }
.date { font-size: 12px; font-weight: normal; color: var(--el-text-color-secondary); }
.today { background: var(--el-color-primary-light-9) !important; }
.lesson { color: #fff; border-radius: 6px; padding: 6px; font-size: 12px; line-height: 1.6; cursor: pointer; text-align: left; transition: transform 0.15s; }
.lesson + .lesson { margin-top: 4px; }
.lesson:hover { transform: scale(1.03); }
.lesson-name { font-weight: 600; font-size: 13px; }
.days { margin-bottom: 20px; }
.timeline { max-width: 640px; }
.day-card { cursor: pointer; }
.day-card h4 { margin: 0 0 8px; }
.day-card p { margin: 0; display: flex; align-items: center; gap: 6px; }
</style>
