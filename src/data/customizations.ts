import type {
  Customization,
  CustomizationModification,
  Dish,
  Ingredient,
} from '../types'
import { CUSTOMIZATIONS_STORAGE_KEY } from '../types'

// 读出当前浏览器里保存的全部定制菜
export function readCustomizations(): Customization[] {
  try {
    const raw = window.localStorage.getItem(CUSTOMIZATIONS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCustomization)
  } catch {
    return []
  }
}

export function writeCustomizations(list: Customization[]) {
  try {
    window.localStorage.setItem(CUSTOMIZATIONS_STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore quota / privacy mode
  }
}

export function upsertCustomization(value: Customization): Customization[] {
  const list = readCustomizations()
  const index = list.findIndex((c) => c.id === value.id)
  const next: Customization = { ...value, updatedAt: Date.now() }
  if (index >= 0) {
    list[index] = next
  } else {
    list.push(next)
  }
  writeCustomizations(list)
  return list
}

export function deleteCustomization(id: string): Customization[] {
  const list = readCustomizations().filter((c) => c.id !== id)
  writeCustomizations(list)
  return list
}

export function getCustomizationsForBase(baseDishId: string): Customization[] {
  return readCustomizations().filter((c) => c.baseDishId === baseDishId)
}

// 类型守卫：剔除 localStorage 里被外部污染的脏数据
function isCustomization(value: unknown): value is Customization {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.baseDishId === 'string' &&
    typeof v.ownerId === 'string' &&
    typeof v.variantName === 'string' &&
    typeof v.modification === 'object' &&
    v.modification !== null &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number'
  )
}

// 把定制覆盖层应用到基础菜上，生成一个新的"派生菜"
// 返回 Dish 但用 `id` 加后缀区分；UI 侧用 isCustomizedDish 识别
export function applyCustomization(base: Dish, customization: Customization): Dish {
  const modification: CustomizationModification = customization.modification
  const ingredients: Ingredient[] = base.ingredients.map((ing) => {
    const overrideAmount = modification.ingredientAdjustments?.[ing.name]
    if (overrideAmount === undefined) return ing
    if (overrideAmount === '') {
      // 空字符串 = 删除该食材
      return { ...ing, amount: '' }
    }
    return { ...ing, amount: overrideAmount }
  }).filter((ing) => ing.amount !== '')

  const steps = modification.steps ?? base.steps

  return {
    ...base,
    id: `${base.id}__${customization.id}`,
    name: customization.variantName.trim() || `${base.name}（定制版）`,
    ingredients,
    steps,
  }
}

// 找一道菜的"我的定制版"（ownerId 固定为 'me'，单用户场景）
export function findMyCustomization(baseDishId: string, ownerId = 'me'): Customization | undefined {
  return readCustomizations().find((c) => c.baseDishId === baseDishId && c.ownerId === ownerId)
}

// 生成定制菜唯一 ID：customization-<timestamp>-<random>
export function newCustomizationId(): string {
  return `customization-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}