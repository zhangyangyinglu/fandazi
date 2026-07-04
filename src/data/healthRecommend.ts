/**
 * 健康档案 → 推荐引擎桥接
 *
 * 把 HealthProfile 的 restrictions / goals / statuses 翻译成推荐引擎能用的
 * 硬过滤 + 软降权规则。
 *
 * 硬过滤（直接排除菜品）:
 *   no-seafood / no-egg / no-dairy / no-gluten / no-nuts / no-beef-lalm / vegetarian
 *
 * 软降权（扣分但不排除）:
 *   low-sodium → 高钠菜扣分
 *   low-oil / avoid-fried → 油炸/煎炸扣分
 *   low-sugar / avoid-sugary-drinks → 高糖菜扣分
 *   low-fat / avoid-fatty-meat → 高脂/肥肉扣分
 *   calorie-control → 高热量菜扣分
 *   low-purine → 高嘌呤食材扣分
 *   low-refined-carb → 精制碳水主食扣分
 *   avoid-heavy-flavor → 重口烹饪扣分
 *   avoid-raw / avoid-cold → 生冷菜扣分
 *   no-spicy → 辣菜扣分
 */
import type { Dish } from '../types'
import { sumDishNutrients } from './nutrition'
import type { HealthProfile, DietRestriction } from '@/components/healthProfileStorage'

// ── 食材关键词映射 ──

const SEAFOOD_KEYWORDS: string[] = ['虾', '虾仁', '海蛎', '蟹', '贝', '蛤', '扇贝', '牡蛎', '鱼', '鲈', '鳕', '三文鱼', '带鱼', '黄鱼', '鲳', '鲫', '鳗', '鱿鱼', '墨鱼']
const EGG_KEYWORDS: string[] = ['蛋', '鸡蛋', '鸭蛋', '鹌鹑蛋', '蛋液']
const DAIRY_KEYWORDS: string[] = ['奶', '牛奶', '酸奶', '奶酪', '黄油', '奶油']
const GLUTEN_KEYWORDS: string[] = ['面粉', '面条', '馒头', '面包', '饺子皮', '馄饨皮']
const NUTS_KEYWORDS: string[] = ['花生', '核桃', '杏仁', '腰果', '开心果', '芝麻']
const BEEF_LAMB_KEYWORDS: string[] = ['牛', '牛肉', '肥牛', '羊', '羊肉']
const HIGH_PURINE_KEYWORDS: string[] = ['动物内脏', '肝', '腰', '肚', '脑', '凤尾鱼', '沙丁鱼', '浓肉汤', '高汤']
const FATTY_MEAT_KEYWORDS: string[] = ['五花', '肥肉', '腊肉', '火腿', '培根', '东坡肉', '红烧肉']
const REFINED_CARB_KEYWORDS: string[] = ['白米饭', '面条', '馒头', '白粥', '白糖']

function dishContainsKeyword(dish: Dish, keywords: string[]): boolean {
  return dish.ingredients.some((ing) => keywords.some((kw) => ing.name.includes(kw)))
    || keywords.some((kw) => dish.name.includes(kw))
}

function cookMethodIs(dish: Dish, methods: string[]): boolean {
  return methods.some((m) => dish.cookMethod.includes(m))
}

/**
 * 检查一道菜是否违反某个限制
 * 返回: { hardFilter: boolean, penalty: number, reason: string }
 */
export function checkDishAgainstRestriction(
  dish: Dish,
  restriction: DietRestriction,
): { hardFilter: boolean; penalty: number; reason: string } {
  const n = sumDishNutrients(dish.ingredients)

  switch (restriction) {
    // ── 硬过滤 ──
    case 'no-seafood':
      if (dishContainsKeyword(dish, SEAFOOD_KEYWORDS))
        return { hardFilter: true, penalty: 0, reason: '含海鲜/鱼，成员忌口' }
      break
    case 'no-egg':
      if (dishContainsKeyword(dish, EGG_KEYWORDS))
        return { hardFilter: true, penalty: 0, reason: '含蛋，成员忌口' }
      break
    case 'no-dairy':
      if (dishContainsKeyword(dish, DAIRY_KEYWORDS))
        return { hardFilter: true, penalty: 0, reason: '含奶制品，成员忌口' }
      break
    case 'no-gluten':
      if (dishContainsKeyword(dish, GLUTEN_KEYWORDS))
        return { hardFilter: true, penalty: 0, reason: '含麸质，成员忌口' }
      break
    case 'no-nuts':
      if (dishContainsKeyword(dish, NUTS_KEYWORDS))
        return { hardFilter: true, penalty: 0, reason: '含坚果，成员过敏' }
      break
    case 'no-beef-lamb':
      if (dishContainsKeyword(dish, BEEF_LAMB_KEYWORDS))
        return { hardFilter: true, penalty: 0, reason: '含牛羊肉，成员忌口' }
      break
    case 'vegetarian': {
      const meatKeywords: string[] = ['鸡', '鸭', '鹅', '猪', '排骨', '瘦肉', '里脊', '肉末']
      if (dish.ingredients.some((i) => i.group === '肉蛋') || dishContainsKeyword(dish, [...SEAFOOD_KEYWORDS, ...BEEF_LAMB_KEYWORDS, ...meatKeywords]))
        return { hardFilter: true, penalty: 0, reason: '含肉类，成员素食' }
      break
    }

    // ── 软降权 ──
    case 'low-sodium':
      if (n.sodium >= 1000) return { hardFilter: false, penalty: -0.4, reason: `钠 ${Math.round(n.sodium)}mg 偏高` }
      if (n.sodium >= 800) return { hardFilter: false, penalty: -0.2, reason: `钠 ${Math.round(n.sodium)}mg 略高` }
      break
    case 'low-oil':
    case 'avoid-fried':
      if (cookMethodIs(dish, ['炸', '煎', '爆']))
        return { hardFilter: false, penalty: -0.3, reason: `${dish.cookMethod}方式油较多` }
      break
    case 'low-sugar':
    case 'avoid-sugary-drinks':
      if (n.sugar >= 15) return { hardFilter: false, penalty: -0.3, reason: `糖 ${Math.round(n.sugar)}g 偏多` }
      if (n.sugar >= 8) return { hardFilter: false, penalty: -0.15, reason: `糖 ${Math.round(n.sugar)}g 略高` }
      break
    case 'low-fat':
    case 'avoid-fatty-meat':
      if (dishContainsKeyword(dish, FATTY_MEAT_KEYWORDS))
        return { hardFilter: false, penalty: -0.3, reason: '含肥肉/加工肉' }
      if (n.satFat >= 10) return { hardFilter: false, penalty: -0.25, reason: `饱和脂肪 ${n.satFat.toFixed(1)}g 偏高` }
      break
    case 'calorie-control':
      if (n.kcal >= 600) return { hardFilter: false, penalty: -0.25, reason: `热量 ${Math.round(n.kcal)} kcal 偏高` }
      break
    case 'low-purine':
      if (dishContainsKeyword(dish, HIGH_PURINE_KEYWORDS))
        return { hardFilter: false, penalty: -0.35, reason: '含高嘌呤食材' }
      break
    case 'low-refined-carb':
      if (dish.category === '主食' && dishContainsKeyword(dish, REFINED_CARB_KEYWORDS))
        return { hardFilter: false, penalty: -0.2, reason: '精制碳水主食' }
      break
    case 'avoid-heavy-flavor':
      if (cookMethodIs(dish, ['红烧', '卤', '酱', '干锅']))
        return { hardFilter: false, penalty: -0.2, reason: `${dish.cookMethod}口味较重` }
      break
    case 'avoid-raw':
      if (dish.cookMethod === '生食' || dish.tags.includes('生食'))
        return { hardFilter: false, penalty: -0.3, reason: '含生食' }
      break
    case 'avoid-cold':
      if (dish.tags.includes('冷菜') || dish.tags.includes('凉拌'))
        return { hardFilter: false, penalty: -0.2, reason: '含冷食' }
      break
    case 'no-spicy':
      if (dish.tags.includes('辣') || dish.tags.includes('微辣') || dish.tags.includes('重辣'))
        return { hardFilter: false, penalty: -0.35, reason: '含辣' }
      break
  }

  return { hardFilter: false, penalty: 0, reason: '' }
}

/**
 * 汇总所有成员的健康档案，对一道菜给出综合判定
 */
export function scoreDishByHealthProfiles(
  dish: Dish,
  profiles: HealthProfile[],
): { hardFilter: boolean; penalty: number; reasons: string[] } {
  if (profiles.length === 0) return { hardFilter: false, penalty: 0, reasons: [] }

  let hardFilter = false
  let penalty = 0
  const reasons: string[] = []
  const seenRestrictions = new Set<DietRestriction>()

  for (const profile of profiles) {
    for (const restriction of profile.restrictions) {
      if (seenRestrictions.has(restriction)) continue
      seenRestrictions.add(restriction)
      const result = checkDishAgainstRestriction(dish, restriction)
      if (result.hardFilter) {
        hardFilter = true
        reasons.push(result.reason)
      } else if (result.penalty < 0) {
        penalty += result.penalty
        reasons.push(result.reason)
      }
    }
  }

  return { hardFilter, penalty, reasons: Array.from(new Set(reasons)) }
}

/**
 * 检查一桌菜是否满足 2026 膳食指南餐盘结构
 * 返回缺口提示
 */
export function checkPlateStructure(dishes: Dish[]): {
  hasProtein: boolean
  hasVegetable: boolean
  hasStaple: boolean
  gaps: string[]
} {
  const hasProtein = dishes.some((d) => d.ingredients.some((i) => i.group === '肉蛋'))
  const hasVegetable = dishes.some((d) => d.ingredients.some((i) => i.group === '蔬菜') || d.category === '素菜')
  const hasStaple = dishes.some((d) => d.category === '主食' || d.ingredients.some((i) => i.group === '主食'))

  const gaps: string[] = []
  if (!hasProtein) gaps.push('缺优质蛋白')
  if (!hasVegetable) gaps.push('缺蔬菜')
  if (!hasStaple) gaps.push('缺主食')

  return { hasProtein, hasVegetable, hasStaple, gaps }
}
