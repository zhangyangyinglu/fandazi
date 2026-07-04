/**
 * AI 录菜 JSON 解析器
 *
 * 输入：用户在 ChatGPT/Claude 里粘贴 prompt 后得到的 JSON 字符串
 * 输出：解析成功 → 预览对象（带原始字段）+ 错误列表（字段缺失或异常）
 *
 * 设计原则：
 *   1. 宽松解析：AI 输出可能带 markdown 包裹（```json ... ```）、多余空格、引号变体
 *   2. 严格校验：必填字段缺失会列出来，不静默丢弃
 *   3. 不修复脏数据：发现错误就交给用户重发或手动改，不要"自动猜测"出错字段
 */

import type { DishCategory, IngredientGroup } from '../types'

const VALID_CATEGORIES: DishCategory[] = ['荤菜', '汤羹', '主食', '素菜']
const VALID_GROUPS: IngredientGroup[] = ['蔬菜', '肉蛋', '主食', '调味', '干货']
const VALID_METHODS = ['炒', '煮', '蒸', '煎', '炖', '凉拌', '拌', '烤', '煲', '焖']
const VALID_FEATURE_KEYS = new Set([
  // 适合人群
  'fat-loss', 'sugar-control', 'muscle', 'three-high', 'light-diet', 'gut',
  // 营养特点
  'high-protein', 'high-fiber', 'low-fat', 'low-sodium', 'low-kcal',
  'vitamin-c', 'calcium', 'iron', 'prebiotic',
  // 食用场景
  'quick', 'lunchbox', 'soup', 'warm', 'cold',
])

export type AIParsedDish = {
  id: string
  name: string
  category: DishCategory
  tags: string[]
  intro: string
  cookMethod: string
  cookTime: string
  color: string
  ingredients: Array<{ name: string; amount: string; group: IngredientGroup }>
  steps: string[]
  // 营养/评分/特点来自 AI 输出，但展示用本地算法重新算一遍保证准确
  aiNutrition?: {
    kcal: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sodium: number
    sugar: number
    satFat: number
  }
  aiHealthScore?: { score: number; reason: string }
  aiDietaryFeatures?: string[]
}

export type ParseSuccess = { ok: true; dish: AIParsedDish; warnings: string[] }
export type ParseFailure = {
  ok: false
  errors: string[]
  warnings: string[]
  rawPreview?: string
}
export type ParseResult = ParseSuccess | ParseFailure

/**
 * 主入口：解析用户粘贴的 JSON 字符串
 */
export function parseAIRecipeJson(input: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1) 提取 JSON 片段（去掉 markdown ```json ... ``` 包裹）
  const stripped = stripMarkdownFence(input)
  if (!stripped.trim()) {
    return { ok: false, errors: ['JSON 为空'], warnings: [], rawPreview: stripped }
  }

  // 2) JSON.parse
  let data: unknown
  try {
    data = JSON.parse(stripped)
  } catch (e) {
    return {
      ok: false,
      errors: [`JSON 解析失败：${(e as Error).message}`],
      warnings: [],
      rawPreview: stripped.slice(0, 200),
    }
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, errors: ['JSON 顶层必须是对象'], warnings: [] }
  }
  const obj = data as Record<string, unknown>

  // 3) schemaVersion 校验（软警告）
  if (obj.schemaVersion !== '1.0') {
    warnings.push(`schemaVersion 应该是 "1.0"，实际是 ${JSON.stringify(obj.schemaVersion)}`)
  }

  // 4) 必填字段
  const id = stringField(obj.id, 'id', errors)
  const name = stringField(obj.name, 'name', errors)
  const category = categoryField(obj.category, errors)
  const cookMethod = cookMethodField(obj.cookMethod, errors, warnings)
  const cookTime = stringField(obj.cookTime, 'cookTime', errors)
  const intro = stringField(obj.intro, 'intro', errors, true) // 可空，默认值
  const color = colorField(obj.color, warnings)
  const tags = tagsField(obj.tags, errors, warnings)
  const ingredients = ingredientsField(obj.ingredients, errors, warnings)
  const steps = stepsField(obj.steps, errors, warnings)
  const aiNutrition = nutritionField(obj.nutrition, errors, warnings)
  const aiHealthScore = healthScoreField(obj.healthScore, errors, warnings)
  const aiDietaryFeatures = dietaryFeaturesField(obj.dietaryFeatures, errors, warnings)

  if (errors.length > 0) {
    return { ok: false, errors, warnings, rawPreview: stripped.slice(0, 300) }
  }

  return {
    ok: true,
    dish: {
      id: id!,
      name: name!,
      category: category!,
      tags: tags!,
      intro: intro || '这是一道刚录入的家庭菜。',
      cookMethod: cookMethod!,
      cookTime: cookTime!,
      color: color || pickRandomColor(),
      ingredients: ingredients!,
      steps: steps!,
      aiNutrition,
      aiHealthScore,
      aiDietaryFeatures,
    },
    warnings,
  }
}

// —— 字段解析器 ——

function stringField(value: unknown, key: string, errors: string[], optional = false): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (!optional) errors.push(`缺少必填字段：${key}`)
    return undefined
  }
  if (typeof value !== 'string') {
    errors.push(`${key} 必须是字符串`)
    return undefined
  }
  return value.trim()
}

function categoryField(value: unknown, errors: string[]): DishCategory | undefined {
  if (typeof value !== 'string') {
    errors.push('category 必须是字符串')
    return undefined
  }
  if (!VALID_CATEGORIES.includes(value as DishCategory)) {
    errors.push(`category 取值必须是 ${VALID_CATEGORIES.join('、')} 之一，实际是 "${value}"`)
    return undefined
  }
  return value as DishCategory
}

function cookMethodField(value: unknown, errors: string[], warnings: string[]): string | undefined {
  if (typeof value !== 'string') {
    errors.push('cookMethod 必须是字符串')
    return undefined
  }
  // 先做常见写法归一（"热锅快炒"→"炒"），再校验枚举
  const normalized = normalizeCookMethod(value)
  if (normalized !== value && VALID_METHODS.includes(normalized)) {
    warnings.push(`cookMethod "${value}" 已归一为 "${normalized}"`)
    return normalized
  }
  if (!VALID_METHODS.includes(normalized)) {
    warnings.push(`cookMethod "${normalized}" 不在常见烹饪方式列表里，会按原值保留`)
    return normalized
  }
  return normalized
}

function colorField(value: unknown, warnings: string[]): string | undefined {
  if (typeof value !== 'string') return undefined
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
    warnings.push(`color "${value}" 不是合法 #rrggbb 格式，会自动随机分配`)
    return undefined
  }
  return value
}

function tagsField(value: unknown, errors: string[], warnings: string[]): string[] | undefined {
  if (!Array.isArray(value)) {
    errors.push('tags 必须是字符串数组')
    return undefined
  }
  const tags = value.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)
  // 空数组降级：不阻断，给默认标签，让菜仍可入库。
  if (tags.length === 0) {
    warnings.push('tags 为空，已填默认标签「家常」')
    return ['家常']
  }
  if (tags.length > 6) warnings.push(`tags 有 ${tags.length} 项，建议保留 ≤ 6 个`)
  return tags
}

function ingredientsField(
  value: unknown,
  errors: string[],
  warnings: string[],
): Array<{ name: string; amount: string; group: IngredientGroup }> | undefined {
  if (!Array.isArray(value)) {
    errors.push('ingredients 必须是数组')
    return undefined
  }
  if (value.length === 0) errors.push('ingredients 至少需要 1 项')
  if (value.length < 3) warnings.push(`ingredients 只有 ${value.length} 项，建议补到 3 项以上`)
  if (value.length > 12) warnings.push(`ingredients 有 ${value.length} 项，超过家庭菜的常见复杂度`)

  const out: Array<{ name: string; amount: string; group: IngredientGroup }> = []
  value.forEach((item, idx) => {
    if (!item || typeof item !== 'object') {
      errors.push(`ingredients[${idx}] 不是对象`)
      return
    }
    const o = item as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    const rawAmount = typeof o.amount === 'string' ? o.amount.trim() : ''
    const group = typeof o.group === 'string' ? o.group.trim() : ''
    // 克重归一：300g / 300克 / 300 → "300 克"
    const amount = rawAmount ? normalizeAmount(rawAmount) : ''
    if (!name) errors.push(`ingredients[${idx}].name 缺失`)
    if (!amount) errors.push(`ingredients[${idx}].amount 缺失`)
    if (!group) errors.push(`ingredients[${idx}].group 缺失`)
    if (group && !VALID_GROUPS.includes(group as IngredientGroup)) {
      errors.push(`ingredients[${idx}].group "${group}" 取值必须是 ${VALID_GROUPS.join('、')} 之一`)
    }
    if (rawAmount && amount !== rawAmount) {
      warnings.push(`ingredients[${idx}].amount "${rawAmount}" 已归一为 "${amount}"`)
    }
    if (name && amount && group) {
      out.push({ name, amount, group: group as IngredientGroup })
    }
  })
  return out
}

function stepsField(value: unknown, errors: string[], warnings: string[]): string[] | undefined {
  if (!Array.isArray(value)) {
    errors.push('steps 必须是字符串数组')
    return undefined
  }
  const steps = value.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
  if (steps.length === 0) errors.push('steps 至少需要 1 步')
  if (steps.length < 3) warnings.push(`steps 只有 ${steps.length} 步，建议补到 3 步以上`)
  if (steps.length > 8) warnings.push(`steps 有 ${steps.length} 步，建议拆成多道菜`)
  return steps
}

function nutritionField(value: unknown, _errors: string[], warnings: string[]): AIParsedDish['aiNutrition'] {
  if (value === undefined || value === null) return undefined
  if (!value || typeof value !== 'object') {
    warnings.push('nutrition 不是对象，已忽略')
    return undefined
  }
  const o = value as Record<string, unknown>
  // 标准字段名（_g/_mg 后缀）+ AI 常见别名（无后缀），都认。
  // 顺序：先标准名，找不到再试别名。
  const fieldAliases: Record<string, string[]> = {
    kcal: ['kcal', 'energy', 'calories'],
    protein_g: ['protein_g', 'protein'],
    carbs_g: ['carbs_g', 'carbs', 'carbohydrates'],
    fat_g: ['fat_g', 'fat', 'total_fat'],
    fiber_g: ['fiber_g', 'fiber', 'dietary_fiber'],
    sodium_mg: ['sodium_mg', 'sodium', 'na'],
    sugar_g: ['sugar_g', 'sugar'],
    satFat_g: ['satFat_g', 'saturated_fat', 'saturatedFat', 'sat_fat'],
  }
  const numFields: Record<string, number> = {}
  for (const [standardKey, aliases] of Object.entries(fieldAliases)) {
    let v: unknown
    let usedAlias = standardKey
    for (const alias of aliases) {
      if (o[alias] !== undefined && o[alias] !== null) {
        v = o[alias]
        usedAlias = alias
        break
      }
    }
    if (typeof v !== 'number' || v < 0) {
      warnings.push(`nutrition.${standardKey} 不是合法数字，已忽略`)
      numFields[standardKey] = 0
    } else {
      if (usedAlias !== standardKey) {
        warnings.push(`nutrition.${usedAlias} 已识别为 ${standardKey}`)
      }
      numFields[standardKey] = v
    }
  }
  return {
    kcal: numFields.kcal,
    protein: numFields.protein_g,
    carbs: numFields.carbs_g,
    fat: numFields.fat_g,
    fiber: numFields.fiber_g,
    sodium: numFields.sodium_mg,
    sugar: numFields.sugar_g,
    satFat: numFields.satFat_g,
  }
}

function healthScoreField(value: unknown, _errors: string[], warnings: string[]): AIParsedDish['aiHealthScore'] {
  if (value === undefined || value === null) return undefined
  if (!value || typeof value !== 'object') {
    warnings.push('healthScore 不是对象，已忽略')
    return undefined
  }
  const o = value as Record<string, unknown>
  const score = typeof o.score === 'number' ? o.score : NaN
  const reason = typeof o.reason === 'string' ? o.reason : ''
  if (Number.isNaN(score) || score < 0 || score > 100) {
    warnings.push('healthScore.score 不在 0-100，已忽略；本地算法会自动计算')
    return undefined
  }
  return { score: Math.round(score), reason: reason.slice(0, 30) }
}

function dietaryFeaturesField(value: unknown, _errors: string[], warnings: string[]): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: string[] = []
  for (const k of value) {
    if (typeof k !== 'string') continue
    if (!VALID_FEATURE_KEYS.has(k)) {
      warnings.push(`dietaryFeatures key "${k}" 不在词表里，已忽略`)
      continue
    }
    out.push(k)
  }
  if (out.length === 0) return undefined
  return out
}

// —— 工具 ——

// 中文数字→阿拉伯，用于 amount 归一（仅覆盖家庭常用 0-9 与十/百）。
const CN_NUM: Record<string, string> = {
  '零': '0', '一': '1', '二': '2', '两': '2', '三': '3', '四': '4',
  '五': '5', '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
}

/**
 * 归一 amount 字段为 "数字 克" 格式。
 * 容错：300g / 300克 / 300 / 300 g / 三百克 / 1勺 → 统一成 "<n> 克"。
 * 无法解析（如"适量""少许"）时原样返回，交给上层决定。
 */
function normalizeAmount(raw: string): string {
  const s = raw.trim()
  if (!s) return s
  // 先把中文数字逐字替换（粗略，够家庭用量用）
  let cn = s
  for (const [k, v] of Object.entries(CN_NUM)) {
    cn = cn.split(k).join(v)
  }
  // 匹配首个数字（可带小数）
  const m = cn.match(/(\d+(?:\.\d+)?)/)
  if (!m) return s // 没数字，原样返回（如"适量"）
  const num = m[1]
  // 已是 "<n> 克" 直接返回
  if (s === `${num} 克`) return s
  return `${num} 克`
}

// 常见 cookMethod 写法 → 标准枚举映射（仅解析层归一，不改源数据）。
const COOK_METHOD_ALIASES: Record<string, string> = {
  '热锅快炒': '炒', '快炒': '炒', '翻炒': '炒', '小炒': '炒', '清炒': '炒', '爆炒': '炒',
  '红烧': '炖', '焖烧': '焖', '红焖': '焖', '黄焖': '焖',
  '水煮': '煮', '白灼': '煮', '焯': '煮',
  '清蒸': '蒸', '隔水蒸': '蒸',
  '香煎': '煎', '生煎': '煎', '干煎': '煎',
  '清炖': '炖', '慢炖': '炖', '煲汤': '煲', '炖汤': '煲',
  '烤制': '烤', '烘烤': '烤',
  '凉拌': '凉拌', '凉调': '凉拌',
  '生拌': '拌', '调拌': '拌',
}

function normalizeCookMethod(raw: string): string {
  const s = raw.trim()
  return COOK_METHOD_ALIASES[s] ?? s
}

function stripMarkdownFence(input: string): string {
  const trimmed = input.trim()
  // 1) 去掉 ```json ... ``` 或 ``` ... ``` 整段包裹
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenceMatch) return fenceMatch[1].trim()
  // 2) AI 经常在 JSON 前后夹带解释文字（"好的，这是结果：{...}"）。
  //    提取第一个 `{` 到最后一个 `}` 之间的内容，宽松容错。
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim()
  }
  return trimmed
}

const COLOR_POOL = [
  '#d47a62', '#7fbf8f', '#86bfa8', '#6fa7b8', '#91b87d',
  '#e58f6f', '#a6bf75', '#8bbf78', '#c08a63', '#b7a67a',
  '#93a7c6', '#b99b63', '#8ec077', '#78b88e', '#e0a05f',
]

function pickRandomColor(): string {
  return COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)]
}

// —— 批量解析：支持粘贴 JSON 数组、多个 JSON 对象（每行/每段一个） ——

export type BatchParseItem =
  | { index: number; ok: true; dish: AIParsedDish; warnings: string[] }
  | { index: number; ok: false; errors: string[]; warnings: string[]; rawPreview?: string }

export type BatchParseResult = {
  items: BatchParseItem[]
  totalCount: number
  successCount: number
  failureCount: number
}

/**
 * 把输入文本拆成多个 JSON 片段，再逐个调用 parseAIRecipeJson。
 * 支持三种格式：
 *   1) JSON 数组：[ {...}, {...} ]
 *   2) 多个顶层对象，按 { ... } 嵌套深度配对（多道菜每行一段）
 *   3) 单个对象（退化为长度 1 的批量）
 */
export function parseAIRecipeJsonBatch(input: string): BatchParseResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { items: [], totalCount: 0, successCount: 0, failureCount: 0 }
  }

  // 1) 优先尝试 JSON.parse 顶层为数组的情况
  const segments: string[] = []
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        segments.push(JSON.stringify(item))
      }
    } else if (parsed && typeof parsed === 'object') {
      segments.push(JSON.stringify(parsed))
    }
  } catch {
    // 不是合法的整体 JSON，按多段提取
  }

  if (segments.length === 0) {
    segments.push(...splitJsonObjects(trimmed))
  }

  const items: BatchParseItem[] = segments.map((seg, index) => {
    const result = parseAIRecipeJson(seg)
    if (result.ok) {
      return { index, ok: true, dish: result.dish, warnings: result.warnings }
    }
    return {
      index,
      ok: false,
      errors: result.errors,
      warnings: result.warnings,
      rawPreview: result.rawPreview,
    }
  })

  return {
    items,
    totalCount: items.length,
    successCount: items.filter((item) => item.ok).length,
    failureCount: items.filter((item) => !item.ok).length,
  }
}

/**
 * 按大括号嵌套深度把一段文本拆成多个顶层 JSON 对象。
 * 处理“每行一道 JSON”或“AI 在两道菜之间夹了换行/逗号”的情况。
 */
function splitJsonObjects(input: string): string[] {
  const segments: string[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escape = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') {
      if (depth === 0) start = i
      depth += 1
      continue
    }
    if (ch === '}') {
      depth -= 1
      if (depth === 0 && start >= 0) {
        const seg = input.slice(start, i + 1).trim()
        if (seg) segments.push(seg)
        start = -1
      }
    }
  }
  return segments
}