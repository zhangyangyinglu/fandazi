/**
 * 饮食特点自动识别
 *
 * 从营养字段 + 食材组成 + 烹饪方式 + 标签里提取"对家庭选菜有用"的特点。
 * 重点是"实用"——用户看到标签后能马上知道"今天该吃 / 不该吃"。
 *
 * 输出是有序数组：先显示"适合人群"类，再显示"营养特点"类，最后显示"食用场景"类。
 */

import type { DishNutrients } from './nutrition'

export type DietaryFeature = {
  key: string
  label: string
  category: '适合人群' | '营养特点' | '食用场景'
}

const VITAMIN_C_INGREDIENTS = ['番茄', '彩椒', '青椒', '红椒', '西兰花', '菜花', '菠菜', '小白菜']
const CALCIUM_INGREDIENTS = ['豆腐', '虾皮', '紫菜', '小白菜', '菠菜']
const IRON_INGREDIENTS = ['牛肉', '瘦牛肉', '猪肝', '菠菜', '黑木耳', '木耳', '红枣']
const GUT_INGREDIENTS = ['山药', '南瓜', '红薯', '燕麦', '糙米饭', '藜麦']
const WARM_INGREDIENTS = ['姜', '葱', '蒜', '桂皮', '八角']

export function detectFeatures(
  dish: {
    name: string
    tags: string[]
    ingredients: { name: string; group: string; amount: string }[]
    cookMethod: string
    cookTime: string
  },
  n: DishNutrients,
): DietaryFeature[] {
  const features: DietaryFeature[] = []
  const seen = new Set<string>()

  const push = (f: DietaryFeature) => {
    if (seen.has(f.key)) return
    seen.add(f.key)
    features.push(f)
  }

  const ingNames = dish.ingredients.map((i) => i.name).join(' ')
  const ingList = dish.ingredients

  // —— 适合人群 ——
  if (n.kcal <= 300 && n.protein >= 15) push({ key: 'fat-loss', label: '适合减脂', category: '适合人群' })
  if (n.fiber >= 4 && n.sugar <= 8 && n.carbs <= 50) push({ key: 'sugar-control', label: '适合控糖', category: '适合人群' })
  if (n.protein >= 22 && n.fat <= 18) push({ key: 'muscle', label: '适合增肌', category: '适合人群' })
  if (n.sodium <= 700 && n.satFat <= 8 && n.sugar <= 10) push({ key: 'three-high', label: '适合三高', category: '适合人群' })
  if (n.fat <= 8 && n.sodium <= 600) push({ key: 'light-diet', label: '适合清淡', category: '适合人群' })
  if (
    n.fiber >= 5 &&
    ['燕麦', '糙米饭', '藜麦', '燕麦片'].some((kw) => ingNames.includes(kw))
  ) {
    push({ key: 'gut', label: '肠道友好', category: '适合人群' })
  }

  // —— 营养特点 ——
  if (n.protein >= 20) push({ key: 'high-protein', label: '高蛋白', category: '营养特点' })
  if (n.fiber >= 5) push({ key: 'high-fiber', label: '高纤维', category: '营养特点' })
  if (n.fat <= 10) push({ key: 'low-fat', label: '低脂', category: '营养特点' })
  if (n.sodium <= 400) push({ key: 'low-sodium', label: '低钠', category: '营养特点' })
  if (n.kcal <= 250) push({ key: 'low-kcal', label: '低热量', category: '营养特点' })

  if (ingList.some((i) => VITAMIN_C_INGREDIENTS.some((v) => i.name.includes(v)))) {
    push({ key: 'vitamin-c', label: '含维生素 C', category: '营养特点' })
  }
  if (ingList.some((i) => CALCIUM_INGREDIENTS.some((v) => i.name.includes(v)))) {
    push({ key: 'calcium', label: '含钙', category: '营养特点' })
  }
  if (ingList.some((i) => IRON_INGREDIENTS.some((v) => i.name.includes(v)))) {
    push({ key: 'iron', label: '含铁', category: '营养特点' })
  }
  if (ingList.some((i) => GUT_INGREDIENTS.some((v) => i.name.includes(v)))) {
    push({ key: 'prebiotic', label: '含益生元食材', category: '营养特点' })
  }

  // —— 食用场景 ——
  const minutes = parseInt(dish.cookTime, 10) || 0
  if (minutes > 0 && minutes <= 15) push({ key: 'quick', label: `${minutes} 分钟快手`, category: '食用场景' })
  if (dish.tags.includes('便当') || dish.tags.includes('适合便当')) push({ key: 'lunchbox', label: '适合做便当', category: '食用场景' })
  if (dish.cookMethod === '煮' || dish.cookMethod === '炖' || dish.cookMethod === '煲') push({ key: 'soup', label: '汤羹饱腹', category: '食用场景' })
  if (ingList.some((i) => WARM_INGREDIENTS.some((w) => i.name.includes(w)))) push({ key: 'warm', label: '暖胃', category: '食用场景' })
  if (dish.tags.includes('凉拌')) push({ key: 'cold', label: '凉拌开胃', category: '食用场景' })

  return features
}

/**
 * 给 Drawer 渲染时用：按 category 分组返回。
 */
export function groupFeatures(
  features: DietaryFeature[],
): Record<DietaryFeature['category'], DietaryFeature[]> {
  return {
    '适合人群': features.filter((f) => f.category === '适合人群'),
    '营养特点': features.filter((f) => f.category === '营养特点'),
    '食用场景': features.filter((f) => f.category === '食用场景'),
  }
}