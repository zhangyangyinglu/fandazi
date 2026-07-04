// ============================================================================
// pantryStatus — P0-5 状态计算 (主档 §11.1, L475-480)
// ----------------------------------------------------------------------------
// 4 档状态:
//   fresh           — 新鲜(剩余 > 2 天)
//   use_soon        — 建议尽快吃(剩余 ≤ 2 天)
//   check_before_use — 请检查后使用(刚过最佳赏味期 ≤ 3 天)
//   past_best       — 已过最佳赏味期(超过 3 天)
// ============================================================================

import type { PantryStatus } from '../types'

const DAY_MS = 1000 * 60 * 60 * 24

/**
 * 根据购买日期和最佳赏味日期计算状态。
 * @param boughtAt     ISO 购买日期
 * @param bestBeforeAt ISO 最佳赏味日期
 */
export function calcStatus(_boughtAt: string, bestBeforeAt: string): PantryStatus {
  const now = Date.now()
  const best = new Date(bestBeforeAt).getTime()

  if (Number.isNaN(best)) return 'fresh'

  // 过了最佳赏味期
  if (now > best) {
    const daysPast = Math.floor((now - best) / DAY_MS)
    if (daysPast <= 3) return 'check_before_use'
    return 'past_best'
  }

  // 还没过,看剩余天数
  const remainingDays = Math.floor((best - now) / DAY_MS)
  if (remainingDays <= 2) return 'use_soon'
  return 'fresh'
}

/**
 * 计算距最佳赏味期的剩余天数(负数=已过)。
 */
export function calcDaysToBest(bestBeforeAt: string): number {
  const now = Date.now()
  const best = new Date(bestBeforeAt).getTime()
  if (Number.isNaN(best)) return 999
  return Math.floor((best - now) / DAY_MS)
}

/**
 * 计算已购买天数。
 */
export function calcDaysSinceBought(boughtAt: string): number {
  const now = Date.now()
  const bought = new Date(boughtAt).getTime()
  if (Number.isNaN(bought)) return 0
  return Math.floor((now - bought) / DAY_MS)
}

// ---- 展示用工具 ----

export const STATUS_LABEL: Record<PantryStatus, string> = {
  fresh: '新鲜',
  use_soon: '建议尽快吃',
  past_best: '已过最佳赏味期',
  check_before_use: '请检查后使用',
}

export const STATUS_EMOJI: Record<PantryStatus, string> = {
  fresh: '🟢',
  use_soon: '🟡',
  past_best: '🔴',
  check_before_use: '🟠',
}

/**
 * 状态 → CSS 类名(视觉基准色板对齐)
 * fresh       → accent (抹茶绿 #8a9a5b)
 * use_soon    → mili   (米粒金 #e8c266)
 * past_best   → rose   (#c8392b)
 * check_before→ quiet  (#a89c8a)
 */
export const STATUS_CSS_CLASS: Record<PantryStatus, string> = {
  fresh: 'pantry-status-fresh',
  use_soon: 'pantry-status-use-soon',
  past_best: 'pantry-status-past-best',
  check_before_use: 'pantry-status-check-before',
}

/** 状态排序权重(use_soon 最靠前,提醒用户优先处理) */
export const STATUS_SORT_ORDER: Record<PantryStatus, number> = {
  use_soon: 0,
  check_before_use: 1,
  past_best: 2,
  fresh: 3,
}
