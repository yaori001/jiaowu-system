import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIcons from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import 'dayjs/locale/zh-cn'
import dayjs from 'dayjs'

import App from './App.vue'
import router from './router'
import perm from './directives/perm'
import './assets/main.css'

dayjs.locale('zh-cn')

/**
 * 是否启用 Mock：由环境变量 VITE_USE_MOCK 控制
 * - 本地开发（.env.development）默认 true，纯前端即可运行
 * - 打包部署（.env.production）为 false，请求真实后端接口
 */
async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    await import('./mock')
  }

  const app = createApp(App)

  // 全局注册 Element Plus 图标，菜单可以通过名称动态渲染图标
  for (const [name, component] of Object.entries(ElementPlusIcons)) {
    app.component(name, component)
  }

  app.use(createPinia())
  app.use(router)
  app.use(ElementPlus, { locale: zhCn })
  app.directive('perm', perm)
  app.mount('#app')
}

bootstrap()
