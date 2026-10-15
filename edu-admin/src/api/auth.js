/** 登录、菜单、首页、个人中心 */
import request from './request'

export const login = (data) => request.post('/login', data)
export const logout = () => request.post('/logout')
export const getUserInfo = () => request.get('/user/info')
export const getMenus = () => request.get('/menus')
export const getDashboard = () => request.get('/dashboard')
export const resetSystem = () => request.post('/system/reset')

export const updateProfile = (data) => request.put('/profile', data)
export const changePassword = (data) => request.put('/profile/password', data)
export const resetPassword = () => request.post('/profile/password/reset')
