/**
 * v1.11 P1-2: 计划状态数据层 (6 档)
 *
 * 设计原则:
 * - MealPlan 自动从 tableDishIds 派生——加菜到餐桌 = 创建 MealPlan(status='planned')
 * - 6 档状态:planned → shopping_done → cooking → done / skipped / favorited
 * - 按 planDate(YYYY-MM-DD) 隔离每日计划
 * - 跨日不清理——历史计划保留用于回顾
 */

import type { MealPlan, PlanStatus } from '../types'
import { MEAL_PLAN_STORAGE_KEY, MEAL_PLAN_CHANGE_EVENT } from '../types'

// ─────────────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────────────

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  planned: '计划中',
  shopping_done: '采购完成',
  cooking: '烹饪中',
  done: '已完成',
  skipped: '已跳过',
  favorited: '想再做',
}

export const PLAN_STATUS_EMOJI: Record<PlanStatus, string> = {
  planned: '📋',
  shopping_done: '🛒',
  cooking: '🔥',
  done: '✅',
  skipped: '⏭️',
  favorited: '⭐',
}

/** 状态流转顺序(用于 UI 排序) */
export const PLAN_STATUS_ORDER: PlanStatus[] = [
  'planned', 'shopping_done', 'cooking', 'done', 'favorited', 'skipped',
]

// ─────────────────────────────────────────────────────────────────────
// 读写
// ─────────────────────────────────────────────────────────────────────

function uid(): string {
  return `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function readMealPlans(): MealPlan[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(MEAL_PLAN_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function writeMealPlans(plans: MealPlan[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MEAL_PLAN_STORAGE_KEY, JSON.stringify(plans))
    window.dispatchEvent(
      new CustomEvent(MEAL_PLAN_CHANGE_EVENT, { detail: { count: plans.length } }),
    )
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────────────
// 业务函数
// ─────────────────────────────────────────────────────────────────────

/**
 * 确保某道菜有今日 MealPlan(不存在则创建 planned)
 */
export function ensureMealPlan(dishId: string): MealPlan {
  const plans = readMealPlans()
  const today = todayStr()
  const existing = plans.find((p) => p.dishId === dishId && p.planDate === today)
  if (existing) return existing

  const now = new Date().toISOString()
  const plan: MealPlan = {
    id: uid(),
    dishId,
    status: 'planned',
    planDate: today,
    createdAt: now,
    updatedAt: now,
  }
  plans.unshift(plan)
  writeMealPlans(plans)
  return plan
}

/** 批量确保(加菜到餐桌时用) */
export function ensureMealPlans(dishIds: string[]): void {
  for (const dishId of dishIds) {
    ensureMealPlan(dishId)
  }
}

/**
 * 更新某道菜今日的计划状态
 * 不存在时自动创建
 */
export function updatePlanStatus(dishId: string, status: PlanStatus): MealPlan | null {
  const plans = readMealPlans()
  const today = todayStr()
  const idx = plans.findIndex((p) => p.dishId === dishId && p.planDate === today)

  if (idx === -1) {
    const now = new Date().toISOString()
    const plan: MealPlan = {
      id: uid(),
      dishId,
      status,
      planDate: today,
      createdAt: now,
      updatedAt: now,
    }
    plans.unshift(plan)
    writeMealPlans(plans)
    return plan
  }

  plans[idx].status = status
  plans[idx].updatedAt = new Date().toISOString()
  writeMealPlans(plans)
  return plans[idx]
}

/** 获取某道菜今日的计划状态 */
export function getPlanStatus(dishId: string): PlanStatus | null {
  const plans = readMealPlans()
  const today = todayStr()
  const plan = plans.find((p) => p.dishId === dishId && p.planDate === today)
  return plan?.status ?? null
}

/** 获取今日所有计划 */
export function getTodayMealPlans(): MealPlan[] {
  const plans = readMealPlans()
  const today = todayStr()
  return plans.filter((p) => p.planDate === today)
}

/** 今日某状态的计划数 */
export function countTodayByStatus(status: PlanStatus): number {
  return getTodayMealPlans().filter((p) => p.status === status).length
}
