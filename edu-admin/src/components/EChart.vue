<!--
  ECharts 通用封装组件：传入 option 即可渲染，自动处理窗口缩放和销毁
  用法：<EChart :option="option" height="300px" />
-->
<template>
  <div ref="chartRef" :style="{ width: '100%', height }"></div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '300px' }
})

const chartRef = ref()
const chart = shallowRef(null)
let observer = null

onMounted(() => {
  chart.value = echarts.init(chartRef.value)
  chart.value.setOption(props.option)
  // 容器尺寸变化（窗口缩放、侧边栏折叠）时自适应
  observer = new ResizeObserver(() => chart.value?.resize())
  observer.observe(chartRef.value)
})

watch(() => props.option, (opt) => chart.value?.setOption(opt, true), { deep: true })

onBeforeUnmount(() => {
  observer?.disconnect()
  chart.value?.dispose()
})
</script>
