import { computed, reactive, watch } from 'vue'
import { achievementDefinitions, createDemoState, daysFromToday, isThisWeek, normalRanges, todayISO, uid } from '../data'
import { useNow } from './useNow'

const STORAGE_KEY = 'petcare-home-state'
const META_KEY = 'petcare-home-meta'
const DEMO_STALE_DAYS = 14

const saved = localStorage.getItem(STORAGE_KEY)
const state = reactive(saved ? JSON.parse(saved) : createDemoState())

watch(state, (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true })

function loadMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {} } catch { return {} }
}
function saveMeta() { localStorage.setItem(META_KEY, JSON.stringify(meta)) }

// 判断当前数据是否仍是未经修改的演示数据（以演示宠物 id 作为标志）
function looksLikeDemoData() {
  return state.pets.some((pet) => pet.id === 'pet-momo' || pet.id === 'pet-nori')
}

// 老版本没有 meta：根据数据里最近的"日常"记录反推演示数据的生成时间，
// 健康/活动/用药记录的日期会随时间过期，而疫苗日期本身可能在未来，不能作为依据。
function inferDemoGeneratedAt() {
  const dates = [
    ...state.healthRecords.map((item) => item.date),
    ...state.activities.map((item) => item.date),
    ...state.medications.map((item) => item.startDate),
  ].filter(Boolean).sort()
  return dates.at(-1) || null
}

const meta = reactive((() => {
  const parsed = loadMeta()
  if (!saved) return { isDemo: true, generatedAt: todayISO(), noticeDismissedAt: null }
  if (parsed.isDemo !== undefined) return { isDemo: parsed.isDemo, generatedAt: parsed.generatedAt, noticeDismissedAt: parsed.noticeDismissedAt ?? null }
  return { isDemo: looksLikeDemoData(), generatedAt: inferDemoGeneratedAt(), noticeDismissedAt: null }
})())

saveMeta()
watch(meta, saveMeta, { deep: true })

const { today } = useNow()

export function usePetStore() {
  const petById = (id) => state.pets.find((pet) => pet.id === id)
  const petName = (id) => petById(id)?.name || '未命名宠物'
  const totalActivity = computed(() => state.activities.filter((item) => isThisWeek(item.date, today.value)).reduce((sum, item) => sum + Number(item.duration || 0), 0))
  // 已逾期但仍需尽快补种（逾期超过 14 天不再算作临期待办）
  const overdueVaccines = computed(() => state.vaccines.filter((item) => {
    const days = daysFromToday(item.nextDate, today.value)
    return days < 0 && days >= -14
  }).length)
  const pendingVaccines = computed(() => state.vaccines.filter((item) => {
    const days = daysFromToday(item.nextDate, today.value)
    return days >= 0 && days <= 7
  }).length)
  const feedingTasks = computed(() => state.feedings.reduce((sum, item) => sum + Number(item.times || 0), 0))
  const medicationsToday = computed(() => state.medications.filter((item) => item.startDate <= today.value && item.endDate >= today.value).length)
  const achievements = computed(() => achievementDefinitions.map((item) => ({ ...item, unlocked: item.condition(state) })))
  const healthCompleteness = (petId) => {
    const fields = ['weight', 'temperature', 'heartRate']
    const count = fields.filter((type) => state.healthRecords.some((item) => item.petId === petId && item.type === type)).length
    return Math.round((count / fields.length) * 100)
  }
  const weightCompliance = (petId) => {
    const records = state.healthRecords.filter((item) => item.petId === petId && item.type === 'weight')
    if (!records.length) return 0
    return Math.round((records.filter((item) => item.value >= normalRanges.weight.min && item.value <= normalRanges.weight.max).length / records.length) * 100)
  }

  // 演示数据距首次生成已超过两周：记录、用药、疫苗早已过期
  const demoStaleDays = computed(() => {
    if (!meta.isDemo || !meta.generatedAt) return 0
    return daysFromToday(meta.generatedAt, today.value) * -1
  })
  const showStaleDemoNotice = computed(() => {
    if (!meta.isDemo || demoStaleDays.value < DEMO_STALE_DAYS) return false
    return meta.noticeDismissedAt !== meta.generatedAt
  })

  function markUserCreated() {
    if (meta.isDemo) {
      meta.isDemo = false
      meta.noticeDismissedAt = null
    }
  }

  function add(itemType, payload) {
    state[itemType].unshift({ id: uid(itemType.slice(0, -1)), ...payload })
    markUserCreated()
  }
  function addPet(payload) {
    add('pets', payload)
  }
  function refreshDemo() {
    const fresh = createDemoState()
    Object.keys(state).forEach((key) => { state[key].splice(0, state[key].length, ...(fresh[key] || [])) })
    meta.isDemo = true
    meta.generatedAt = todayISO()
    meta.noticeDismissedAt = null
  }
  function dismissStaleNotice() {
    meta.noticeDismissedAt = meta.generatedAt
  }
  function resetDemo() {
    refreshDemo()
  }

  return {
    state,
    petById,
    petName,
    totalActivity,
    pendingVaccines,
    overdueVaccines,
    feedingTasks,
    medicationsToday,
    achievements,
    healthCompleteness,
    weightCompliance,
    showStaleDemoNotice,
    demoStaleDays,
    demoGeneratedAt: computed(() => meta.generatedAt),
    add,
    addPet,
    refreshDemo,
    dismissStaleNotice,
    resetDemo,
  }
}
