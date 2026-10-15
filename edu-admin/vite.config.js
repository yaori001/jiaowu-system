import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Vite 配置：@ 指向 src 目录，方便统一引用
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: { port: 5173, open: true },
  // echarts、element-plus 体积较大，适当放宽打包体积告警阈值
  build: { chunkSizeWarningLimit: 1500 }
})
