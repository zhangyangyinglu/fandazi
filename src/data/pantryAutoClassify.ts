import type { IngredientGroup, PantryStorage } from '@/types'

type PantrySuggestion = { category: IngredientGroup; storage: PantryStorage; reason: string }

const ROOM = /罐头|罐装|酸黄瓜|泡菜|酱|干货/
const FRIDGE = /鸡蛋|酸奶|牛油果|午餐肉|火腿|乳|奶酪/
const FRESH_PROTEIN = /鱼|黄鱼|鲈|肉|排骨|牛|猪|鸡|虾|海鲜/

/**
 * 先由计划决定鲜肉/鲜鱼的冷藏或冷冻；没有三天内计划时保守冷冻。
 */
export function suggestPantryPlacement(name: string, usedWithinThreeDays = false): PantrySuggestion {
  if (ROOM.test(name)) return { category: ROOM.test(name) && /罐|酸黄瓜|泡菜|酱/.test(name) ? '调味' : '干货', storage: 'room', reason: '耐储食材，常温保存' }
  if (FRIDGE.test(name)) return { category: /鸡蛋|午餐肉/.test(name) ? '肉蛋' : '蔬菜', storage: 'fridge', reason: '开封或易熟食材，冷藏保存' }
  if (FRESH_PROTEIN.test(name)) return { category: '肉蛋', storage: usedWithinThreeDays ? 'fridge' : 'freezer', reason: usedWithinThreeDays ? '三天内计划会用，先冷藏' : '三天内未计划使用，先冷冻' }
  return { category: '蔬菜', storage: 'fridge', reason: '默认冷藏，可手动调整' }
}
