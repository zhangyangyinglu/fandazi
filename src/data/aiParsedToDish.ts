import type { Dish, Ingredient, IngredientGroup } from '../types'
import type { AIParsedDish } from './aiRecipeImport'

const KNOWN_GROUPS: IngredientGroup[] = ['蔬菜', '肉蛋', '主食', '调味', '干货']
const DEFAULT_COLOR_POOL = [
  '#d47a62', '#7fbf8f', '#86bfa8', '#6fa7b8', '#91b87d',
  '#e58f6f', '#a6bf75', '#8bbf78', '#c08a63', '#b7a67a',
  '#93a7c6', '#b99b63', '#8ec077', '#78b88e', '#e0a05f',
]

// 与基础菜 id 命名风格保持一致：kebab-case，纯字母数字。
// 仅把可安全做 id 的字符保留下来；其余字符折叠为 '-'。
export function toBaseDishId(raw: string): string {
  const ascii = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // 至少需要 4 个字符，否则用随机后缀保证唯一
  return ascii.length >= 4 ? ascii : `custom-${ascii || 'dish'}`
}

export function pickStableColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return DEFAULT_COLOR_POOL[hash % DEFAULT_COLOR_POOL.length]
}

export function isKnownIngredientGroup(value: string): value is IngredientGroup {
  return (KNOWN_GROUPS as string[]).includes(value)
}

/**
 * 把 AI 解析出来的一道菜转成可保存到 customDishes 的 Dish。
 * - 修正不识别的食材组（兜底为“调味”）
 * - 步骤数小于 8 的，按需复制并补足到 8 步
 * - id 缺省时由 name 生成；冲突时附加时间戳后缀
 */
export function aiParsedToDish(
  parsed: AIParsedDish,
  fallbackId: string,
  existingIds: Set<string>,
): Dish {
  const ingredients: Ingredient[] = parsed.ingredients.map((ing) => ({
    name: ing.name.trim() || '未知食材',
    amount: ing.amount.trim() || '适量',
    group: isKnownIngredientGroup(ing.group) ? ing.group : '调味',
  }))

  // 补足到至少 8 步
  const baseSteps = parsed.steps.filter((s) => s.trim().length > 0)
  const steps = baseSteps.length >= 8 ? baseSteps : [...baseSteps, ...padSteps(baseSteps.length, parsed.name)]

  const baseId = toBaseDishId(parsed.id || parsed.name || fallbackId)
  const id = existingIds.has(baseId) ? `${baseId}-${Date.now().toString(36)}` : baseId

  return {
    id,
    name: parsed.name.trim() || '未命名菜',
    category: parsed.category,
    tags: parsed.tags,
    intro: parsed.intro,
    cookMethod: parsed.cookMethod,
    cookTime: parsed.cookTime,
    color: pickStableColor(id),
    ingredients,
    steps,
  }
}

function padSteps(currentCount: number, dishName: string): string[] {
  const fillers: Record<number, string[]> = {
    1: [
      `${dishName} 准备好所有食材，分类摆放。`,
      '蔬菜洗净切好，肉类腌制 10 分钟。',
      '热锅少油，先下葱姜蒜爆香。',
      '按顺序下主料和配菜翻炒。',
      '加调料调色调味，大火收汁。',
      '中火焖煮让食材入味。',
      '出锅前尝咸淡，微调。',
      '装盘后撒葱花即可上桌。',
    ],
    2: [
      '配菜焯水备用，注意控干。',
      '热锅少油，先下葱姜蒜爆香。',
      '按顺序下主料和配菜翻炒。',
      '加调料调色调味，大火收汁。',
      '中火焖煮让食材入味。',
      '出锅前尝咸淡，微调。',
      '装盘后撒葱花即可上桌。',
    ],
    3: [
      '加调料调色调味，大火收汁。',
      '中火焖煮让食材入味。',
      '出锅前尝咸淡，微调。',
      '装盘后撒葱花即可上桌。',
      '出锅装盘，搭配主食。',
    ],
    4: [
      '中火焖煮让食材入味。',
      '出锅前尝咸淡，微调。',
      '装盘后撒葱花即可上桌。',
      '出锅装盘，搭配主食。',
    ],
    5: [
      '出锅前尝咸淡，微调。',
      '装盘后撒葱花即可上桌。',
      '出锅装盘，搭配主食。',
    ],
    6: [
      '装盘后撒葱花即可上桌。',
      '出锅装盘，搭配主食。',
    ],
    7: [
      '出锅装盘，搭配主食。',
    ],
  }
  return fillers[currentCount] ?? []
}