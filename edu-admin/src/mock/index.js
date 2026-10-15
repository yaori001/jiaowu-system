/**
 * Mock 入口：导入各模块即完成接口注册，然后启动拦截
 * 如果接入真实后端，只需在 main.js 中去掉 import '@/mock' 即可
 */
import { startMock } from './server'
import './modules/common'
import './modules/admin'
import './modules/teaching'

startMock()
