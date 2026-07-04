/**
 * v1.11 P0-8: 试用记录数据层(完整版)
 *
 * 设计原则:
 * - 做完弹窗的写库目标:整体评分 + per-buddy 评价 + 参与者 + 餐次 + 库存标记
 * - 写入同步触发 dishStats.recordCook(影响掌勺加权 + DesktopHome 显示)
 * - MealLog 是真相源,cookedHistory/dishStats 派生自 MealLog(写时双写)
 * - 数据兼容:旧版本 MealLog(无 mealType/participants/feedback 等字段)可正常读取,
 *   读取时缺失字段用默认值填充,不破坏既有功能
 * - 扣减库存只记 boolean 标记(P0-8),真正扣减逻辑在 P1-5
 */

import { recordCook } from './dishStats'

const STORAGE_KEY = 'fandazi:mealLogs:v1'

// ─────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'lunchbox' | 'snack'

/** per-buddy 评价等级 */
export type BuddyRating = 'love' | 'like' | 'meh' | 'dislike'

/** 不喜欢原因 */
export type DislikeReason = 'allergy' | 'health' | 'temporary' | 'taste' | 'texture' | 'other'

/** 单个搭子对这道菜的评价 */
export interface BuddyFeedback {
  buddyId: string
  rating: BuddyRating
  /** 是否愿意再吃(love/like 默认 true,meh/dislike 默认 false,用户可改) */
  wantAgain: boolean
  /** dislike 时必填原因 */
  dislikeReason?: DislikeReason
  /** 该搭子的备注(如"太咸了""下次少放油") */
  note?: string
}

export interface MealLog {
  id: string
  dishId: string
  chefId: string // 哪位搭子今日掌勺做的这道
  /** 餐次 */
  mealType: MealType
  /** 参与者 buddy IDs(谁吃了) */
  participants: string[]
  /** per-buddy 评价 */
  feedback: BuddyFeedback[]
  /** 1=不好吃 2=一般 3=不错 4=很好吃 5=绝绝子(整体口味) */
  taste: 1 | 2 | 3 | 4 | 5
  /** 1=轻松 2=正常 3=有点累 4=麻烦 5=折腾(整体难度) */
  difficulty: 1 | 2 | 3 | 4 | 5
  /** 实际烹饪时长(分钟),0 表示用户未填 */
  actualMinutes: number
  /** 备注:可写"今天少放油""下次试试不放糖" */
  note: string
  /** 是否扣减了库存(P0-8 只记标记,P1-5 实现真正扣减) */
  deductedPantry: boolean
  /** 是否使用了我家版本菜谱 */
  usedHomeVersion: boolean
  /** ISO 时间戳 */
  cookedAt: string
}

export interface MealLogInput {
  dishId: string
  chefId: string
  mealType: MealType
  participants: string[]
  feedback: BuddyFeedback[]
  taste: 1 | 2 | 3 | 4 | 5
  difficulty: 1 | 2 | 3 | 4 | 5
  actualMinutes: number
  note: string
  deductedPantry: boolean
  usedHomeVersion: boolean
}

// ─────────────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────────────

export const MEAL_LOG_CHANGE_EVENT = 'fandazi:meal-log-change'

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  lunchbox: '便当',
  snack: '加餐',
}

export const BUDDY_RATING_LABELS: Record<BuddyRating, string> = {
  love: '想再吃',
  like: '还行',
  meh: '一般',
  dislike: '不行',
}

export const BUDDY_RATING_EMOJI: Record<BuddyRating, string> = {
  love: '❤️',
  like: '👍',
  meh: '😐',
  dislike: '👎',
}

export const DISLIKE_REASON_LABELS: Record<DislikeReason, string> = {
  allergy: '过敏',
  health: '健康',
  temporary: '暂时不想吃',
  taste: '口味',
  texture: '口感',
  other: '其他',
}

// ─────────────────────────────────────────────────────────────────────
// 读写
// ─────────────────────────────────────────────────────────────────────

function uid(): string {
  return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 读取时填充缺失字段(旧版本兼容) */
function normalizeLog(raw: Partial<MealLog>): MealLog {
  return {
    id: raw.id ?? uid(),
    dishId: raw.dishId ?? '',
    chefId: raw.chefId ?? '',
    mealType: raw.mealType ?? 'dinner',
    participants: raw.participants ?? [],
    feedback: raw.feedback ?? [],
    taste: (raw.taste ?? 4) as 1 | 2 | 3 | 4 | 5,
    difficulty: (raw.difficulty ?? 2) as 1 | 2 | 3 | 4 | 5,
    actualMinutes: raw.actualMinutes ?? 0,
    note: raw.note ?? '',
    deductedPantry: raw.deductedPantry ?? false,
    usedHomeVersion: raw.usedHomeVersion ?? false,
    cookedAt: raw.cookedAt ?? new Date().toISOString(),
  }
}

export function readMealLogs(): MealLog[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeLog)
  } catch {
    return []
  }
}

function writeMealLogs(logs: MealLog[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs))
    window.dispatchEvent(new CustomEvent(MEAL_LOG_CHANGE_EVENT, { detail: { count: logs.length } }))
  } catch {
    // 忽略容量等异常,不阻断 UI
  }
}

/**
 * 写一条做完记录;同步触发 dishStats.recordCook(影响掌勺加权)
 */
export function addMealLog(input: MealLogInput): MealLog {
  const log: MealLog = {
    id: uid(),
    ...input,
    cookedAt: new Date().toISOString(),
  }
  const all = readMealLogs()
  all.unshift(log) // 新的在最前
  writeMealLogs(all)
  // 同步触发既有 +1 计数
  recordCook(input.dishId)
  return log
}

// ─────────────────────────────────────────────────────────────────────
// 查询函数
// ─────────────────────────────────────────────────────────────────────

/** 查询某道菜的所有 log(按时间倒序) */
export function getLogsForDish(dishId: string): MealLog[] {
  return readMealLogs().filter((l) => l.dishId === dishId)
}

/** 该菜的平均口味分(用户视角真实评分) */
export function getDishAverageTaste(dishId: string): number | null {
  const logs = getLogsForDish(dishId)
  if (logs.length === 0) return null
  const sum = logs.reduce((acc, l) => acc + l.taste, 0)
  return Math.round((sum / logs.length) * 10) / 10
}

/** 总记录数,用于"我家的味道"统计入口 */
export function getMealLogCount(): number {
  return readMealLogs().length
}

/** 某 chef 做的所有 log(后续"他的拿手菜"用) */
export function getLogsByChef(chefId: string): MealLog[] {
  return readMealLogs().filter((l) => l.chefId === chefId)
}

/** 某搭子参与的所有 log(谁吃了) */
export function getLogsByBuddy(buddyId: string): MealLog[] {
  return readMealLogs().filter((l) => l.participants.includes(buddyId))
}

/** 按餐次筛选 */
export function getLogsByMealType(mealType: MealType): MealLog[] {
  return readMealLogs().filter((l) => l.mealType === mealType)
}

/** 查找某搭子给了特定评分的 log */
export function getLogsByBuddyRating(buddyId: string, rating: BuddyRating): MealLog[] {
  return readMealLogs().filter((l) =>
    l.feedback.some((f) => f.buddyId === buddyId && f.rating === rating),
  )
}

/** 某搭子喜欢的菜(love 或 like) */
export function getBuddyFavoriteDishIds(buddyId: string): string[] {
  return readMealLogs()
    .filter((l) => l.feedback.some((f) => f.buddyId === buddyId && (f.rating === 'love' || f.rating === 'like')))
    .map((l) => l.dishId)
}

/** 某搭子不喜欢的菜(dislike) */
export function getBuddyDislikedDishIds(buddyId: string): string[] {
  return readMealLogs()
    .filter((l) => l.feedback.some((f) => f.buddyId === buddyId && f.rating === 'dislike'))
    .map((l) => l.dishId)
}
