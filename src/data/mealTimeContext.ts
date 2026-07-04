/**
 * v1.11 阶段 1B: 时段隐式推荐工具
 *
 * 设计 (Q1=A 拍板, 2026-06-25):
 * - 字段层完整存在 (Dish.mealType 5 维) → 推荐排序按当前时段隐式加权
 * - UI 层不做强制餐次入口 → 早晨打开首页, 红烧排骨自然降权, 不会跳出来
 * - 时段映射: 6-10 早餐 / 10-15 午餐 / 15-21 晚餐 / 21+/0-6 夜宵→晚餐回退
 *
 * 用法:
 *   const meal = getCurrentMealType()       // 'breakfast' | 'lunch' | 'dinner'
 *   const weight = mealTypeWeight(dish, meal)  // 0..1 加权乘数, 用于现有排序
 *   const sorted = sortByMealTime(dishes)   // 直接按当前时段排序的便捷封装
 */

import type { Dish, MealType } from '../types'

export type CurrentMealTime = 'breakfast' | 'lunch' | 'dinner'

/**
 * 根据当前小时拿对应餐次. 测试时可传入小时数.
 * 6-10 早 / 10-15 午 / 15-21 晚 / 21+ 或 0-6 晚 (避免凌晨 3 点弹早餐粥)
 */
export function getCurrentMealType(hour?: number): CurrentMealTime {
  const h = hour ?? new Date().getHours()
  if (h >= 6 && h < 10) return 'breakfast'
  if (h >= 10 && h < 15) return 'lunch'
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
