// ============================================================================
// pantryStorage — P0-5 库存 CRUD (主档 §10.3)
// ----------------------------------------------------------------------------
// 存储模式:跟 myDishVersions.ts 一致
//   readStore / writeStore + localStorage + CustomEvent
// 旧 string[] (fandazi.pantry) 自动迁移到新 PantryItem[] (fandazi.pantry.v2)
// ============================================================================

import type { PantryItem, IngredientGroup, PantryStorage, PantrySource } from '../types'
import {
  PANTRY_STORAGE_KEY,
  PANTRY_CHANGE_EVENT,
  PANTRY_LEGACY_KEY,
} from '../types'
import { calcBestBeforeAt } from './ingredientShelfLife'
import { calcStatus } from './pantryStatus'
import { getGroupFromSubCategory, getSubCategory } from './ingredientSubstitutes'
import { parseAmount } from './amountParser'
import { convertToGrams } from './unitConversion'

// ------------------------------------------------------------------ types

export interface PantryItemInput {
  ingredientName: string
  category?: IngredientGroup       // 不传则自动推断
  quantity: number
  unit: string
  storage: PantryStorage
  boughtAt: string                 // ISO date
  source?: PantrySource
  note?: string
}

// ------------------------------------------------------------------ low-level

function readStore(): PantryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PANTRY_STORAGE_KEY)
    if (!raw) {
      // 尝试迁移旧数据
      return migrateLegacy()
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function writeStore(items: PantryItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PANTRY_STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(
      new CustomEvent(PANTRY_CHANGE_EVENT, {
        detail: { count: items.length },
      }),
    )
  } catch {
    // 容量等异常忽略
  }
}

// ------------------------------------------------------------------ 迁移

/**
 * 将旧 string[] (fandazi.pantry) 迁移到新 PantryItem[] (fandazi.pantry.v2)。
 * 迁移后删除旧 key。
 */
function migrateLegacy(): PantryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const legacyRaw = window.localStorage.getItem(PANTRY_LEGACY_KEY)
    if (!legacyRaw) return []

    const names = JSON.parse(legacyRaw)
    if (!Array.isArray(names) || names.length === 0) {
      // 清空旧 key
      window.localStorage.removeItem(PANTRY_LEGACY_KEY)
      return []
    }

    const now = new Date().toISOString()
    const items: PantryItem[] = names.map((name: string) => {
      const sub = getSubCategory(name)
      const category = getGroupFromSubCategory(sub)
      const storage: PantryStorage = 'fridge'
      const bestBeforeAt = calcBestBeforeAt(now, name, storage)
      const status = calcStatus(now, bestBeforeAt)

      return {
        id: generateId(),
        ingredientName: name,
        category,
        quantity: 1,
        unit: '克',
        storage,
        boughtAt: now,
        bestBeforeAt,
        source: 'manual_add' as PantrySource,
        status,
      }
    })

    // 写入新 key,删除旧 key
    window.localStorage.setItem(PANTRY_STORAGE_KEY, JSON.stringify(items))
    window.localStorage.removeItem(PANTRY_LEGACY_KEY)

    return items
  } catch {
    return []
  }
}

// ------------------------------------------------------------------ utils

function generateId(): string {
  return `pantry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function refreshStatus(item: PantryItem): PantryItem {
  return {
    ...item,
    status: calcStatus(item.boughtAt, item.bestBeforeAt),
  }
}

// ------------------------------------------------------------------ public CRUD

/** 读取全部库存项(自动刷新状态) */
export function readPantryItems(): PantryItem[] {
  return readStore().map(refreshStatus)
}

/** 按 id 读取单个库存项 */
export function getPantryItemById(id: string): PantryItem | null {
  return readPantryItems().find((i) => i.id === id) ?? null
}

/** 添加食材到库存 */
export function addPantryItem(input: PantryItemInput): PantryItem {
  const items = readStore()
  const category = input.category ?? getGroupFromSubCategory(getSubCategory(input.ingredientName))
  const bestBeforeAt = calcBestBeforeAt(input.boughtAt, input.ingredientName, input.storage)
  const status = calcStatus(input.boughtAt, bestBeforeAt)

  const item: PantryItem = {
    id: generateId(),
    ingredientName: input.ingredientName,
    category,
    quantity: input.quantity,
    unit: input.unit,
    storage: input.storage,
    boughtAt: input.boughtAt,
    bestBeforeAt,
    source: input.source ?? 'manual_add',
    status,
    note: input.note,
  }

  items.push(item)
  writeStore(items)
  return item
}

/** 更新库存项(upsert 语义:id 存在则更新,不存在则忽略) */
export function updatePantryItem(id: string, patch: Partial<PantryItemInput>): PantryItem | null {
  const items = readStore()
  const idx = items.findIndex((i) => i.id === id)
  if (idx === -1) return null

  const existing = items[idx]
  const updated: PantryItem = {
    ...existing,
    ...patch,
    ingredientName: patch.ingredientName ?? existing.ingredientName,
    quantity: patch.quantity ?? existing.quantity,
    unit: patch.unit ?? existing.unit,
    storage: patch.storage ?? existing.storage,
    boughtAt: patch.boughtAt ?? existing.boughtAt,
    note: patch.note ?? existing.note,
  }

  // 如果食材名/存储/购买日期变了,重新计算赏味期和状态
  if (
    patch.ingredientName !== undefined ||
    patch.storage !== undefined ||
    patch.boughtAt !== undefined
  ) {
    updated.bestBeforeAt = calcBestBeforeAt(updated.boughtAt, updated.ingredientName, updated.storage)
    updated.category = patch.category ?? getGroupFromSubCategory(getSubCategory(updated.ingredientName))
  }
  updated.status = calcStatus(updated.boughtAt, updated.bestBeforeAt)

  items[idx] = updated
  writeStore(items)
  return updated
}

/** 删除库存项 */
export function removePantryItem(id: string): void {
  const items = readStore()
  const filtered = items.filter((i) => i.id !== id)
  if (filtered.length !== items.length) {
    writeStore(filtered)
  }
}

/** 清空库存 */
export function clearPantry(): void {
  writeStore([])
}

// ------------------------------------------------------------------ 查询

/** 按食材名查找库存项(含同义词匹配) */
export function findByName(
  name: string,
  items?: PantryItem[],
): PantryItem | null {
  const list = items ?? readPantryItems()
  return list.find((i) => i.ingredientName === name) ?? null
}

/** 获取库存中所有食材名集合 */
export function getPantryNames(): string[] {
  return readPantryItems().map((i) => i.ingredientName)
}

/** 库存项总数 */
export function getPantryCount(): number {
  return readStore().length
}

/** 导出库存(备份用) */
export function exportPantry(): PantryItem[] {
  return readStore()
}

/** 导入库存(恢复用,覆盖) */
export function importPantry(items: PantryItem[]): void {
  writeStore(items)
}

/** 从旧 string[] 食材名列表创建 PantryItem[]（备份恢复用） */
export function createPantryFromNames(names: string[]): PantryItem[] {
  const now = new Date().toISOString()
  return names.map((name) => {
    const category = getGroupFromSubCategory(getSubCategory(name))
    const storage: PantryStorage = 'fridge'
    const bestBeforeAt = calcBestBeforeAt(now, name, storage)
    const status = calcStatus(now, bestBeforeAt)
    return {
      id: generateId(),
      ingredientName: name,
      category,
      quantity: 1,
      unit: '克',
      storage,
      boughtAt: now,
      bestBeforeAt,
      source: 'manual_add' as PantrySource,
      status,
    }
  })
}

// ------------------------------------------------------------------
// P1-5: 做完菜后扣减库存
// ------------------------------------------------------------------

/**
 * P1-5: 做完菜后按菜谱食材扣减库存
 * 遍历菜谱食材,换算到克,从库存中扣减对应克数
 * @param ingredients 菜谱食材列表 [{ name, amount }]
 * @returns 扣减结果摘要(每项:{ 食材名, 扣减克数, 剩余克数 })
 */
export function deductPantryAfterCook(
  ingredients: Array<{ name: string; amount: string }>,
): Array<{ name: string; deductedGrams: number; remainingGrams: number }> {
  const items = readPantryItems()
  const results: Array<{ name: string; deductedGrams: number; remainingGrams: number }> = []

  for (const ingredient of ingredients) {
    const parsed = parseAmount(ingredient.amount)
    if (!parsed.value || !parsed.unit) continue

    // 菜谱需求量 → 克
    const needGrams = parsed.unit === '克'
      ? parsed.value
      : convertToGrams(ingredient.name, parsed.value, parsed.unit)
    if (needGrams === null) continue

    // 找到对应库存项
    const match = items.find((p) => p.ingredientName === ingredient.name)
    if (!match) continue

    // 库存量 → 克
    const haveGrams = match.unit === '克'
      ? match.quantity
      : convertToGrams(ingredient.name, match.quantity, match.unit)
    if (haveGrams === null) continue

    const remainingGrams = Math.round(haveGrams - needGrams)

    if (remainingGrams <= 0) {
      // 用完 → 移除库存项
      removePantryItem(match.id)
      results.push({ name: ingredient.name, deductedGrams: haveGrams, remainingGrams: 0 })
    } else {
      // 还有剩余 → 更新库存量(保持原单位)
      if (match.unit === '克') {
        updatePantryItem(match.id, { quantity: remainingGrams })
      } else {
        const gramsPerUnit = convertToGrams(ingredient.name, 1, match.unit)
        if (gramsPerUnit) {
          updatePantryItem(match.id, {
            quantity: Math.round((remainingGrams / gramsPerUnit) * 100) / 100,
          })
        } else {
          // 无法换算回原单位 → 改用克
          updatePantryItem(match.id, { quantity: remainingGrams, unit: '克' })
        }
      }
      results.push({ name: ingredient.name, deductedGrams: needGrams, remainingGrams })
    }
  }

  return results
}
