/**
 * 健康评分（0—100）
 *
 * 依据中国居民膳食指南 2022 的核心原则做软打分，不是医疗建议。
 * 数字越大代表这盘菜在"家庭日常"维度下越均衡。
 *
 * 加分维度（每条 +3 ~ +8 分）
 *   - 高蛋白（>= 20g）
 *   - 高纤维（>= 5g）
 *   - 蔬菜量大（>= 150g）
 *   - 食材种类丰富（>= 5 种）
 *   - 包含汤菜（汤羹饱腹感强）
 *
 * 减分维度（每条 -3 ~ -10 分）
 *   - 高钠（>= 800mg）  —— 高血压风险
 *   - 高饱和脂肪（>= 10g） —— 心血管风险
 *   - 高糖（>= 15g）  —— 控糖风险
 *   - 热量过高（>= 700 kcal） —— 减脂风险
 *   - 蛋白极低（< 5g） —— 营养不均衡
 *
 * 评分封顶 100、底 0。
 */

import type { DishNutrients } from './nutrition'

export type HealthScore = {
  score: number
  reason: string
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n))

export function calcHealthScore(
  n: DishNutrients,
  ingredients: { name: string; group: string }[],
  cookMethod: string,
): HealthScore {
  let score = 70
  const ups: string[] = []
  const downs: string[] = []

  // —— 加分 ——
  if (n.protein >= 25) { score += 8; ups.push('蛋白充足') }
  else if (n.protein >= 18) { score += 5; ups.push('蛋白较好') }

  if (n.fiber >= 6) { score += 7; ups.push('纤维丰富') }
  else if (n.fiber >= 4) { score += 4; ups.push('纤维够用') }

  const vegGrams = ingredients.filter((i) => i.group === '蔬菜').length
  if (vegGrams >= 3) { score += 5; ups.push('蔬菜多样') }
  else if (vegGrams >= 2) { score += 3; ups.push('有蔬菜') }

  if (ingredients.length >= 6) { score += 3; ups.push('食材丰富') }

  if (cookMethod === '煮' || cookMethod === '炖') {
    score += 2
    ups.push('汤羹形式')
  }
  if (cookMethod === '蒸') { score += 3; ups.push('低油蒸制') }

  // —— 减分 ——
  if (n.sodium >= 1500) { score -= 12; downs.push('钠很高') }
  else if (n.sodium >= 1000) { score -= 7; downs.push('钠偏高') }
  else if (n.sodium >= 800) { score -= 4; downs.push('钠略高') }

  if (n.satFat >= 15) { score -= 10; downs.push('饱和脂肪偏高') }
  else if (n.satFat >= 10) { score -= 6; downs.push('饱和脂肪略多') }

  if (n.sugar >= 20) { score -= 8; downs.push('糖偏多') }
  else if (n.sugar >= 12) { score -= 4; downs.push('有添加糖') }

  if (n.kcal >= 700) { score -= 6; downs.push('热量偏高') }
  else if (n.kcal >= 550) { score -= 3; downs.push('热量略高') }

  if (n.protein < 5 && ingredients.length > 0) {
    score -= 5
    downs.push('蛋白偏少')
  }

  score = Math.round(clamp(score))

  // —— 生成短原因 ——
  const reasonParts: string[] = []
  if (ups.length) reasonParts.push(ups.slice(0, 2).join('、'))
  if (downs.length) reasonParts.push(downs.slice(0, 2).join('、'))
  const reason =
    reasonParts.length === 0
      ? '中规中矩'
      : reasonParts.join('；')

  return { score, reason }
}

/**
 * 把评分分成 4 档：优秀 / 良好 / 一般 / 偏弱
 * 用于 UI 颜色（但本项目用黑白灰，所以只用来决定标签）。
 */
export type ScoreBand = 'excellent' | 'good' | 'fair' | 'weak'

export function scoreBand(score: number): ScoreBand {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 55) return 'fair'
  return 'weak'
}

export const SCORE_BAND_LABEL: Record<ScoreBand, string> = {
  excellent: '优秀',
  good: '良好',
  fair: '一般',
  weak: '偏弱',
}