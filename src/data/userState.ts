/**
 * 用户状态判断逻辑（Phase 1）
 *
 * 状态流转（2026-06-30 修正）：
 *   未登录 → 登录/注册账号 → 正常首页
 *
 * 家庭空间与基础偏好不再作为前置门槛，改为进入 App 后在“我的/偏好”补充。
 */

import { HEALTH_PROFILES_STORAGE_KEY } from '../components/healthProfileStorage'

// ─────────────────────────────────────────────────────────────────────
// 1. 状态枚举
// ─────────────────────────────────────────────────────────────────────

export type UserState =
  | 'unauthenticated'   // 未登录（Phase 4 实现）
  | 'no-family-space'   // 已登录，未创建家庭空间
  | 'no-preferences'    // 有家庭空间，未设置基础偏好
  | 'ready'             // 一切就绪，进入正常首页

// ─────────────────────────────────────────────────────────────────────
// 2. localStorage 键
// ─────────────────────────────────────────────────────────────────────

const LOGGED_IN_KEY = 'fandazi.loggedIn'
const FAMILY_SPACE_CREATED_KEY = 'fandazi.familySpaceCreated'
const PREFERENCES_SET_KEY = 'fandazi.preferencesSet'
const BASIC_PREFS_KEY = 'fandazi.basicPreferences'

// ─────────────────────────────────────────────────────────────────────
// 3. 基础偏好类型 & 读写
// ─────────────────────────────────────────────────────────────────────

export type BasicPreferences = {
  /** 常做饭时间 */
  mealTimes: string[] // ['breakfast', 'lunch', 'dinner']
  /** 饮食目标 */
  dietGoals: string[] // ['日常家常', '控脂控糖', '清淡一点', '省钱快手']
  /** 不吃什么 */
  avoidances: string[]
  /** 是否开启冰箱提醒 */
  enableFridgeReminder: boolean
}

export function readBasicPreferences(): BasicPreferences | null {
  try {
    const raw = localStorage.getItem(BASIC_PREFS_KEY)
    return raw ? (JSON.parse(raw) as BasicPreferences) : null
  } catch {
    return null
  }
}

export function writeBasicPreferences(prefs: BasicPreferences): void {
  try {
    localStorage.setItem(BASIC_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

// ─────────────────────────────────────────────────────────────────────
// 4. 状态检查函数
// ─────────────────────────────────────────────────────────────────────

/**
 * 是否已登录。
 * Phase 1：恒为 true（mock）。
 * Phase 4：接入真实登录页后改为检查 LOGGED_IN_KEY。
 */
export function isLoggedIn(): boolean {
  try {
    return localStorage.getItem(LOGGED_IN_KEY) === 'true'
  } catch {
    return false
  }
}

export function setLoggedIn(value: boolean): void {
  try {
    localStorage.setItem(LOGGED_IN_KEY, String(value))
  } catch {
    /* ignore */
  }
}

/**
 * 是否已创建家庭空间。
 * 向后兼容：如果 fandazi.familySize 已有值（>0），视为已创建。
 */
export function hasFamilySpace(): boolean {
  try {
    if (localStorage.getItem(FAMILY_SPACE_CREATED_KEY) === 'true') return true
    // 向后兼容：老用户已有 familySize 值
    const raw = localStorage.getItem('fandazi.familySize')
    if (raw) {
      const n = Number(raw)
      if (Number.isFinite(n) && n >= 1) {
        // 自动补标记，避免老用户被强制走 onboarding
        localStorage.setItem(FAMILY_SPACE_CREATED_KEY, 'true')
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

export function setFamilySpaceCreated(): void {
  try {
    localStorage.setItem(FAMILY_SPACE_CREATED_KEY, 'true')
  } catch {
    /* ignore */
  }
}

/**
 * 是否已设置基础偏好。
 * 向后兼容：如果已有健康画像数据，视为已设置。
 */
export function hasPreferencesSet(): boolean {
  try {
    if (localStorage.getItem(PREFERENCES_SET_KEY) === 'true') return true
    // 向后兼容：老用户已有健康画像
    const raw = localStorage.getItem(HEALTH_PROFILES_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        localStorage.setItem(PREFERENCES_SET_KEY, 'true')
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

export function setPreferencesSet(): void {
  try {
    localStorage.setItem(PREFERENCES_SET_KEY, 'true')
  } catch {
    /* ignore */
  }
}

/**
 * 是否有菜单数据（用于首页空状态判断，Phase 2 使用）。
 * 检查：自定义菜谱、餐桌计划、菜品偏好（收藏/常做）。
 */
export function hasMenuData(): boolean {
  try {
    const customDishes = JSON.parse(localStorage.getItem('fandazi.customDishes') || '[]')
    if (Array.isArray(customDishes) && customDishes.length > 0) return true

    const table = JSON.parse(localStorage.getItem('fandazi.table') || '[]')
    if (Array.isArray(table) && table.length > 0) return true

    const prefs = localStorage.getItem('fandazi.dishPreferences')
    if (prefs) {
      const parsed = JSON.parse(prefs)
      if (parsed?.favorite?.length > 0 || parsed?.oftenCooked?.length > 0) return true
    }

    return false
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────
// 5. 主判断函数
// ─────────────────────────────────────────────────────────────────────

export function getUserState(): UserState {
  if (!isLoggedIn()) return 'unauthenticated'
  // 2026-06-30：用户初次使用只需要账号登录；家庭空间/偏好问卷后置到“我的”。
  return 'ready'
}
