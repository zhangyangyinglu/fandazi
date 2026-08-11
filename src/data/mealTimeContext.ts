/**
 * v1.11 阶段 1B: 时段隐式推荐工具
 *
 * 设计 (Q1=A 拍板, 2026-06-25):
 * - 字段层完整存在 (Dish.mealType 5 维) → 推荐排序按当前时段隐式加权
 * - UI 层不做强制餐次入口 → 早晨打开首页, 红烧排骨自然降权, 不会跳出来
 * - 不用单一整点切断：以早餐 8:00、午餐 12:30、晚餐 18:30 为中心，按平滑分数处理过渡区。
 * - 凌晨 0:00–5:00 不制造早餐，沿用晚餐逻辑；这只处理睡眠时段，不影响白天的软过渡。
 *
 * 用法:
 *   const meal = getCurrentMealType()       // 'breakfast' | 'lunch' | 'dinner'
 *   const weight = mealTypeWeight(dish, meal)  // 0..1 加权乘数, 用于现有排序
 *   const sorted = sortByMealTime(dishes)   // 直接按当前时段排序的便捷封装
 */

import type { Dish, MealType } from '../types'

export type CurrentMealTime = 'breakfast' | 'lunch' | 'dinner'
export type MealTimeScores = Record<CurrentMealTime, number>

const MEAL_TIME_PROFILES: Record<CurrentMealTime, { center: number; spread: number }> = {
  breakfast: { center: 8, spread: 2.75 },
  lunch: { center: 12.5, spread: 3.2 },
  dinner: { center: 18.5, spread: 4.2 },
}

function beijingDateParts(date: Date): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
}

/** 统一使用北京时间，避免用户设备时区导致餐次和日期错位。 */
export function getBeijingHour(date = new Date()): number {
  return Math.floor(getBeijingTimeOfDay(date))
}

export function getBeijingTimeOfDay(date = new Date()): number {
  const parts = beijingDateParts(date)
  return Number(parts.hour) + Number(parts.minute ?? 0) / 60
}

export function getBeijingDateString(date = new Date()): string {
  const parts = beijingDateParts(date)
  return `${parts.year}-${parts.month}-${parts.day}`
}

/**
 * 返回当前时刻对三种正餐的相对匹配度。
 * 分数使用“中心时段 + 平滑衰减”，所以午餐和晚餐之间不会被某个整点突然切断。
 */
export function getMealTimeScores(hour = getBeijingTimeOfDay()): MealTimeScores {
  const h = ((hour % 24) + 24) % 24
  if (h < 5) return { breakfast: 0.05, lunch: 0.05, dinner: 1 }

  const score = (meal: CurrentMealTime) => {
    const { center, spread } = MEAL_TIME_PROFILES[meal]
    const rawDistance = Math.abs(h - center)
    const distance = Math.min(rawDistance, 24 - rawDistance)
    return Math.exp(-(distance ** 2) / (2 * spread ** 2))
  }

  return { breakfast: score('breakfast'), lunch: score('lunch'), dinner: score('dinner') }
}

export function getCurrentMealType(hour?: number): CurrentMealTime {
  const scores = getMealTimeScores(hour)
  if (scores.breakfast >= scores.lunch && scores.breakfast >= scores.dinner) return 'breakfast'
  if (scores.lunch >= scores.dinner) return 'lunch'
  return 'dinner'
}

/**
 * 单道菜在当前时段的加权乘数 (0..1).
 * - 完全匹配当前时段: 1.0
 * - 部分匹配 (例如菜含 dinner+lunch, 当前是 lunch): 1.0
 * - 完全不匹配 (例如纯 breakfast 菜在 dinner): 0.3
 * - 未填 mealType 字段: 0.85 (温和略降, 不全压死, 给老数据兜底)
 */
export function mealTypeWeight(dish: Dish, current?: CurrentMealTime): number {
  const cur = current ?? getCurrentMealType()
  const meals = dish.mealType
  if (!meals || meals.length === 0) return 0.85

  if (meals.includes(cur as MealType)) return 1.0
  // snack 在午餐/晚餐时段降权但不至于压死, 早餐时段则可作为辅助
  if (meals.includes('snack') && cur === 'breakfast') return 0.7
  if (meals.includes('snack')) return 0.4
  // 早午/午晚相邻时段过渡
  if (cur === 'lunch' && meals.includes('breakfast')) return 0.7
  if (cur === 'dinner' && meals.includes('lunch') && !meals.includes('dinner')) return 0.6
  return 0.3
}

/**
 * 按当前时段隐式排序. 稳定排序: 先按权重, 同权重保留原顺序.
 */
export function sortByMealTime<T extends Dish>(dishes: T[], current?: CurrentMealTime): T[] {
  const cur = current ?? getCurrentMealType()
  return dishes
    .map((d, i) => ({ d, i, w: mealTypeWeight(d, cur) }))
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .map((x) => x.d)
}

/**
 * 当前时段的中文标签 + 短话术 (用于首页隐式提示, 不强制).
 * P0-2: 扩展接受 bento/snack, 供首页 5 值餐次选择器调用.
 */
export function mealTimeGreeting(current?: MealType): { label: string; hint: string } {
  const cur = current ?? getCurrentMealType()
  if (cur === 'breakfast') return { label: '早餐时段', hint: '清淡轻量的菜先给你看' }
  if (cur === 'lunch') return { label: '午餐时段', hint: '荤素汤搭配上来' }
  if (cur === 'dinner') return { label: '晚餐时段', hint: '荤素搭配,控制份量' }
  if (cur === 'bento') return { label: '便当', hint: '适合带饭、可复热的菜' }
  return { label: '加餐', hint: '轻量小食、水果、少量主食' }
}

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  bento: '便当',
  snack: '零食',
}

export const MEAL_TYPE_EMOJI: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  bento: '🍱',
  snack: '🍬',
}
