/** 管理员模块接口 */
import request from './request'

// 用户
export const getUsers = (params) => request.get('/users', { params })
export const getUserOptions = (params) => request.get('/users/options', { params })
export const addUser = (data) => request.post('/users', data)
export const batchAddUsers = (users) => request.post('/users/batch', { users })
export const updateUser = (id, data) => request.put(`/users/${id}`, data)
export const setUserStatus = (id, status) => request.put(`/users/${id}/status`, { status })
export const resetUserPassword = (id) => request.put(`/users/${id}/password`)
export const deleteUsers = (ids) => request.delete('/users', { data: { ids } })

// 班级
export const getClasses = (params) => request.get('/classes', { params })
export const getClassOptions = () => request.get('/classes/options')
export const addClass = (data) => request.post('/classes', data)
export const updateClass = (id, data) => request.put(`/classes/${id}`, data)
export const setClassStatus = (id, status) => request.put(`/classes/${id}/status`, { status })
export const assignStudents = (id, studentIds) => request.put(`/classes/${id}/students`, { studentIds })
export const deleteClasses = (ids) => request.delete('/classes', { data: { ids } })

// 课程
export const getCourses = (params) => request.get('/courses', { params })
export const addCourse = (data) => request.post('/courses', data)
export const updateCourse = (id, data) => request.put(`/courses/${id}`, data)
export const deleteCourses = (ids) => request.delete('/courses', { data: { ids } })

// 公告
export const getNotices = (params) => request.get('/notices', { params })
export const addNotice = (data) => request.post('/notices', data)
export const updateNotice = (id, data) => request.put(`/notices/${id}`, data)
export const setNoticeTop = (id, top) => request.put(`/notices/${id}/top`, { top })
export const deleteNotices = (ids) => request.delete('/notices', { data: { ids } })

// 菜单 & 权限
export const getAllMenus = () => request.get('/menus/all')
export const addMenu = (data) => request.post('/menus', data)
export const updateMenu = (id, data) => request.put(`/menus/${id}`, data)
export const deleteMenu = (id) => request.delete(`/menus/${id}`)
export const getRolePerms = () => request.get('/roles/perms')
export const saveRolePerms = (role, data) => request.put(`/roles/${role}`, data)
