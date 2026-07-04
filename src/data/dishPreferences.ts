export type DishPreferenceKey = 'favorite' | 'oftenCooked' | 'cooked' | 'disliked'

// v1.9 偏好精细化：「不想吃」原因分类（2026-06-24 引入）
// 推荐系统读取原因主动避开 + 解释里写明「为什么没推这道」。
export type DislikedReason = 'taste' | 'health' | 'allergy' | 'temporary' | 'other'

export const DISLIKED_REASON_LABEL: Record<DislikedReason, string> = {
  taste: '口味不喜欢',
  health: '健康原因',
  allergy: '过敏 / 忌口',
  temporary: '暂时吃腻了',
  other: '其他',
}

export type DislikedItem = {
  dishId: string
  reason: DislikedReason
  note?: string
  createdAt: string // ISO 8601
}

// v1.9 schema：
// - `disliked`(string[]) 保留作为 dishId 索引列表，向后兼容旧 App.tsx 调用方
//   （v1.4 之前的 dishPreferences.disliked.includes(dishId) 不需要改）
// - `dislikedDetails` 新增字段，存每条「不想吃」的原因 / 备注 / 时间
//   两个字段必须同步：disliked 是 dislikedDetails keys 的镜像
export type DishPreferences = Record<DishPreferenceKey, string[]> & {
  dislikedDetails: Record<string, DislikedItem>
}

export const DISH_PREFERENCES_STORAGE_KEY = 'fandazi.dishPreferences'

export const EMPTY_DISH_PREFERENCES: DishPreferences = {
  favorite: [],
  oftenCooked: [],
  cooked: [],
  disliked: [],
  dislikedDetails: {},
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isDislikedReason(value: unknown): value is DislikedReason {
  return (
    value === 'taste' ||
    value === 'health' ||
    value === 'allergy' ||
    value === 'temporary' ||
    value === 'other'
  )
}

function normalizeDislikedDetails(
  value: unknown,
  dislikedIds: string[],
): Record<string, DislikedItem> {
  const result: Record<string, DislikedItem> = {}
  const sourceMap: Record<string, unknown> =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  for (const dishId of dislikedIds) {
    const raw = sourceMap[dishId]
    if (raw && typeof raw === 'object') {
      const record = raw as Record<string, unknown>
      const reason = isDislikedReason(record.reason) ? record.reason : 'other'
      const note = typeof record.note === 'string' ? record.note : undefined
      const createdAt =
        typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString()
      result[dishId] = { dishId, reason, note, createdAt }
    } else {
      // v1.4 旧数据迁移：只有 dishId 没有原因 → 默认 'other'
      result[dishId] = {
        dishId,
        reason: 'other',
        createdAt: new Date(0).toISOString(),
      }
    }
  }
  return result
}

function normalizePreferences(value: unknown): DishPreferences {
  if (!value || typeof value !== 'object') return EMPTY_DISH_PREFERENCES
  const record = value as Record<string, unknown>
  const favorite = isStringArray(record.favorite) ? Array.from(new Set(record.favorite)) : []
  const oftenCooked = isStringArray(record.oftenCooked)
    ? Array.from(new Set(record.oftenCooked))
    : []
  const cooked = isStringArray(record.cooked) ? Array.from(new Set(record.cooked)) : []
  const disliked = isStringArray(record.disliked) ? Array.from(new Set(record.disliked)) : []
  const dislikedDetails = normalizeDislikedDetails(record.dislikedDetails, disliked)
  return { favorite, oftenCooked, cooked, disliked, dislikedDetails }
}

export function readDishPreferences(): DishPreferences {
  try {
    const raw = window.localStorage.getItem(DISH_PREFERENCES_STORAGE_KEY)
    if (!raw) return EMPTY_DISH_PREFERENCES
    return normalizePreferences(JSON.parse(raw) as unknown)
  } catch {
    return EMPTY_DISH_PREFERENCES
  }
}

export function writeDishPreferences(preferences: DishPreferences): void {
  try {
    window.localStorage.setItem(
      DISH_PREFERENCES_STORAGE_KEY,
      JSON.stringify(normalizePreferences(preferences)),
    )
  } catch {
    // ignore quota / privacy mode
  }
}

export function toggleDishPreference(
  preferences: DishPreferences,
  key: DishPreferenceKey,
  dishId: string,
): DishPreferences {
  const current = new Set(preferences[key])
  const wasOn = current.has(dishId)
  if (wasOn) {
    current.delete(dishId)
  } else {
    current.add(dishId)
  }
  const next: DishPreferences = {
    ...preferences,
    [key]: Array.from(current),
    dislikedDetails: { ...preferences.dislikedDetails },
  }
  // “不想吃”优先级最高：标记不想吃时，从正向偏好里移除；取消不想吃则不自动恢复。
  if (key === 'disliked' && next.disliked.includes(dishId)) {
    next.favorite = next.favorite.filter((id) => id !== dishId)
    next.oftenCooked = next.oftenCooked.filter((id) => id !== dishId)
    // 首次打开不想吃 → 写入默认原因 'other'（UI 后续可调用 setDislikedReason 修改）
    if (!wasOn && !next.dislikedDetails[dishId]) {
      next.dislikedDetails[dishId] = {
        dishId,
        reason: 'other',
        createdAt: new Date().toISOString(),
      }
    }
  }
  // 取消「不想吃」时清理对应 detail
  if (key === 'disliked' && wasOn) {
    delete next.dislikedDetails[dishId]
  }
  // 正向偏好与“不想吃”互斥。
  if ((key === 'favorite' || key === 'oftenCooked') && next[key].includes(dishId)) {
    next.disliked = next.disliked.filter((id) => id !== dishId)
    delete next.dislikedDetails[dishId]
  }
  return next
}

export function hasDishPreference(preferences: DishPreferences, key: DishPreferenceKey, dishId: string): boolean {
  return preferences[key].includes(dishId)
}

// v1.9 新增：更新「不想吃」原因 / 备注（UI 后续接入）
// 若 dishId 不在 disliked 列表中先自动加入。
export function setDislikedReason(
  preferences: DishPreferences,
  dishId: string,
  reason: DislikedReason,
  note?: string,
): DishPreferences {
  const dislikedSet = new Set(preferences.disliked)
  dislikedSet.add(dishId)
  return {
    ...preferences,
    favorite: preferences.favorite.filter((id) => id !== dishId),
    oftenCooked: preferences.oftenCooked.filter((id) => id !== dishId),
    disliked: Array.from(dislikedSet),
    dislikedDetails: {
      ...preferences.dislikedDetails,
      [dishId]: {
        dishId,
        reason,
        note,
        createdAt:
          preferences.dislikedDetails[dishId]?.createdAt ?? new Date().toISOString(),
      },
    },
  }
}

// v1.9 新增：批量读取某个 dishId 的「不想吃」原因；不存在则返回 undefined
export function getDislikedReason(
  preferences: DishPreferences,
  dishId: string,
): DislikedItem | undefined {
  return preferences.dislikedDetails[dishId]
}

// v1.9 新增：按原因分组统计 disliked，供未来推荐解释 / 数据看板使用
export function groupDislikedByReason(
  preferences: DishPreferences,
): Record<DislikedReason, DislikedItem[]> {
  const groups: Record<DislikedReason, DislikedItem[]> = {
    taste: [],
    health: [],
    allergy: [],
    temporary: [],
    other: [],
  }
  for (const dishId of preferences.disliked) {
    const detail =
      preferences.dislikedDetails[dishId] ?? {
        dishId,
        reason: 'other' as DislikedReason,
        createdAt: new Date(0).toISOString(),
      }
    groups[detail.reason].push(detail)
  }
  return groups
}
