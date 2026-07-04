// ============================================================================
// 我家版本(MyDishVersion) — 数据层 CRUD
// ----------------------------------------------------------------------------
// 2026-06-25 P0-4 拍板:
//   - Q1=A Tab 切换    - Q2=4 字段(ingredients/steps/cookTime/myNote)
//   - Q3=我家版≡我做过  - Q4=做完弹窗 + 详情页双入口
//   - Q5=重置二次确认  - Q6=列表+详情双显徽章
//
// 存储:Record<dishId, MyDishVersion> — 每道菜最多 1 版(单数)
// ============================================================================
import type { Dish, Ingredient, MyDishVersion } from '../types'
import { MY_DISH_VERSIONS_STORAGE_KEY } from '../types'
import { getLogsForDish } from './mealLog'

export const MY_DISH_VERSION_CHANGE_EVENT = 'fandazi:my-dish-version-change'

// 写入时的输入(不含 createdAt/updatedAt,由本模块管理)
export interface MyDishVersionInput {
  dishId: string
  ingredients: Ingredient[]
  steps: string[]
  cookTime: string
  myNote: string
}

// 单道菜的改动统计 — 给徽角标显示用("3 处改动")
export interface VersionDiffSummary {
  ingredientChanged: number // 改 amount
  ingredientAdded: number
  ingredientRemoved: number
  stepsChanged: number
  cookTimeChanged: boolean
  hasMyNote: boolean
  /** 总改动数(展示用):食材新增+删除+改 + 步骤改 + 时长改 + 备注 */
  totalChanges: number
}

// ------------------------------------------------------------------ low-level

type Store = Record<string, MyDishVersion>

function readStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(MY_DISH_VERSIONS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: Store): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MY_DISH_VERSIONS_STORAGE_KEY, JSON.stringify(store))
    window.dispatchEvent(
      new CustomEvent(MY_DISH_VERSION_CHANGE_EVENT, {
        detail: { dishIds: Object.keys(store) },
      })
    )
  } catch {
    // 容量等异常忽略
  }
}

// ------------------------------------------------------------------ public

/** 读取一道菜的我家版(无则 null) */
export function getMyDishVersion(dishId: string): MyDishVersion | null {
  return readStore()[dishId] ?? null
}

/** 这道菜有没有我家版?(列表徽章用) */
export function hasMyDishVersion(dishId: string): boolean {
  return getMyDishVersion(dishId) !== null
}

/** 列出所有有我家版的 dishId 集合(总览 / 计数用) */
export function listMyVersionDishIds(): string[] {
  return Object.keys(readStore())
}

/** 这道菜是否「能」创建我家版?(Q3 锁:必须做过) */
export function canCreateMyVersion(dishId: string): boolean {
  return getLogsForDish(dishId).length > 0
}

/**
 * 写/更新我家版 — upsert 语义。
 * 守卫:必须先做过(canCreateMyVersion),否则抛错(Q3)。
 */
export function saveMyDishVersion(input: MyDishVersionInput): MyDishVersion {
  if (!canCreateMyVersion(input.dishId)) {
    throw new Error(
      `[myDishVersions] 不能创建 ${input.dishId} 的我家版 — 还没做过(Q3 规则)`
    )
  }
  const store = readStore()
  const existing = store[input.dishId]
  const now = Date.now()
  const version: MyDishVersion = {
    dishId: input.dishId,
    ingredients: input.ingredients,
    steps: input.steps,
    cookTime: input.cookTime,
    myNote: input.myNote,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  store[input.dishId] = version
  writeStore(store)
  return version
}

/** 重置:删除一道菜的我家版(Q5 二次确认在 UI 层做) */
export function resetMyDishVersion(dishId: string): void {
  const store = readStore()
  if (!(dishId in store)) return
  delete store[dishId]
  writeStore(store)
}

// ------------------------------------------------------------------ diff

/**
 * 计算我家版相对标准菜谱的改动统计。
 * 用于:① 列表/详情徽章「3 处改动」② 重置弹窗「这会清除 5 处改动」
 */
export function computeVersionDiff(
  standardDish: Dish,
  version: MyDishVersion
): VersionDiffSummary {
  // ---- 食材 diff(以 name 为键)
  const stdIngMap = new Map(standardDish.ingredients.map(i => [i.name, i]))
  const myIngNames = new Set(version.ingredients.map(i => i.name))

  let ingredientChanged = 0
  let ingredientAdded = 0
  let ingredientRemoved = 0

  for (const myIng of version.ingredients) {
    const std = stdIngMap.get(myIng.name)
    if (!std) {
      ingredientAdded++
    } else if (std.amount !== myIng.amount) {
      ingredientChanged++
    }
  }
  for (const stdIng of standardDish.ingredients) {
    if (!myIngNames.has(stdIng.name)) ingredientRemoved++
  }

  // ---- 步骤 diff:按索引比较;长度差也算改
  let stepsChanged = 0
  const maxLen = Math.max(standardDish.steps.length, version.steps.length)
  for (let i = 0; i < maxLen; i++) {
    if (standardDish.steps[i] !== version.steps[i]) stepsChanged++
  }

  const cookTimeChanged = standardDish.cookTime !== version.cookTime
  const hasMyNote = version.myNote.trim().length > 0

  const totalChanges =
    ingredientChanged +
    ingredientAdded +
    ingredientRemoved +
    stepsChanged +
    (cookTimeChanged ? 1 : 0) +
    (hasMyNote ? 1 : 0)

  return {
    ingredientChanged,
    ingredientAdded,
    ingredientRemoved,
    stepsChanged,
    cookTimeChanged,
    hasMyNote,
    totalChanges,
  }
}

/**
 * 取一道菜的"有效"展示版本 — Tab=A 切换时用:
 *   - tab='standard' → 返回标准菜谱(原 Dish)
 *   - tab='myhome' 且有我家版 → 返回叠加后的 Dish
 *   - tab='myhome' 但无我家版 → 返回 null(UI 应展示"还没改造过")
 */
export function getEffectiveDish(
  standardDish: Dish,
  tab: 'standard' | 'myhome'
): Dish | null {
  if (tab === 'standard') return standardDish
  const version = getMyDishVersion(standardDish.id)
  if (!version) return null
  return {
    ...standardDish,
    ingredients: version.ingredients,
    steps: version.steps,
    cookTime: version.cookTime,
  }
}
