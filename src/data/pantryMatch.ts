// ============================================================================
// pantryMatch — P0-7 菜谱详情页库存匹配引擎
// ----------------------------------------------------------------------------
// 组合 amountParser + unitConversion + ingredientSubstitutes
// 对菜谱每个食材:
//   1. 精确名匹配(含同义词归一化)
//   2. 数量比较(同单位直接比,不同单位换算到克再比)
//   3. 替代匹配(同子类互替)
// 输出每项的匹配状态 + 缺多少 + 可用替代
// ============================================================================

import type { Ingredient, PantryItem } from '../types'
import { parseAmount } from './amountParser'
import { compareAmounts, convertToGrams } from './unitConversion'
import {
  normalizeIngredientName,
  findSubstitutes,
} from './ingredientSubstitutes'
import { calcStatus } from './pantryStatus'

// ------------------------------------------------------------------ types

export type IngredientMatchLevel = 'exact' | 'substitute' | 'missing' | 'vague'

export interface IngredientMatchResult {
  /** 菜谱食材 */
  ingredient: Ingredient
  /** 匹配等级 */
  level: IngredientMatchLevel
  /** 匹配到的库存项(exact/substitute 时有值) */
  matchedPantryItem: PantryItem | null
  /** 替代来源库存项列表(substitute 时有值) */
  substituteItems: PantryItem[]
  /** 菜谱需要的数量(parsed) */
  needAmount: { value: number | null; unit: string | null; raw: string }
  /** 库存已有的数量(exact/substitute 时有值) */
  haveAmount: { value: number; unit: string } | null
  /** 缺多少(数值;0=不缺;null=无法计算) */
  shortage: number | null
  /** 缺多少的展示文案 */
  shortageText: string
  /** 面向用户的说明文案 */
  hint: string
}

export interface DishMatchSummary {
  /** 逐项匹配结果 */
  results: IngredientMatchResult[]
  /** 统计 */
  stats: {
    exact: number
    substitute: number
    missing: number
    vague: number
    total: number
  }
  /** 一句话总结 */
  summaryText: string
  /** 缺的食材列表(购物参考) */
  missingList: string[]
}

// ------------------------------------------------------------------ core

/**
 * 对单道菜的全部食材进行库存匹配。
 */
export function matchDishIngredients(
  ingredients: Ingredient[],
  pantryItems: PantryItem[],
): DishMatchSummary {
  const results = ingredients.map((ing) =>
    matchSingleIngredient(ing, pantryItems),
  )

  const stats = {
    exact: results.filter((r) => r.level === 'exact').length,
    substitute: results.filter((r) => r.level === 'substitute').length,
    missing: results.filter((r) => r.level === 'missing').length,
    vague: results.filter((r) => r.level === 'vague').length,
    total: results.length,
  }

  const missingList = results
    .filter((r) => r.level === 'missing')
    .map((r) => r.ingredient.name)

  const summaryText = buildSummaryText(stats)

  return { results, stats, summaryText, missingList }
}

/**
 * 对单个食材进行库存匹配。
 */
export function matchSingleIngredient(
  ingredient: Ingredient,
  pantryItems: PantryItem[],
): IngredientMatchResult {
  const needAmount = parseAmount(ingredient.amount)

  // 1. 精确名匹配(含同义词归一化)
  const normalizedTarget = normalizeIngredientName(ingredient.name)
  const exactMatch = pantryItems.find((item) => {
    const normalizedItem = normalizeIngredientName(item.ingredientName)
    return normalizedItem === normalizedTarget
  })

  if (exactMatch) {
    return buildExactResult(ingredient, exactMatch, needAmount)
  }

  // 2. 替代匹配
  const substitutes = findSubstitutes(ingredient.name, pantryItems)
  if (substitutes.length > 0) {
    // 优先取状态最好的替代(fresh > use_soon > ...)
    const sortedSubs = substitutes.sort((a, b) => {
      const sa = calcStatus(a.boughtAt, a.bestBeforeAt)
      const sb = calcStatus(b.boughtAt, b.bestBeforeAt)
      const order = { fresh: 0, use_soon: 1, check_before_use: 2, past_best: 3 }
      return order[sa] - order[sb]
    })
    return buildSubstituteResult(ingredient, sortedSubs, needAmount)
  }

  // 3. 适量/无法量化
  if (needAmount.value === null) {
    return {
      ingredient,
      level: 'vague',
      matchedPantryItem: null,
      substituteItems: [],
      needAmount,
      haveAmount: null,
      shortage: null,
      shortageText: '',
      hint: '菜谱写「适量」,按口味调整即可',
    }
  }

  // 4. 缺失
  return {
    ingredient,
    level: 'missing',
    matchedPantryItem: null,
    substituteItems: [],
    needAmount,
    haveAmount: null,
    shortage: needAmount.value,
    shortageText: `缺 ${needAmount.value}${needAmount.unit ?? ''}`,
    hint: `库存中没有${ingredient.name}`,
  }
}

// ------------------------------------------------------------------ builders

function buildExactResult(
  ingredient: Ingredient,
  pantryItem: PantryItem,
  needAmount: { value: number | null; unit: string | null; raw: string },
): IngredientMatchResult {
  const haveValue = pantryItem.quantity
  const haveUnit = pantryItem.unit

  // 菜谱写"适量"等无法量化的
  if (needAmount.value === null) {
    return {
      ingredient,
      level: 'exact',
      matchedPantryItem: pantryItem,
      substituteItems: [],
      needAmount,
      haveAmount: { value: haveValue, unit: haveUnit },
      shortage: null,
      shortageText: '',
      hint: `库存有${pantryItem.ingredientName} ${haveValue}${haveUnit}`,
    }
  }

  const needValue = needAmount.value
  const needUnit = needAmount.unit ?? '克'

  // 同单位直接比
  if (haveUnit === needUnit) {
    const shortage = Math.max(0, needValue - haveValue)
    return {
      ingredient,
      level: 'exact',
      matchedPantryItem: pantryItem,
      substituteItems: [],
      needAmount,
      haveAmount: { value: haveValue, unit: haveUnit },
      shortage,
      shortageText:
        shortage > 0
          ? `已有 ${haveValue}${haveUnit},还差 ${shortage}${needUnit}`
          : `已有 ${haveValue}${haveUnit},够用`,
      hint:
        shortage > 0
          ? `库存有 ${haveValue}${haveUnit},菜谱需要 ${needValue}${needUnit},还差 ${shortage}${needUnit}`
          : `库存充足`,
    }
  }

  // 不同单位换算到克
  const comparison = compareAmounts(
    ingredient.name,
    haveValue,
    haveUnit,
    needValue,
    needUnit,
  )

  if (comparison) {
    const shortage = Math.max(0, comparison.needGrams - comparison.haveGrams)
    const shortageInNeedUnit =
      needUnit === '克'
        ? shortage
        : shortage / (convertToGrams(ingredient.name, 1, needUnit) ?? 1)
    return {
      ingredient,
      level: 'exact',
      matchedPantryItem: pantryItem,
      substituteItems: [],
      needAmount,
      haveAmount: { value: haveValue, unit: haveUnit },
      shortage,
      shortageText:
        shortage > 0
          ? `已有 ${haveValue}${haveUnit}(≈${Math.round(comparison.haveGrams)}克),还差约 ${Math.round(shortageInNeedUnit)}${needUnit}`
          : `已有 ${haveValue}${haveUnit}(≈${Math.round(comparison.haveGrams)}克),够用`,
      hint:
        shortage > 0
          ? `库存有 ${haveValue}${haveUnit}(≈${Math.round(comparison.haveGrams)}克),菜谱需要 ${needValue}${needUnit}(≈${Math.round(comparison.needGrams)}克),换算后还差约 ${Math.round(shortage)}克`
          : `库存充足(换算后 ${Math.round(comparison.haveGrams)}克 ≥ 需要 ${Math.round(comparison.needGrams)}克)`,
    }
  }

  // 无法换算(单位不在表中)
  return {
    ingredient,
    level: 'exact',
    matchedPantryItem: pantryItem,
    substituteItems: [],
    needAmount,
    haveAmount: { value: haveValue, unit: haveUnit },
    shortage: null,
    shortageText: `已有 ${haveValue}${haveUnit},菜谱需要 ${needValue}${needUnit}`,
    hint: `库存有 ${haveValue}${haveUnit},菜谱需要 ${needValue}${needUnit}(单位不同,请按需调整)`,
  }
}

function buildSubstituteResult(
  ingredient: Ingredient,
  substitutes: PantryItem[],
  needAmount: { value: number | null; unit: string | null; raw: string },
): IngredientMatchResult {
  const best = substitutes[0]
  const subNames = substitutes
    .slice(0, 3)
    .map((s) => s.ingredientName)
    .join('、')

  return {
    ingredient,
    level: 'substitute',
    matchedPantryItem: null,
    substituteItems: substitutes,
    needAmount,
    haveAmount: { value: best.quantity, unit: best.unit },
    shortage: null,
    shortageText: '',
    hint: `可用库存中的 ${subNames} 替代`,
  }
}

function buildSummaryText(
  stats: DishMatchSummary['stats'],
): string {
  const { exact, substitute, missing, vague, total } = stats

  if (missing === 0 && vague === total) {
    return '食材按口味调整即可'
  }

  const parts: string[] = []
  if (exact > 0) parts.push(`${exact} 种有库存`)
  if (substitute > 0) parts.push(`${substitute} 种可替代`)
  if (missing > 0) parts.push(`缺 ${missing} 种`)
  if (vague > 0) parts.push(`${vague} 种按口味`)

  return parts.join('，') || '全部齐了'
}
