/** 教师、学生业务接口 + 公告浏览 */
import request from './request'

// 教师
export const getTeacherCourses = (params) => request.get('/teacher/courses', { params })
export const getCourseScores = (params) => request.get('/teacher/scores', { params })
export const saveScores = (data) => request.post('/teacher/scores', data)
export const getAttendance = (params) => request.get('/teacher/attendance', { params })
export const saveAttendance = (data) => request.post('/teacher/attendance', data)
export const getAttendanceHistory = (params) => request.get('/teacher/attendance/history', { params })

// 学生
export const getTimetable = (params) => request.get('/student/timetable', { params })
export const getMyScores = (params) => request.get('/student/scores', { params })
export const getMyAttendance = (params) => request.get('/student/attendance', { params })

// 公告浏览
export const getBoardNotices = (params) => request.get('/board/notices', { params })
export const getBoardNotice = (id) => request.get(`/board/notices/${id}`)
export const getUnreadCount = () => request.get('/board/unread', { silent: true })
export const markRead = (id) => request.post(`/board/notices/${id}/read`)
export const markAllRead = () => request.post('/board/notices/read-all')
export const addReply = (id, content) => request.post(`/board/notices/${id}/replies`, { content })
export const deleteReply = (id, rid) => request.delete(`/board/notices/${id}/replies/${rid}`)
