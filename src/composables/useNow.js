import { computed, ref } from 'vue'
import { todayISO } from '../data'

// 全局唯一的时钟：让问候语、日期、"今天"判断都跟随真实时间，
// 跨午夜或重新切回标签页时自动刷新。
const now = ref(new Date())

setInterval(() => { now.value = new Date() }, 30000)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') now.value = new Date()
})
window.addEventListener('focus', () => { now.value = new Date() })

export function useNow() {
  const today = computed(() => {
    now.value // 建立依赖
    return todayISO()
  })
  const hour = computed(() => now.value.getHours())
  return { now, today, hour }
}
