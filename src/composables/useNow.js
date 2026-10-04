import { computed, ref } from 'vue'
import { toISODate } from '../data'

const now = ref(new Date())
let timer = null

export function useNow() {
  if (!timer) {
    timer = setInterval(() => {
      now.value = new Date()
    }, 30 * 1000)
  }
  const today = computed(() => toISODate(now.value))
  return { now, today }
}
