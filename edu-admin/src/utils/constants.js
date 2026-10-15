/** 全局常量：角色、学期、节次等字典数据，页面统一从这里取，避免硬编码 */

export const ROLES = [
  { value: 'admin', label: '超级管理员', tag: 'danger' },
  { value: 'teacher', label: '教师', tag: 'warning' },
  { value: 'student', label: '学生', tag: 'success' }
]

export const roleLabel = (v) => ROLES.find((r) => r.value === v)?.label || v
export const roleTag = (v) => ROLES.find((r) => r.value === v)?.tag || 'info'

/** 学期列表（第一个为当前学期） */
export const SEMESTERS = ['2026-2027-1', '2025-2026-2', '2025-2026-1']
export const CURRENT_SEMESTER = SEMESTERS[0]

/** 当前学期第一周的周一，用于计算“第几周” */
export const SEMESTER_START = '2026-09-07'

/** 计算某个日期是本学期第几周（第一周之前返回 1） */
export const weekOf = (date = new Date()) => {
  const days = Math.floor((new Date(date) - new Date(SEMESTER_START + 'T00:00:00')) / 86400000)
  return Math.max(1, Math.floor(days / 7) + 1)
}

export const COURSE_TYPES = ['必修', '选修']

export const NOTICE_TYPES = ['教务公告', '通知', '考试安排', '放假通知']

export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 大节：每天 5 个大节 */
export const SECTIONS = [
  { value: 1, label: '第1-2节', time: '08:00-09:40' },
  { value: 2, label: '第3-4节', time: '10:00-11:40' },
  { value: 3, label: '第5-6节', time: '14:00-15:40' },
  { value: 4, label: '第7-8节', time: '16:00-17:40' },
  { value: 5, label: '第9-10节', time: '19:00-20:40' }
]

/** 考勤状态 */
export const ATTENDANCE_STATUS = [
  { value: 'present', label: '出勤', tag: 'success' },
  { value: 'late', label: '迟到', tag: 'warning' },
  { value: 'leave', label: '早退', tag: 'info' },
  { value: 'absent', label: '缺勤', tag: 'danger' }
]
export const attendanceLabel = (v) => ATTENDANCE_STATUS.find((s) => s.value === v)?.label || v
export const attendanceTag = (v) => ATTENDANCE_STATUS.find((s) => s.value === v)?.tag || 'info'

/** 综合成绩 = 平时 40% + 期末 60% */
export const calcTotal = (usual, final) => {
  if (usual == null || final == null || usual === '' || final === '') return null
  return Math.round(usual * 0.4 + final * 0.6)
}

/** 课程安排转可读文字，如：周一 第1-2节 @ 实训楼A301 */
export const scheduleText = (s) =>
  `${WEEKDAYS[s.weekday - 1]} ${SECTIONS[s.section - 1]?.label || ''} @ ${s.location}（${s.weeks}周）`
