/**
 * 一桌菜推荐引擎
 *
 * 输入：用户选的"餐次" + 当前可选菜库 + 食材库已有食材
 * 输出：1-5 道菜的组合（按人数动态调整）+ 合计营养 + 推荐理由
 *
 * 算法（贪心 + 多样性随机）：
 * 1. 按餐次过滤候选：早 → 主食/汤羹；午 → 主食+荤+素；晚 → 荤+素+汤
 * 2. 候选评分：
 *    - 高蛋白加 +1（午餐/晚餐想要吃得有饱腹感）
 *    - 含有食材库已有材料的菜 +0.5（少跑一趟超市）
 *    - 烹饪方式多样性加 +1（避免连续 2 道都"炒"）
 * 3. 营养约束：总热量在目标区间（按人数缩放，1人份 早 280-480 / 午 550-800 / 晚 380-650）
 * 4. 兜底：候选不足时降级规则
 */

import type { Dish } from '../types'
import { sumDishNutrients, type DishNutrients } from './nutrition'
import type { BuddyGroup, BuddyMember } from './familySharing'
import type { DishPreferences } from './dishPreferences'
import type { HealthProfile } from '@/components/healthProfileStorage'
import { scoreDishByHealthProfiles, checkPlateStructure } from './healthRecommend'

/**
 * v1.11: 提取菜品的主要蛋白质食材类型，用于推荐去重。
 * 从 ingredients 的 group='肉蛋' 中取第一个，归一化为大类（鱼/鸡/猪/牛/虾/蛋/豆腐...）。
 * 返回 null 表示没有明显蛋白质主料（素菜/汤羹等）。
 */
const PROTEIN_KEYWORDS: [string, string][] = [
  ['鱼', '鱼'], ['鲈', '鱼'], ['鳕', '鱼'], ['三文鱼', '鱼'], ['带鱼', '鱼'], ['黄鱼', '鱼'], ['鲳', '鱼'], ['鲫', '鱼'], ['鳗', '鱼'], ['鱿鱼', '鱼'], ['墨鱼', '鱼'],
  ['鸡', '禽类'], ['鸭', '禽类'], ['鹅', '禽类'], ['鸽', '禽类'],
  ['猪', '猪肉'], ['排骨', '猪肉'], ['五花', '猪肉'], ['瘦肉', '猪肉'], ['里脊', '猪肉'], ['肉末', '猪肉'], ['肉糜', '猪肉'], ['腊肉', '猪肉'], ['火腿', '猪肉'],
  ['牛', '牛羊'], ['肥牛', '牛羊'], ['牛肉', '牛羊'], ['羊', '牛羊'],
  ['虾', '海鲜'], ['虾仁', '海鲜'], ['海蛎', '海鲜'], ['蟹', '海鲜'], ['贝', '海鲜'], ['蛤', '海鲜'], ['扇贝', '海鲜'], ['牡蛎', '海鲜'],
  ['豆腐', '豆制品'], ['豆干', '豆制品'], ['腐竹', '豆制品'], ['豆皮', '豆制品'],
  ['蛋', '蛋'], ['鸡蛋', '蛋'],
]
function getProteinType(dish: Dish): string | null {
  const meatIngredients = dish.ingredients.filter((i) => i.group === '肉蛋')
  for (const ing of meatIngredients) {
    for (const [keyword, type] of PROTEIN_KEYWORDS) {
      if (ing.name.includes(keyword)) return type
    }
  }
  // 也检查菜名（有些菜名直接含主料）
  for (const [keyword, type] of PROTEIN_KEYWORDS) {
    if (dish.name.includes(keyword)) return type
  }
  return null
}
import { getCurrentMealType, mealTypeWeight, type CurrentMealTime } from './mealTimeContext'

export type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'bento' | 'snack'

export type RecommendInput = {
  mealTime: MealTime
  pantryItems: string[]
  candidateDishes: Dish[]
  excludeDishIds?: string[]
  seed?: number
  /** v1.11 阶段 2: 今日掌勺 + 饭搭子偏好加权(可选,向后兼容) */
  buddyGroup?: BuddyGroup
  memberPreferences?: Record<string, DishPreferences>
  /** 时段隐式加权:不传则按 mealTime 推断,等同于"和 mealTime 一致" */
  currentMealType?: CurrentMealTime
  /** 用餐人数（动态推荐数量依据，默认 2） */
  familySize?: number
  /** v1.11: 强制推荐指定数量（用于首页固定展示 4 道等场景，覆盖 snack 的 1 道限制） */
  forceCount?: number
  /** 健康档案（2026 膳食指南 + 个人约束） */
  healthProfiles?: HealthProfile[]
}

export type RecommendResult = {
  dishes: Dish[]
  totalNutrition: DishNutrients
  reason: string
  pantryCoverage: number // 0~1，已经在食材库的食材占总食材的比例
  pantryIngredientCount: number // 已经在食材库的具体数量（用于散文文案："已有 X 样"）
  pantryIngredientTotal: number // 这一桌菜涉及的总食材数（去重后）
  /** P0-3: 每道菜的推荐理由(偏好+营养+食材,≤4行) */
  perDishReasons: Record<string, string[]>
  /** P0-3: 有搭子意见分歧的菜 id */
  disagreementDishIds: string[]
  /** 2026 膳食指南餐盘结构缺口 */
  plateGaps: string[]
  /** 健康档案约束命中的理由（供 UI 展示） */
  healthReasons: string[]
}

/**
 * P0-3: 计算距今天数(用于"暂时不想吃"时间衰减)
 * 无时间戳或解析失败 → Infinity(视为很久以前,不衰减)
 */
function daysSince(isoDate: string | undefined): number {
  if (!isoDate) return Infinity
  const t = new Date(isoDate).getTime()
  if (isNaN(t)) return Infinity
  return (Date.now() - t) / 86_400_000
}

/**
 * 每人每餐热量目标（基础值，按 familySize 缩放为总量）
 */
const PER_PERSON_KCAL: Record<MealTime, { min: number; max: number }> = {
  breakfast: { min: 280, max: 480 },
  lunch: { min: 550, max: 800 },
  dinner: { min: 380, max: 650 },
  bento: { min: 450, max: 750 },
  snack: { min: 80, max: 350 },
}

/** 餐次名称（用于推荐文案） */
const MEAL_LABEL: Record<MealTime, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  bento: '便当',
  snack: '加餐',
}

/**
 * 判断菜品是否为"大菜/完整一餐"（单独一道即可成餐）
 * 启发式推断，无需新增数据字段：
 * - 主食/早餐品类 → 完整一餐
 * - 标签含"饱腹" → 分量足
 * - 菜名含 面/饭/碗/卷/粥/炒饭/拌面/烙 → 单独成餐
 */
function isHeartyDish(dish: Dish): boolean {
  if (dish.category === '主食' || dish.category === '早餐') return true
  if (dish.tags.includes('饱腹')) return true
  if (/面|饭|碗|卷|粥|炒饭|拌面|烙/.test(dish.name)) return true
  return false
}

/**
 * 动态推荐数量：根据人数 + 餐型 + 候选池是否有大菜
 *
 * 用户核心需求：
 * - 1人：一个三明治/沙拉/一碗面就够，不需要"一汤一菜"
 * - 2人：一道大菜 或 两道搭配
 * - 3人+：按人数递增，有大菜可减1
 */
function getDynamicTarget(
  mealTime: MealTime,
  familySize: number,
  candidates: Dish[],
): { minPicks: number; targetCount: number; minKcal: number; maxKcal: number } {
  const size = Math.max(1, familySize)
  const perPerson = PER_PERSON_KCAL[mealTime]
  const totalMinKcal = perPerson.min * size
  const totalMaxKcal = perPerson.max * size
  const hasHearty = candidates.some(isHeartyDish)

  if (mealTime === 'snack') {
    return { minPicks: 1, targetCount: 1, minKcal: totalMinKcal, maxKcal: totalMaxKcal }
  }

  if (size <= 1) {
    // 1人：有大菜→1道足够，没有→最多2道
    return { minPicks: 1, targetCount: hasHearty ? 1 : 2, minKcal: totalMinKcal, maxKcal: totalMaxKcal }
  }

  if (size === 2) {
    // 2人：有大菜→2道（大菜+搭配），没有→3道
    return { minPicks: 1, targetCount: hasHearty ? 2 : 3, minKcal: totalMinKcal, maxKcal: totalMaxKcal }
  }

  // 3人+：ceil(人数/2)+1，有大菜减1
  let target = Math.ceil(size / 2) + 1
  if (hasHearty) target = Math.max(2, target - 1)
  return { minPicks: 2, targetCount: Math.min(5, target), minKcal: totalMinKcal, maxKcal: totalMaxKcal }
}

const CATEGORY_PREFERENCE: Record<MealTime, Record<Dish['category'], number>> = {
  breakfast: { '荤菜': 0, '素菜': 0.3, '汤羹': 0.6, '主食': 1, '早餐': 1, '凉菜': 0, '甜品': 0.3 },
  lunch: { '荤菜': 0.9, '素菜': 0.7, '汤羹': 0.4, '主食': 0.9, '早餐': 0, '凉菜': 0.3, '甜品': 0.1 },
  dinner: { '荤菜': 0.9, '素菜': 0.8, '汤羹': 0.7, '主食': 0.3, '早餐': 0, '凉菜': 0.5, '甜品': 0.2 },
  bento: { '荤菜': 0.9, '素菜': 0.7, '汤羹': 0.1, '主食': 0.9, '早餐': 0, '凉菜': 0.4, '甜品': 0 },
  snack: { '荤菜': 0.1, '素菜': 0.5, '汤羹': 0.3, '主食': 0.4, '早餐': 0.3, '凉菜': 0.6, '甜品': 0.6 },
}

/**
 * 推荐一桌菜
 */
export function recommendMeal(input: RecommendInput): RecommendResult | null {
  const { mealTime, pantryItems, candidateDishes, buddyGroup, memberPreferences } = input
  const familySize = input.familySize ?? 2
  const healthProfiles = input.healthProfiles
  const exclude = new Set(input.excludeDishIds ?? [])
  // v1.11 阶段 2: 时段隐式加权 — 默认沿用 mealTime,允许覆盖
  // bento/snack 不是真实时段, 回退到当前实际时段
  const currentMealType: CurrentMealTime =
    input.currentMealType ?? (mealTime === 'bento' || mealTime === 'snack' ? getCurrentMealType() : mealTime as CurrentMealTime)

  // 1) 过滤候选
  const candidates = candidateDishes.filter((d) => !exclude.has(d.id))
  if (candidates.length === 0) return null

  // 动态推荐数量：根据人数 + 餐型 + 候选池是否有大菜
  const dyn = getDynamicTarget(mealTime, familySize, candidates)
  // v1.11: forceCount 强制覆盖（如首页固定 4 道）
  if (input.forceCount !== undefined && input.forceCount > 0) {
    dyn.targetCount = input.forceCount
    dyn.minPicks = Math.min(dyn.minPicks, input.forceCount)
  }

  // 2) 按餐次打分(注入 buddy / preferences / mealType 隐式加权)
  const allScored = candidates
    .map((dish) => ({
      dish,
      ...scoreCandidate(dish, pantryItems, mealTime, {
        buddyGroup,
        memberPreferences,
        currentMealType,
        healthProfiles,
      }),
    }))
    .filter((c) => CATEGORY_PREFERENCE[mealTime][c.dish.category] > 0)
    .sort((a, b) => b.score - a.score)

  if (allScored.length === 0) return null

  // P0-3: 过敏硬过滤(不足时回退降权不过滤)
  const minPicks = dyn.minPicks
  let scored = allScored.filter((c) => !c.prefFilter)
  if (scored.length < minPicks) {
    scored = allScored
  }

  // 3) 贪心选择：每轮挑一个对总热量最合适的
  const picks: Dish[] = []
  const usedCategories: Dish['category'][] = []
  const usedMethods: string[] = []
  const usedProteinKeys: string[] = []  // v1.11: 主食材去重，防止两道鱼/两道鸡同时推荐
  let totalKcal = 0

  const targetCount = dyn.targetCount
  for (let i = 0; i < targetCount; i++) {
    const remaining = targetCount - i
    const remainingBudget = dyn.maxKcal - totalKcal
    const perDishBudget = remainingBudget / remaining

    // 重算每个候选的分数（加入多样性奖励）
    // v1.11: 主食材硬去重 — 已推荐过同类蛋白质(如鱼)的菜直接排除，不再只是降权
    const available = scored.filter((c) => {
      if (picks.includes(c.dish)) return false
      const pk = getProteinType(c.dish)
      if (pk && usedProteinKeys.includes(pk)) return false
      return true
    })
    if (available.length === 0) {
      // fallback: 去重后候选不够了，放宽限制（总比推荐不够数好）
      const fallback = scored.filter((c) => !picks.includes(c.dish))
      if (fallback.length === 0) break
      const best = fallback
        .map((c) => {
          const n = sumDishNutrients(c.dish.ingredients)
          const kcalFit = 1 - Math.abs(n.kcal - perDishBudget) / Math.max(perDishBudget, 100)
          const finalScore = c.score * 0.5 + Math.max(0, kcalFit) * 0.3
          return { ...c, n, finalScore }
        })
        .sort((a, b) => b.finalScore - a.finalScore)[0]
      picks.push(best.dish)
      usedCategories.push(best.dish.category)
      usedMethods.push(best.dish.cookMethod)
      const pk = getProteinType(best.dish)
      if (pk) usedProteinKeys.push(pk)
      totalKcal += best.n.kcal
      continue
    }

    const best = available
      .map((c) => {
        const n = sumDishNutrients(c.dish.ingredients)
        const diversityBonus = usedMethods.includes(c.dish.cookMethod) ? -0.3 : 0.2
        const categoryBonus = usedCategories.includes(c.dish.category) ? -0.4 : 0.3
        const kcalFit = 1 - Math.abs(n.kcal - perDishBudget) / Math.max(perDishBudget, 100)
        const finalScore =
          c.score * 0.5 +
          Math.max(0, kcalFit) * 0.3 +
          diversityBonus * 0.1 +
          categoryBonus * 0.1
        return { ...c, n, finalScore }
      })
      .sort((a, b) => b.finalScore - a.finalScore)[0]

    picks.push(best.dish)
    usedCategories.push(best.dish.category)
    usedMethods.push(best.dish.cookMethod)
    const pk = getProteinType(best.dish)
    if (pk) usedProteinKeys.push(pk)
    totalKcal += best.n.kcal
  }

  // snack 模式只需 1 道菜; 其他模式至少 2 道
  if (picks.length < minPicks) return null

  // 4) 计算总营养
  const totalNutrition = sumDishNutrients(
    picks.flatMap((d) => d.ingredients),
  )

  // 5) 计算食材库覆盖率
  const allIngredientNames = picks.flatMap((d) => d.ingredients.map((i) => i.name))
  const uniqueIngredients = Array.from(new Set(allIngredientNames))
  const inPantry = uniqueIngredients.filter((n) => pantryItems.includes(n))
  const pantryCoverage = uniqueIngredients.length > 0 ? inPantry.length / uniqueIngredients.length : 0
  const pantryIngredientCount = inPantry.length
  const pantryIngredientTotal = uniqueIngredients.length

  // 6) 推荐理由
  const reason = buildReason(totalNutrition, pantryCoverage, mealTime, familySize)

  // P0-3: 构建每道菜的推荐理由(偏好 + 营养亮点, ≤4行)
  const perDishReasons: Record<string, string[]> = {}
  const disagreementDishIds: string[] = []
  const scoredMap = new Map(scored.map((c) => [c.dish.id, c]))
  for (const pick of picks) {
    const c = scoredMap.get(pick.id)
    const lines: string[] = []
    if (c?.prefReasons?.length) lines.push(...c.prefReasons.slice(0, 2))
    // 营养亮点(≤2行)
    const n = sumDishNutrients(pick.ingredients)
    if (n.protein >= 18) lines.push(`蛋白 ${n.protein.toFixed(0)}g`)
    if (n.fiber >= 4) lines.push(`纤维 ${n.fiber.toFixed(0)}g`)
    perDishReasons[pick.id] = lines.slice(0, 4)
    if (c?.disagreement) disagreementDishIds.push(pick.id)
  }

  // 7) 餐盘结构检查（2026 膳食指南）
  const plateResult = checkPlateStructure(picks)
  const allHealthReasons = Array.from(new Set(
    picks.flatMap((pick) => {
      const c = scoredMap.get(pick.id)
      return c?.prefReasons ?? []
    }).filter((r) => r.includes('偏高') || r.includes('忌口') || r.includes('过敏') || r.includes('含'))
  ))

  return {
    dishes: picks,
    totalNutrition,
    reason,
    pantryCoverage,
    pantryIngredientCount,
    pantryIngredientTotal,
    perDishReasons,
    disagreementDishIds,
    plateGaps: plateResult.gaps,
    healthReasons: allHealthReasons,
  }
}

/**
 * 给单菜打分（不考虑多样性，只看食材/类别/营养本身）
 *
 * v1.11 阶段 2 加权维度:
 * - 今日掌勺权重(偏好分层加权 P0-3)
 * - 时段隐式加权(0.5x ~ 1.2x)
 *
 * P0-3: 返回结构体,携带偏好 filter/reasons/disagreement
 */
type CandidateScore = {
  score: number
  prefFilter: boolean
  prefReasons: string[]
  disagreement: boolean
}

function scoreCandidate(
  dish: Dish,
  pantryItems: string[],
  mealTime: MealTime,
  ctx?: {
    buddyGroup?: BuddyGroup
    memberPreferences?: Record<string, DishPreferences>
    currentMealType?: CurrentMealTime
    healthProfiles?: HealthProfile[]
  },
): CandidateScore {
  let score = 1
  const n = sumDishNutrients(dish.ingredients)
  const categoryFit = CATEGORY_PREFERENCE[mealTime][dish.category]
  score *= categoryFit || 0.1

  // 食材库已有 → 减采买成本 +0.3
  const hitPantry = dish.ingredients.some((i) => pantryItems.includes(i.name))
  if (hitPantry) score += 0.3

  // 高蛋白加 +0.2
  if (n.protein >= 18) score += 0.2

  // 高纤维加 +0.15
  if (n.fiber >= 4) score += 0.15

  // 适合控糖 / 适合减脂：基于已有 tags
  if (mealTime === 'dinner' && dish.tags.includes('控糖友好')) score += 0.2
  if (mealTime === 'breakfast' && dish.tags.includes('快手')) score += 0.15

  // P0-2: bento 带饭优先选 mealType 含 bento 的菜 (+0.3)
  if (mealTime === 'bento' && dish.mealType?.includes('bento')) score += 0.3
  // P0-2: snack 加餐优先选 mealType 含 snack 的菜 (+0.4, 因为 snack 池小需要更强信号)
  if (mealTime === 'snack' && dish.mealType?.includes('snack')) score += 0.4

  // v1.11 阶段 2: 时段隐式加权(权重 0.5x ~ 1.2x)
  if (ctx?.currentMealType) {
    score *= mealTypeWeight(dish, ctx.currentMealType)
  }

  // 健康档案约束（2026 膳食指南 + 个人限制）
  let healthFilter = false
  let healthReasons: string[] = []
  if (ctx?.healthProfiles && ctx.healthProfiles.length > 0) {
    const healthResult = scoreDishByHealthProfiles(dish, ctx.healthProfiles)
    score += healthResult.penalty
    healthFilter = healthResult.hardFilter
    healthReasons = healthResult.reasons
  }

  // P0-3: 今日掌勺 + 饭搭子偏好加权(结构体)
  let prefFilter = false
  let prefReasons: string[] = []
  let disagreement = false
  if (ctx?.buddyGroup && ctx?.memberPreferences) {
    const pref = scoreByBuddyGroupPreferences(dish.id, ctx.buddyGroup, ctx.memberPreferences)
    score += pref.delta
    prefFilter = pref.filter
    prefReasons = pref.reasons
    disagreement = pref.disagreement
  }

  return { score, prefFilter: prefFilter || healthFilter, prefReasons: [...healthReasons, ...prefReasons], disagreement }
}

/**
 * P0-3: 偏好评分结果(结构体,非纯 number)
 * - delta: 分数增量(加到 scoreCandidate 的 score 上)
 * - filter: 过敏 → true,候选应被硬过滤(不足时回退降权)
 * - reasons: 推荐理由(人话,供 perDishReasons 使用)
 * - disagreement: 一方喜欢一方不喜欢 → true(UI 标 ⚠️)
 */
type PreferenceScoreResult = {
  delta: number
  filter: boolean
  reasons: string[]
  disagreement: boolean
}

/**
 * 饭搭子偏好综合得分(P0-3 重构,基于主档 §7.2 规则链):
 *
 * §7.2 规则 → 实现:
 * - 喜欢→加权: 单方❤️ +0.2(掌勺)/+0.1(非掌勺)
 * - 多人喜欢→强加权: 双❤️ ×1.8(对齐任务记录伪代码)
 * - 不喜欢→降权: 按 dislikedDetails.reason 分层
 * - 多人不喜欢→强降权: 双🚫 −0.6
 * - 过敏→强过滤: allergy → filter=true,候选剔除(不足时回退)
 * - 健康→降权: health → ×0.5
 * - 暂时不想吃→短期降权: temporary → <14d ×0.3, ≥14d ×0.7
 * - 口味→降权: taste → ×0.6(粗粒度,同类扩散留后续)
 * - 最近做过太多次→降重复: cooked 命中 → 轻降权(粗粒度无时间戳)
 * - 很久没做但双方喜欢→提高召回: 双❤️ + 不在 cooked → +0.1
 * - 一方喜欢一方不喜欢→标记分歧: disagreement=true
 */
function scoreByBuddyGroupPreferences(
  dishId: string,
  buddyGroup: BuddyGroup,
  prefs: Record<string, DishPreferences>,
): PreferenceScoreResult {
  const todayChefId = buddyGroup.todayChefId
  const reasons: string[] = []
  let disagreement = false

  // 1. 收集每个搭子对这道菜的判定(含 dislikedDetails 原因)
  type MemberVerdict = {
    name: string
    isChef: boolean
    verdict: 'love' | 'hate' | 'none'
    reason?: string
    note?: string
    createdAt?: string
  }
  const verdicts: MemberVerdict[] = buddyGroup.members.map((member) => {
    const p = prefs[member.id]
    if (!p) return { name: member.name, isChef: member.id === todayChefId, verdict: 'none' as const }
    const loved = p.favorite?.includes(dishId) ?? false
    const hated = p.disliked?.includes(dishId) ?? false
    if (loved && !hated) return { name: member.name, isChef: member.id === todayChefId, verdict: 'love' as const }
    if (hated && !loved) {
      const detail = p.dislikedDetails?.[dishId]
      return {
        name: member.name,
        isChef: member.id === todayChefId,
        verdict: 'hate' as const,
        reason: detail?.reason,
        note: detail?.note,
        createdAt: detail?.createdAt,
      }
    }
    return { name: member.name, isChef: member.id === todayChefId, verdict: 'none' as const }
  })

  const loves = verdicts.filter((v) => v.verdict === 'love')
  const hates = verdicts.filter((v) => v.verdict === 'hate')

  // 2. 过敏 → 硬过滤
  const allergyHates = hates.filter((v) => v.reason === 'allergy')
  if (allergyHates.length > 0) {
    return {
      delta: -1,
      filter: true,
      reasons: [`🚫 ${allergyHates.map((v) => v.name).join('、')}过敏忌口`],
      disagreement: false,
    }
  }

  // 3. 按原因处理不喜欢(非过敏)
  let hateDelta = 0
  for (const v of hates) {
    switch (v.reason) {
      case 'temporary': {
        const days = daysSince(v.createdAt)
        const factor = days < 14 ? 0.3 : 0.7
        hateDelta += (v.isChef ? -0.25 : -0.15) * factor
        reasons.push(`${v.name}暂时吃腻了${days < 14 ? '(近期)' : '(已久)'}`)
        break
      }
      case 'health':
        hateDelta += (v.isChef ? -0.25 : -0.15) * 0.5
        reasons.push(`${v.name}健康原因不吃`)
        break
      case 'taste':
        hateDelta += (v.isChef ? -0.25 : -0.15) * 0.6
        reasons.push(`${v.name}口味不喜欢`)
        break
      case 'other':
      default:
        hateDelta += v.isChef ? -0.25 : -0.15
        break
    }
  }

  // 4. 双方都不喜欢 → 强降权
  if (hates.length >= 2 && loves.length === 0) {
    if (reasons.length === 0) reasons.push(`${hates.map((v) => v.name).join('和')}都不想吃`)
    return { delta: -0.6, filter: false, reasons, disagreement: false }
  }

  // 5. 喜欢 → 加权
  let loveDelta = 0
  for (const v of loves) {
    loveDelta += v.isChef ? 0.2 : 0.1
  }
  if (loves.length >= 2 && hates.length === 0) {
    loveDelta = loveDelta * 1.8
    reasons.unshift(`${loves.map((v) => v.name).join('和')}都喜欢 ❤️`)
  } else if (loves.length === 1 && hates.length === 0) {
    reasons.unshift(`${loves[0].name}喜欢 ❤️`)
  }

  // 6. 一方喜欢一方不喜欢 → 分歧
  if (loves.length >= 1 && hates.length >= 1) {
    disagreement = true
    reasons.push(`⚠️ 搭子意见不一致:${loves.map((v) => v.name).join('、')}喜欢,${hates.map((v) => v.name).join('、')}不想吃`)
  }

  // 7. cooked 粗粒度降权(无时间戳,只看是否做过)
  let cookedCount = 0
  for (const member of buddyGroup.members) {
    const p = prefs[member.id]
    if (p?.cooked?.includes(dishId)) cookedCount++
  }
  let cookedDelta = 0
  if (cookedCount > 0) {
    cookedDelta = -0.1 * cookedCount
    if (cookedCount >= 2) reasons.push('最近都做过,换换口味')
  }

  // 8. 很久没做但双方喜欢 → 提高召回
  if (loves.length >= 2 && cookedCount === 0) {
    cookedDelta += 0.1
    reasons.push('很久没做但都喜欢,该做了')
  }

  const delta = hateDelta + loveDelta + cookedDelta
  return { delta, filter: false, reasons, disagreement }
}

// 公开给 UI 文案使用:返回(verdict, 是否今日掌勺)
export function getBuddyGroupVerdictForDish(
  dishId: string,
  buddyGroup: BuddyGroup,
  prefs: Record<string, DishPreferences>,
): Array<{ member: BuddyMember; isChef: boolean; verdict: 'love' | 'hate' | 'none' }> {
  return buddyGroup.members.map((member) => {
    const p = prefs[member.id]
    const loved = p?.favorite?.includes(dishId) ?? false
    const hated = p?.disliked?.includes(dishId) ?? false
    const verdict: 'love' | 'hate' | 'none' = loved && !hated ? 'love' : hated && !loved ? 'hate' : 'none'
    return { member, isChef: member.id === buddyGroup.todayChefId, verdict }
  })
}

function buildReason(
  total: DishNutrients,
  pantryCoverage: number,
  mealTime: MealTime,
  familySize?: number,
): string {
  const parts: string[] = []
  const size = familySize ? Math.max(1, familySize) : 1
  parts.push(`${MEAL_LABEL[mealTime]}${size > 1 ? ` · ${size}人` : ''}`)
  parts.push(`合计 ${Math.round(total.kcal)} kcal`)

  if (total.protein >= 30) parts.push(`蛋白充足（${total.protein.toFixed(1)} g）`)
  if (total.fiber >= 8) parts.push(`纤维丰富（${total.fiber.toFixed(1)} g）`)
  if (total.sodium <= 1500) parts.push('钠控制良好')

  if (pantryCoverage >= 0.5) {
    parts.push(`已有食材覆盖 ${Math.round(pantryCoverage * 100)}%，少跑一趟超市`)
  } else if (pantryCoverage >= 0.25) {
    parts.push(`已有食材覆盖 ${Math.round(pantryCoverage * 100)}%`)
  }

  return parts.join(' · ')
}

export const MEAL_TIME_LABEL: Record<MealTime, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  bento: '便当',
  snack: '加餐',
}

export const MEAL_TIME_OPTIONS: Array<{ value: MealTime; label: string; description: string }> = [
  { value: 'breakfast', label: '早餐', description: '轻量、主食 + 汤' },
  { value: 'lunch', label: '午餐', description: '完整一桌、营养主力' },
  { value: 'dinner', label: '晚餐', description: '荤素搭配、控制热量' },
  { value: 'bento', label: '便当', description: '带饭搭配、荤 + 主食' },
  { value: 'snack', label: '加餐', description: '轻食小食、单菜即可' },
]