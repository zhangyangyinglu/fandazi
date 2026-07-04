// ============================================================================
// pantryReminders — P0-5/6 温和文案生成 (主档 §11.2, L482-498)
// ----------------------------------------------------------------------------
// 文案风格:温和、生活化、有陪伴感
// 推荐:"这把青菜已经放了 5 天,可能不够脆了。今天要不要优先安排一道青菜?"
// 避免:"青菜已经坏了""这个不能吃了""食材过期,禁止使用"
// ============================================================================

import type { PantryItem } from '../types'
import { calcStatus, calcDaysSinceBought, calcDaysToBest } from './pantryStatus'

/**
 * 为单个库存项生成提醒文案。
 */
export function generateReminder(item: PantryItem): string {
  const status = calcStatus(item.boughtAt, item.bestBeforeAt)
  const daysBought = calcDaysSinceBought(item.boughtAt)
  const daysToBest = calcDaysToBest(item.bestBeforeAt)
  const name = item.ingredientName

  switch (status) {
    case 'fresh':
      if (daysBought === 0) {
        return `${name}刚买回来,还很新鲜,可以慢慢安排。`
      }
      return `${name}买了 ${daysBought} 天了,还很新鲜。`

    case 'use_soon':
      if (daysToBest === 0) {
        return `${name}今天就是最佳赏味期了,适合今天顺手用掉。`
      }
      if (daysToBest === 1) {
        return `${name}还剩 1 天就到最佳赏味期了,今天要不要优先安排一道?`
      }
      return `${name}快到最佳赏味期了,还剩 ${daysToBest} 天,适合今天顺手加进菜里。`

    case 'check_before_use':
      return `${name}刚过最佳赏味期,检查一下状态,没问题就今天用掉吧。`

    case 'past_best':
      return `${name}已经放了 ${daysBought} 天,可能过了最佳赏味期了。建议检查后再决定要不要用。`
  }
}

/**
 * 为一批库存项生成汇总提醒(首页/库存页顶部用)。
 * 只取 use_soon / check_before_use / past_best 状态的项。
 */
export function generateSummaryReminder(items: PantryItem[]): string | null {
  const urgent = items.filter((item) => {
    const s = calcStatus(item.boughtAt, item.bestBeforeAt)
    return s !== 'fresh'
  })

  if (urgent.length === 0) return null

  // 优先级:use_soon > check_before_use > past_best
  const useSoon = urgent.filter(
    (i) => calcStatus(i.boughtAt, i.bestBeforeAt) === 'use_soon',
  )
  if (useSoon.length > 0) {
    const names = useSoon.slice(0, 3).map((i) => i.ingredientName).join('、')
    if (useSoon.length === 1) {
      return `${names}快到最佳赏味期了,今天要不要优先安排一道?`
    }
    return `${names}等 ${useSoon.length} 样食材快到最佳赏味期了,今天优先用掉吧。`
  }

  const checkBefore = urgent.filter(
    (i) => calcStatus(i.boughtAt, i.bestBeforeAt) === 'check_before_use',
  )
  if (checkBefore.length > 0) {
    const names = checkBefore.slice(0, 3).map((i) => i.ingredientName).join('、')
    return `${names}刚过最佳赏味期,检查一下,没问题就今天用掉。`
  }

  const pastBest = urgent.filter(
    (i) => calcStatus(i.boughtAt, i.bestBeforeAt) === 'past_best',
  )
  if (pastBest.length > 0) {
    const names = pastBest.slice(0, 3).map((i) => i.ingredientName).join('、')
    return `${names}已经过了最佳赏味期,建议检查后再决定。`
  }

  return null
}
