import type { Dish, MealPlan } from '@/types'
import type { CookingLog } from '@/stores/fandaziStore'
import type { BuddyGroup } from './familySharing'
import type { HealthProfile } from '@/components/healthProfileStorage'
import { getDailyMealRecommendation, type DailyMealSettings } from './dailyMeal'
import { getRecommendationCatalog } from './dishCatalogPolicy'
import { syncWeeklyPrepPlan } from '@/lib/familyCloudSync'

export type WeeklyMealLabel = '午餐' | '晚餐'

export type WeeklyPrepMeal = {
  label: WeeklyMealLabel
  dishIds: string[]
}

export type WeeklyPrepDay = {
  date: string
  weekday: string
  meals: WeeklyPrepMeal[]
}

export type WeeklyPrepBatch = {
  id: string
  title: string
  rangeLabel: string
  dates: string[]
  dishIds: string[]
  note: string
}

export type WeeklyPrepPlan = {
  weekStart: string
  weekEnd: string
  mealsPerDay: 1 | 2
  servings: number
  status: 'draft' | 'confirmed'
  createdAt: string
  days: WeeklyPrepDay[]
  batches: WeeklyPrepBatch[]
}

export type BuildWeeklyPrepPlanInput = {
  weekStart: string
  dishes: Dish[]
  pantryItems: string[]
  mealPlans: MealPlan[]
  cookingLogs: CookingLog[]
  dailySettings: DailyMealSettings
  mealsPerDay: 1 | 2
  servings: number
  buddyGroup: BuddyGroup
  healthProfiles: HealthProfile[]
}

export const WEEKLY_PREP_STORAGE_KEY = 'fandazi.weeklyPrepPlan.v1'
export const WEEKLY_PREP_CHANGE_EVENT = 'fandazi:weekly-prep-changed'

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const FRESH_PATTERNS = /鱼|虾|海鲜|贝|鱿鱼|白灼|清炒|凉拌|炒蛋|蒸蛋|生菜|上海青|小白菜|空心菜/

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00`)
}

function toDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(date: string, amount: number): string {
  const next = toDate(date)
  next.setDate(next.getDate() + amount)
  return toDateString(next)
}

export function getWeekStart(input: Date | string = new Date()): string {
  const date = typeof input === 'string' ? toDate(input) : new Date(input)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day))
  return toDateString(date)
}

export function formatWeekDate(date: string): string {
  const value = toDate(date)
  return `${value.getMonth() + 1}月${value.getDate()}日`
}

export function getPrepAdvice(dish: Dish): { mode: 'batch' | 'fresh'; label: string; note: string } {
  const text = `${dish.name} ${dish.cookMethod} ${dish.tags.join(' ')}`
  if (FRESH_PATTERNS.test(text)) {
    return { mode: 'fresh', label: '鲜做优先', note: '建议当天或次日做，口感更好。' }
  }
  return { mode: 'batch', label: '适合批量', note: '可以提前做 2～3 份，分装后再组合。' }
}

function makeVirtualPlan(date: string, dishId: string, slot: string): MealPlan {
  return {
    id: `weekly-draft-${date}-${slot}-${dishId}`,
    dishId,
    status: 'planned',
    planDate: date,
    createdAt: '',
    updatedAt: '',
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}

export function buildWeeklyPrepPlan(input: BuildWeeklyPrepPlanInput): WeeklyPrepPlan {
  const candidates = getRecommendationCatalog(input.dishes)
  const virtualPlans = [...input.mealPlans]
  const slots: WeeklyMealLabel[] = input.mealsPerDay === 2 ? ['午餐', '晚餐'] : ['晚餐']
  const batchWindows: Array<[number, number]> = [[0, 2], [3, 5], [6, 6]]
  const batchCandidates = candidates.filter((dish) => getPrepAdvice(dish).mode === 'batch')
  const recommendationSettings: DailyMealSettings = {
    ...input.dailySettings,
    people: Math.max(1, input.servings),
    mealsPerDay: 1,
    dishesPerMeal: 2,
    carb: input.dailySettings.carb === 'none' ? 'optional' : input.dailySettings.carb,
  }

  const batchDrafts = batchWindows.map(([start, end], index) => {
    const anchorDate = addDays(input.weekStart, start)
    const result = getDailyMealRecommendation({
      date: anchorDate,
      dishes: candidates,
      pantryItems: input.pantryItems,
      mealPlans: virtualPlans.filter((plan) => plan.planDate !== anchorDate),
      cookingLogs: input.cookingLogs,
      settings: recommendationSettings,
      buddyGroup: input.buddyGroup,
      healthProfiles: input.healthProfiles,
      mealTime: 'dinner',
      revision: 100 + index,
    })
    const selected = unique(result.dishes
      .filter((dish) => getPrepAdvice(dish).mode === 'batch')
      .map((dish) => dish.id))
    const preferred = selected.length > 0 ? selected : []
    const unavailableFallbacks = batchCandidates.filter((dish) => !preferred.includes(dish.id))
    const fallbackPool = unavailableFallbacks.length > 0 ? unavailableFallbacks : batchCandidates
    const componentCount = Math.min(2, Math.max(1, batchCandidates.length))
    for (let offset = 0; preferred.length < componentCount && offset < fallbackPool.length; offset += 1) {
      const dish = fallbackPool[(index * componentCount + offset) % fallbackPool.length]
      if (dish && !preferred.includes(dish.id)) preferred.push(dish.id)
    }
    const dishIds = preferred.slice(0, componentCount)
    dishIds.forEach((dishId, componentIndex) => {
      virtualPlans.push(makeVirtualPlan(anchorDate, dishId, `batch-${index}-${componentIndex}`))
    })
    return { start, end, dishIds }
  })

  const days: WeeklyPrepDay[] = []
  batchDrafts.forEach(({ start, end, dishIds }) => {
    for (let dayIndex = start; dayIndex <= end; dayIndex += 1) {
      const date = addDays(input.weekStart, dayIndex)
      const primaryId = dishIds[dayIndex % Math.max(1, dishIds.length)]
      const secondaryId = dishIds[(dayIndex + 1) % Math.max(1, dishIds.length)] ?? primaryId
      const meals = slots.map((label, slotIndex) => ({
        label,
        dishIds: [input.mealsPerDay === 2 && slotIndex === 1 ? secondaryId : primaryId].filter(Boolean),
      }))
      days.push({ date, weekday: WEEKDAYS[dayIndex], meals })
    }
  })

  const batches = batchDrafts.map(({ start, end, dishIds }, index) => {
    const batchDays = days.filter((day) => day.date >= addDays(input.weekStart, start) && day.date <= addDays(input.weekStart, end))
    const hasFreshDish = dishIds
      .map((id) => candidates.find((dish) => dish.id === id))
      .filter(Boolean)
      .some((dish) => getPrepAdvice(dish as Dish).mode === 'fresh')
    const note = index === 2
      ? '周日保留弹性：优先现做，或消耗前两批剩余食材。'
        : hasFreshDish
        ? '批量菜提前分装；鱼虾、叶菜等鲜做菜不要一次做满三天。'
        : '这批菜可以一次做 2～3 份，主菜、主食和配菜分开保存。'
    return {
      id: `batch-${index + 1}`,
      title: index === 2 ? '第三批 · 周日弹性' : `第${index + 1}批 · ${batchDays[0].weekday}备餐`,
      rangeLabel: `${batchDays[0].weekday}～${batchDays[batchDays.length - 1].weekday}`,
      dates: batchDays.map((day) => day.date),
      dishIds,
      note,
    }
  })

  return {
    weekStart: input.weekStart,
    weekEnd: addDays(input.weekStart, 6),
    mealsPerDay: input.mealsPerDay,
    servings: Math.max(1, input.servings),
    status: 'draft',
    createdAt: new Date().toISOString(),
    days,
    batches,
  }
}

export function readWeeklyPrepPlan(weekStart: string): WeeklyPrepPlan | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(WEEKLY_PREP_STORAGE_KEY)
    if (!raw) return null
    const plan = JSON.parse(raw) as WeeklyPrepPlan
    return plan?.weekStart === weekStart && Array.isArray(plan.days) && Array.isArray(plan.batches) ? plan : null
  } catch {
    return null
  }
}

export function writeWeeklyPrepPlan(plan: WeeklyPrepPlan): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(WEEKLY_PREP_STORAGE_KEY, JSON.stringify(plan))
    window.dispatchEvent(new Event(WEEKLY_PREP_CHANGE_EVENT))
  } catch (e) {
    console.error('[饭搭子] 周备餐写入本地存储失败:', e)
  }
  // 云端同步（异步，不阻塞 UI）
  void syncWeeklyPrepPlan(plan)
}
