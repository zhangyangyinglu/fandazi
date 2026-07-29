import type { Dish, MealPlan } from '@/types'
import type { CookingLog } from '@/stores/fandaziStore'
import type { BuddyGroup } from './familySharing'
import type { DishPreferences } from './dishPreferences'
import type { HealthProfile } from '@/components/healthProfileStorage'
import { recommendMeal } from './recommend'

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

export function getDailyMealRecommendation(input: {
  date: string; dishes: Dish[]; pantryItems: string[]; mealPlans: MealPlan[]; cookingLogs: CookingLog[];
  settings: DailyMealSettings; buddyGroup: BuddyGroup; healthProfiles: HealthProfile[]; desiredDishId?: string;
}) {
  const recent = new Set<string>()
  for (const plan of input.mealPlans) if (dayDiff(plan.planDate, input.date) >= 0 && dayDiff(plan.planDate, input.date) < input.settings.repeatWindowDays) recent.add(plan.dishId)
  for (const log of input.cookingLogs) if (dayDiff(log.date, input.date) >= 0 && dayDiff(log.date, input.date) < input.settings.repeatWindowDays) recent.add(log.dishId)
  const today = input.mealPlans.filter((p) => p.planDate === input.date && p.status !== 'skipped')
  const todayDishes = today.map((p) => input.dishes.find((d) => d.id === p.dishId)).filter(Boolean) as Dish[]
  if (todayDishes.length) return { dishes: todayDishes, persisted: true, reason: '这是你家今天已经确认的安排。' }
  const target = input.settings.dishesPerMeal === 'auto' ? (input.settings.people <= 1 ? 1 : input.settings.people <= 2 ? 2 : 3) : input.settings.dishesPerMeal
  const prefs = Object.fromEntries(input.buddyGroup.members.map((m) => [m.id, m.preferences])) as Record<string, DishPreferences>
  const result = recommendMeal({ mealTime: 'dinner', pantryItems: input.pantryItems, candidateDishes: input.dishes,
    buddyGroup: input.buddyGroup, memberPreferences: prefs, healthProfiles: input.healthProfiles, familySize: input.settings.people,
    forceCount: target, excludeDishIds: [...recent].filter((id) => id !== input.desiredDishId), seed: dateSeed(input.date), carbPolicy: input.settings.carb })
  return { dishes: result?.dishes ?? [], persisted: false, reason: result?.reason ?? '暂时没有可安排的菜。' }
}
