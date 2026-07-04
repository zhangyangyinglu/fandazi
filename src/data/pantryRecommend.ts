/**
 * 食材反向推荐
 *
 * 思路：用户输入冰箱里已有的食材 → 列出所有能用上其中至少 1 种食材的菜，按匹配度排序。
 * 匹配度 = 命中食材数 / 菜谱总食材数，越高表示这道菜越接近"全靠现有食材就能做"。
 *
 * 用法：配合现有"今天吃什么"推荐 Drawer 使用，作为第二种模式。
 *
 * 第一版用精确匹配（trim + ignoreCase）。后续如果需要"西红柿 ≈ 番茄"这种同义词，
 * 可以在 normalizeIngredientName 里加一张同义词表，不用改算法。
 */

import type { Dish, PantryItem, PantryStatus } from '../types'
import { calcStatus, calcDaysToBest } from './pantryStatus'

export type PantryRecommendInput = {
  /** 用户输入的食材名数组，比如 ["鸡蛋", "番茄", "葱"] */
  pantryItems: string[]
  /** 候选菜库 */
  candidateDishes: Dish[]
}

export type PantryMatchedDish = {
  dish: Dish
  /** 这道菜命中的食材名（出现在用户 pantryItems 里的） */
  matchedIngredients: string[]
  /** 匹配度 0~1，命中食材数 / 菜谱食材总数 */
  matchRatio: number
}

export type PantryRecommendResult = {
  matches: PantryMatchedDish[]
  /** 用户输入的食材里，没有任何一道菜用上的部分（兜底提示） */
  unmatchedPantryItems: string[]
  /** 命中食材最多的前几道菜的命中食材数（用于 UI 展示 "X/Y 道菜命中"） */
  totalCandidateCount: number
  matchedCandidateCount: number
}

function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * 按食材匹配度推荐菜品
 */
export function recommendByPantry(input: PantryRecommendInput): PantryRecommendResult {
  const { pantryItems, candidateDishes } = input
  const pantrySet = new Set(pantryItems.map(normalizeIngredientName).filter((s) => s.length > 0))

  if (pantrySet.size === 0) {
    return {
      matches: [],
      unmatchedPantryItems: [],
      totalCandidateCount: candidateDishes.length,
      matchedCandidateCount: 0,
    }
  }

  // 找出每道菜的命中食材
  const matches: PantryMatchedDish[] = []
  const usedPantryNames = new Set<string>()

  for (const dish of candidateDishes) {
    if (dish.ingredients.length === 0) continue
    const matchedNames: string[] = []
    for (const ing of dish.ingredients) {
      if (pantrySet.has(normalizeIngredientName(ing.name))) {
        matchedNames.push(ing.name)
        usedPantryNames.add(normalizeIngredientName(ing.name))
      }
    }
    if (matchedNames.length === 0) continue
    matches.push({
      dish,
      matchedIngredients: matchedNames,
      matchRatio: matchedNames.length / dish.ingredients.length,
    })
  }

  // 排序：先按匹配度，再按命中数，最后按菜名（稳定排序）
  matches.sort((a, b) => {
    if (b.matchRatio !== a.matchRatio) return b.matchRatio - a.matchRatio
    if (b.matchedIngredients.length !== a.matchedIngredients.length) {
      return b.matchedIngredients.length - a.matchedIngredients.length
    }
    return a.dish.name.localeCompare(b.dish.name, 'zh-Hans-CN')
  })

  // 用户输入但没任何菜用上的食材
  const unmatchedPantryItems = pantryItems.filter(
    (name) => !usedPantryNames.has(normalizeIngredientName(name)),
  )

  return {
    matches,
    unmatchedPantryItems,
    totalCandidateCount: candidateDishes.length,
    matchedCandidateCount: matches.length,
  }
}

/**
 * 提取一道菜里"还需要买"的食材（即未在 pantryItems 中命中的食材）
 * 给 UI 用："用你的食材能做 X 个，还差 Y 个"
 */
export function missingIngredientsForDish(dish: Dish, pantryItems: string[]): string[] {
  const pantrySet = new Set(pantryItems.map(normalizeIngredientName))
  return dish.ingredients
    .filter((ing) => !pantrySet.has(normalizeIngredientName(ing.name)))
    .map((ing) => ing.name)
}

// ============================================================================
// P1-3: 快赏味期推荐
// ============================================================================

export type ExpiringRecommendResult = {
  /** 快过期食材列表 */
  expiringItems: Array<{
    ingredientName: string
    daysLeft: number
    status: PantryStatus
  }>
  /** 推荐菜品(按命中快过期食材数排序,最多 6 道) */
  recommendations: Array<{
    dish: Dish
    matchedExpiringIngredients: string[]
    matchRatio: number
  }>
}

/**
 * P1-3: 根据快过期食材推荐菜品
 * @param pantryItems 库存列表
 * @param candidateDishes 候选菜库
 * @param thresholdDays 临近阈值(默认 3 天内,含已过期 7 天内)
 */
export function recommendByExpiringSoon(
  pantryItems: PantryItem[],
  candidateDishes: Dish[],
  thresholdDays = 3,
): ExpiringRecommendResult {
  // 找出快过期食材(阈值天内 + 已过期 7 天内)
  const expiringItems = pantryItems
    .map((item) => ({
      ingredientName: item.ingredientName,
      daysLeft: calcDaysToBest(item.bestBeforeAt),
      status: calcStatus(item.boughtAt, item.bestBeforeAt),
    }))
    .filter((item) => item.daysLeft <= thresholdDays && item.daysLeft >= -7)

  if (expiringItems.length === 0) {
    return { expiringItems: [], recommendations: [] }
  }

  const expiringNames = new Set(
    expiringItems.map((e) => normalizeIngredientName(e.ingredientName)),
  )

  // 找出用到快过期食材的菜品
  const recommendations = candidateDishes
    .map((dish) => {
      const matched = dish.ingredients.filter((ing) =>
        expiringNames.has(normalizeIngredientName(ing.name)),
      )
      return {
        dish,
        matchedExpiringIngredients: matched.map((ing) => ing.name),
        matchRatio: matched.length / Math.max(1, dish.ingredients.length),
      }
    })
    .filter((r) => r.matchedExpiringIngredients.length > 0)
    .sort((a, b) => {
      if (b.matchedExpiringIngredients.length !== a.matchedExpiringIngredients.length) {
        return b.matchedExpiringIngredients.length - a.matchedExpiringIngredients.length
      }
      return b.matchRatio - a.matchRatio
    })
    .slice(0, 6)

  return { expiringItems, recommendations }
}