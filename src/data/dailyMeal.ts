import type { Dish, MealPlan } from '@/types'
import type { CookingLog } from '@/stores/fandaziStore'
import type { BuddyGroup } from './familySharing'
import type { DishPreferences } from './dishPreferences'
import type { HealthProfile } from '@/components/healthProfileStorage'
import { recommendMeal } from './recommend'
import { getRecommendationCatalog } from './dishCatalogPolicy'
import { getCurrentMealType, type CurrentMealTime } from './mealTimeContext'
import { scoreDishByHealthProfiles } from './healthRecommend'
import { buildHealthPlanSummaryFromProfile } from './healthPlanSummary'

export type DailyMealSettings = {
  people: number
  mealsPerDay: 1 | 2 | 3
  dishesPerMeal: 'auto' | 1 | 2 | 3
  carb: 'optional' | 'required' | 'none'
  repeatWindowDays: 7 | 14
}

export const DEFAULT_DAILY_MEAL_SETTINGS: DailyMealSettings = {
  people: 2, mealsPerDay: 1, dishesPerMeal: 'auto', carb: 'optional', repeatWindowDays: 14,
}

const STORAGE_KEY = 'fandazi.dailyMealSettings.v1'
export const DAILY_MEAL_SETTINGS_EVENT = 'fandazi:daily-meal-settings-changed'

export function readDailyMealSettings(): DailyMealSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<DailyMealSettings>
    return { ...DEFAULT_DAILY_MEAL_SETTINGS, ...raw }
  } catch { return DEFAULT_DAILY_MEAL_SETTINGS }
}
export function writeDailyMealSettings(settings: DailyMealSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(new Event(DAILY_MEAL_SETTINGS_EVENT))
}
function dateSeed(date: string) { return [...date].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 100000, 7) }
function dayDiff(date: string, today: string) { return Math.floor((Date.parse(`${today}T00:00:00`) - Date.parse(`${date}T00:00:00`)) / 86400000) }

function buildPersistedPlanHealthReasons(dishes: Dish[], profiles: HealthProfile[], people: number): string[] {
  if (profiles.length === 0) return []
  const directReasons = dishes.flatMap((dish) => scoreDishByHealthProfiles(dish, profiles).reasons)
  const cookingReasons = dishes.flatMap((dish) => profiles.map((profile) => {
    if (!profile.cookingTimePreference) return ''
    const minutes = Number.parseInt(dish.cookTime, 10)
    if (profile.cookingTimePreference === 'quick' && minutes <= 25) return `符合快手优先（${minutes} 分钟）`
    if (profile.cookingTimePreference === 'slow' && minutes >= 45) return `符合愿意慢慢做（${minutes} 分钟）`
    if (profile.cookingTimePreference === 'regular' && minutes >= 20 && minutes <= 40) return `符合正常做饭节奏（${minutes} 分钟）`
    return ''
  }))
  const planSummaries = profiles
    .map((profile) => buildHealthPlanSummaryFromProfile(profile, people))
    .filter(Boolean)
    .map((summary) => `参考你的需求：${summary}`)
  return Array.from(new Set([...directReasons, ...cookingReasons, ...planSummaries].filter(Boolean))).slice(0, 3)
}

export function getDailyMealRecommendation(input: {
  date: string; dishes: Dish[]; pantryItems: string[]; mealPlans: MealPlan[]; cookingLogs: CookingLog[];
  settings: DailyMealSettings; buddyGroup: BuddyGroup; healthProfiles: HealthProfile[]; mealTime?: CurrentMealTime;
  desiredDishId?: string; revision?: number;
}) {
  const mealTime = input.mealTime ?? getCurrentMealType()
  const recent = new Set<string>()
  for (const plan of input.mealPlans) if (dayDiff(plan.planDate, input.date) >= 0 && dayDiff(plan.planDate, input.date) < input.settings.repeatWindowDays) recent.add(plan.dishId)
  for (const log of input.cookingLogs) if (dayDiff(log.date, input.date) >= 0 && dayDiff(log.date, input.date) < input.settings.repeatWindowDays) recent.add(log.dishId)
  // 健康问卷更新后，不继续无条件复用更新前的今日计划；旧计划保留在数据里，用户确认新推荐后再产生新的安排。
  const latestHealthUpdateAt = input.healthProfiles.reduce((latest, profile) => Math.max(latest, profile.updatedAt), 0)
  const today = input.mealPlans.filter((p) => {
    if (p.planDate !== input.date || p.status === 'skipped') return false
    if (latestHealthUpdateAt === 0) return true
    const planUpdatedAt = Date.parse(p.updatedAt)
    return Number.isNaN(planUpdatedAt) || planUpdatedAt >= latestHealthUpdateAt
  })
  const todayDishes = today.map((p) => input.dishes.find((d) => d.id === p.dishId)).filter(Boolean) as Dish[]
  if (todayDishes.length) return {
    dishes: todayDishes,
    persisted: true,
    reason: '这是你家今天已经确认的安排。',
    healthReasons: buildPersistedPlanHealthReasons(todayDishes, input.healthProfiles, input.settings.people),
  }
  const target = input.settings.dishesPerMeal === 'auto' ? (input.settings.people <= 1 ? 1 : input.settings.people <= 2 ? 2 : 3) : input.settings.dishesPerMeal
  const prefs = Object.fromEntries(input.buddyGroup.members.map((m) => [m.id, m.preferences])) as Record<string, DishPreferences>
  const result = recommendMeal({ mealTime, pantryItems: input.pantryItems, candidateDishes: getRecommendationCatalog(input.dishes),
    buddyGroup: input.buddyGroup, memberPreferences: prefs, healthProfiles: input.healthProfiles, familySize: input.settings.people,
    forceCount: target, excludeDishIds: [...recent].filter((id) => id !== input.desiredDishId), seed: dateSeed(input.date) + (input.revision ?? 0) * 997, carbPolicy: input.settings.carb })
  return {
    dishes: result?.dishes ?? [],
    persisted: false,
    reason: result?.reason ?? '暂时没有可安排的菜。',
    healthReasons: result?.healthReasons ?? [],
  }
}
