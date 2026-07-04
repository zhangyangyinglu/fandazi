/**
 * v1.10 真实「搭子都爱吃」数据层
 * --------------------------------------------------
 * 数据模型:
 *   localStorage['fandazi.dishStats'] = JSON.stringify({
 *     [dishId]: { cooked: number, lastCookedAt: number, rating?: number }
 *   })
 *
 * 定位:
 * - 前端只读 / 写本地;不调任何 API。
 * - 桌面首页「搭子都爱吃」按 cooked DESC + 最近做过 DESC 排序。
 * - 卡片提供「+1 已做」入口,用户实时看到顺序变化,验证真接入闭环。
 */

import type { Dish } from '../types'

export type DishStat = {
  cooked: number
  lastCookedAt: number
  rating?: number
}

export type DishStatsMap = Record<string, DishStat>

const STORAGE_KEY = 'fandazi.dishStats'
const CHANGE_EVENT = 'fandazi:dish-stats-changed'

export function readDishStats(): DishStatsMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const clean: DishStatsMap = {}
    for (const [id, val] of Object.entries(parsed)) {
      if (val && typeof val === 'object') {
        const v = val as Partial<DishStat>
        const cooked = typeof v.cooked === 'number' && v.cooked >= 0 ? v.cooked : 0
        const lastCookedAt = typeof v.lastCookedAt === 'number' ? v.lastCookedAt : 0
        const rating = typeof v.rating === 'number' ? v.rating : undefined
        clean[id] = { cooked, lastCookedAt, rating }
      }
    }
    return clean
  } catch {
    return {}
  }
}

function writeDishStats(map: DishStatsMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { source: 'writeDishStats' } }))
  } catch {
    // 隐私模式 / 配额:静默降级
  }
}

export function getDishStat(dishId: string): DishStat {
  const all = readDishStats()
  return all[dishId] ?? { cooked: 0, lastCookedAt: 0 }
}

export function recordCook(dishId: string): DishStat {
  const all = readDishStats()
  const prev = all[dishId] ?? { cooked: 0, lastCookedAt: 0 }
  const next: DishStat = {
    cooked: prev.cooked + 1,
    lastCookedAt: Date.now(),
    rating: prev.rating,
  }
  all[dishId] = next
  writeDishStats(all)
  return next
}

export function rateDish(dishId: string, rating: number): DishStat {
  const safe = Math.max(0, Math.min(5, rating))
  const all = readDishStats()
  const prev = all[dishId] ?? { cooked: 0, lastCookedAt: 0 }
  const next: DishStat = { ...prev, rating: safe }
  all[dishId] = next
  writeDishStats(all)
  return next
}

export function resetDishStats(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { source: 'reset' } }))
  } catch {
    // ignore
  }
}

/**
 * 「搭子都爱吃」核心排序:
 * 1. cooked >= 1 的菜按 cooked DESC,同 cooked 看 lastCookedAt DESC
 * 2. 不足 n 时用 fallback 经典菜补齐(避免空首屏)
 */
const FALLBACK_BELOVED = [
  '红烧肉', '可乐鸡翅', '清蒸鲈鱼', '鱼香茄子',
  '番茄炒蛋', '宫保鸡丁', '糖醋里脊', '麻婆豆腐',
]

export function getTopFamilyFavorites(dishes: Dish[], n = 4): Dish[] {
  const stats = readDishStats()
  const cooked = dishes
    .map((d) => ({ dish: d, stat: stats[d.id] }))
    .filter((x) => x.stat && x.stat.cooked > 0)
    .sort((a, b) => {
      const dc = (b.stat?.cooked ?? 0) - (a.stat?.cooked ?? 0)
      if (dc !== 0) return dc
      return (b.stat?.lastCookedAt ?? 0) - (a.stat?.lastCookedAt ?? 0)
    })
    .map((x) => x.dish)

  if (cooked.length >= n) return cooked.slice(0, n)

  const need = n - cooked.length
  const usedIds = new Set(cooked.map((d) => d.id))
  const fallback = dishes
    .filter((d) => !usedIds.has(d.id))
    .sort((a, b) => {
      const ai = FALLBACK_BELOVED.findIndex((name) => a.name.includes(name))
      const bi = FALLBACK_BELOVED.findIndex((name) => b.name.includes(name))
      const aRank = ai === -1 ? FALLBACK_BELOVED.length : ai
      const bRank = bi === -1 ? FALLBACK_BELOVED.length : bi
      return aRank - bRank
    })
    .slice(0, need)

  return [...cooked, ...fallback]
}

export const DISH_STATS_CHANGE_EVENT = CHANGE_EVENT
