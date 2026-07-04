/**
 * 饭搭子组合共享数据层（2026-06-25 v1.11 重构）
 *
 * 概念校正背景：
 * - 旧版（v1.9）:「家庭 4 人 + 执行人单点决策权 + 屠老师=被照顾对象」
 * - 新版（v1.11）:「饭搭子组合 N 人 + 今日掌勺轮流决策权 + 屠老师=平等搭子」
 *
 * 设计原则：
 * - 饭搭子完全平等,无长期身份差(无 executor/suggestor)
 * - 健康画像饭搭子组合内完全共享(无隐私隔离)
 * - 「今日掌勺(todayChef)」=今天谁做饭,持有当日决策权,可随时切换
 * - 偏好冲突时:今日掌勺偏好略加权(不绝对覆盖),因为他实际动手
 * - 收藏(favorite)=个人独立;常做/做过/不想吃=饭搭子组合共享标注
 *
 * 当前阶段(v1.11):前端 mock 饭搭子画像 + 多人偏好聚合
 * 后续阶段(v3.0):后端接入多账号,本模块 schema 保持兼容
 *
 * 命名校正(2026-06-25 P0-1 §1.3/§1.4):
 * - 类型 `Family` → `BuddyGroup`、`FamilyMember` → `BuddyMember`(内部命名对齐"饭搭子组合"概念)
 * - storage key `fandazi.family` → `fandazi.buddyGroup`,readBuddyGroup 回落读老 key 一次后迁移
 *
 * 兼容性说明:
 * - 旧 localStorage key `fandazi.family` 读取时自动迁移到新 key `fandazi.buddyGroup`(保留老 key 一版)
 * - 旧 `executorId` 字段读取时自动映射为 `todayChefId`
 * - 旧 `role: executor/suggestor` 字段读取时静默丢弃
 */

import type { DishPreferences, DislikedReason } from './dishPreferences'
import {
  EMPTY_DISH_PREFERENCES,
  DISLIKED_REASON_LABEL,
  groupDislikedByReason,
} from './dishPreferences'

// ─────────────────────────────────────────────────────────────────────
// 1. 饭搭子成员 / 饭搭子组合
// ─────────────────────────────────────────────────────────────────────

/** 饭搭子健康画像(组合内共享,无隔离) */
export type MemberHealthProfile = {
  goals: string[] // ['减脂', '控糖', '脂肪肝管理', '低钠']
  restrictions: string[] // ['不吃香菜', '海鲜过敏']
  notes?: string
}

export type BuddyMember = {
  id: string
  name: string
  avatar?: string // emoji or image url
  healthProfile: MemberHealthProfile
  /** 每人独立的菜品偏好(收藏个人,其他共享标注) */
  preferences: DishPreferences
}

export type BuddyGroup = {
  id: string
  /** 饭搭子组合名称(可自定义,如"我和屠老师"、"我们家"等) */
  name: string
  members: BuddyMember[]
  /**
   * 今日掌勺 id - 今天谁做饭,持今日决策权,可随时切换。
   * 必须 ∈ members[].id。第一次启动默认是第一个成员(通常是"我")。
   */
  todayChefId: string
}

export const BUDDY_GROUP_STORAGE_KEY = 'fandazi.buddyGroup'

/** @deprecated v1.9/v1.10 老 key,readBuddyGroup 回落读取一次后迁移到新 key */
const LEGACY_FAMILY_STORAGE_KEY = 'fandazi.family'

// ─────────────────────────────────────────────────────────────────────
// 2. 默认 mock 饭搭子组合(2 人:我 + 屠老师 - 当前真实饭搭子)
//    依据 2026-06-25 用户拍板:屠老师是平等搭子,非被照顾对象
//    爸妈不在默认组合(可通过"我的"页手动添加更多搭子)
// ─────────────────────────────────────────────────────────────────────

export const DEFAULT_BUDDY_GROUP: BuddyGroup = {
  id: 'buddy-group-default',
  name: '我和屠老师',
  todayChefId: 'member-me',
  members: [
    {
      id: 'member-me',
      name: '我',
      avatar: '🍚',
      healthProfile: {
        goals: ['脂肪肝管理', '减脂'],
        restrictions: [],
        notes: '关注脂肪肝管理与减脂',
      },
      preferences: EMPTY_DISH_PREFERENCES,
    },
    {
      id: 'member-tu',
      name: '屠老师',
      avatar: '🍵',
      healthProfile: {
        goals: ['控糖', '低油低脂'],
        restrictions: [],
        notes: '关注热量与升糖',
      },
      preferences: EMPTY_DISH_PREFERENCES,
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────
// 3. 持久化(与 dishPreferences 相同策略:localStorage + 容错 + 旧字段迁移)
// ─────────────────────────────────────────────────────────────────────

function normalizeMember(value: unknown, fallback: BuddyMember): BuddyMember {
  if (!value || typeof value !== 'object') return fallback
  const record = value as Record<string, unknown>
  return {
    id: typeof record.id === 'string' ? record.id : fallback.id,
    name: typeof record.name === 'string' ? record.name : fallback.name,
    avatar: typeof record.avatar === 'string' ? record.avatar : fallback.avatar,
    healthProfile:
      record.healthProfile && typeof record.healthProfile === 'object'
        ? {
            goals: Array.isArray((record.healthProfile as Record<string, unknown>).goals)
              ? ((record.healthProfile as Record<string, unknown>).goals as unknown[]).filter(
                  (g): g is string => typeof g === 'string',
                )
              : fallback.healthProfile.goals,
            restrictions: Array.isArray(
              (record.healthProfile as Record<string, unknown>).restrictions,
            )
              ? (
                  (record.healthProfile as Record<string, unknown>).restrictions as unknown[]
                ).filter((r): r is string => typeof r === 'string')
              : fallback.healthProfile.restrictions,
            notes:
              typeof (record.healthProfile as Record<string, unknown>).notes === 'string'
                ? ((record.healthProfile as Record<string, unknown>).notes as string)
                : fallback.healthProfile.notes,
          }
        : fallback.healthProfile,
    // preferences 字段:每成员独立的 DishPreferences;
    // 这里只做粗校验,详细 schema 校验交给 dishPreferences.normalizePreferences
    preferences:
      record.preferences && typeof record.preferences === 'object'
        ? (record.preferences as DishPreferences)
        : fallback.preferences,
  }
}

function normalizeBuddyGroup(value: unknown): BuddyGroup {
  if (!value || typeof value !== 'object') return DEFAULT_BUDDY_GROUP
  const record = value as Record<string, unknown>
  const members = Array.isArray(record.members)
    ? (record.members as unknown[]).map((m, idx) =>
        normalizeMember(m, DEFAULT_BUDDY_GROUP.members[idx] ?? DEFAULT_BUDDY_GROUP.members[0]),
      )
    : DEFAULT_BUDDY_GROUP.members

  // 兼容迁移:旧字段 executorId → 新字段 todayChefId
  const rawTodayChefId =
    typeof record.todayChefId === 'string'
      ? record.todayChefId
      : typeof record.executorId === 'string'
        ? record.executorId
        : undefined

  const todayChefId =
    rawTodayChefId && members.some((m) => m.id === rawTodayChefId)
      ? rawTodayChefId
      : members[0]?.id ?? 'member-me'

  return {
    id: typeof record.id === 'string' ? record.id : DEFAULT_BUDDY_GROUP.id,
    name: typeof record.name === 'string' ? record.name : DEFAULT_BUDDY_GROUP.name,
    todayChefId,
    members,
  }
}

export function readBuddyGroup(): BuddyGroup {
  try {
    const raw = window.localStorage.getItem(BUDDY_GROUP_STORAGE_KEY)
    if (raw) return normalizeBuddyGroup(JSON.parse(raw) as unknown)

    // 迁移:新 key 不存在时,回落读老 key `fandazi.family`,迁移一次到新 key。
    // 保留老 key 一版兼容(不删),与 dishPreferences 迁移策略一致。
    const legacy = window.localStorage.getItem(LEGACY_FAMILY_STORAGE_KEY)
    if (legacy) {
      const migrated = normalizeBuddyGroup(JSON.parse(legacy) as unknown)
      try {
        window.localStorage.setItem(BUDDY_GROUP_STORAGE_KEY, JSON.stringify(migrated))
      } catch {
        // ignore quota / privacy
      }
      return migrated
    }

    return DEFAULT_BUDDY_GROUP
  } catch {
    return DEFAULT_BUDDY_GROUP
  }
}

export function writeBuddyGroup(group: BuddyGroup): void {
  try {
    window.localStorage.setItem(
      BUDDY_GROUP_STORAGE_KEY,
      JSON.stringify(normalizeBuddyGroup(group)),
    )
  } catch {
    // ignore quota / privacy
  }
}

/**
 * 切换今日掌勺(轮换饭搭子组合决策权)
 * @param group 当前饭搭子组合
 * @param newChefId 新掌勺 id,必须 ∈ members[].id
 * @returns 新的 BuddyGroup 对象(纯函数,不直接写 localStorage,由调用方决定)
 */
export function switchTodayChef(group: BuddyGroup, newChefId: string): BuddyGroup {
  if (!group.members.some((m) => m.id === newChefId)) return group
  return { ...group, todayChefId: newChefId }
}

// ─────────────────────────────────────────────────────────────────────
// 4. 多人偏好聚合(共享界面标注)
//    ❤️ 谁喜欢 / 👨‍🍳 谁常做 / 🍽️ 谁做过 / 🚫 谁不想吃
// ─────────────────────────────────────────────────────────────────────

export type DishMemberBadges = {
  /** ❤️ 喜欢这道菜的搭子 */
  favoritedBy: BuddyMember[]
  /** 👨‍🍳 常做这道菜的搭子 */
  oftenCookedBy: BuddyMember[]
  /** 🍽️ 做过这道菜的搭子 */
  cookedBy: BuddyMember[]
  /** 🚫 不想吃这道菜的搭子(含原因) */
  dislikedBy: Array<{ member: BuddyMember; reason: DislikedReason; note?: string }>
}

/**
 * 聚合一道菜在饭搭子组合里的各搭子标注。
 * UI 在共享界面(详情页、菜单页、餐桌页)直接消费这个结构。
 */
export function aggregateDishBadges(group: BuddyGroup, dishId: string): DishMemberBadges {
  const favoritedBy: BuddyMember[] = []
  const oftenCookedBy: BuddyMember[] = []
  const cookedBy: BuddyMember[] = []
  const dislikedBy: DishMemberBadges['dislikedBy'] = []

  for (const member of group.members) {
    const p = member.preferences
    if (!p) continue
    if (p.favorite?.includes(dishId)) favoritedBy.push(member)
    if (p.oftenCooked?.includes(dishId)) oftenCookedBy.push(member)
    if (p.cooked?.includes(dishId)) cookedBy.push(member)
    if (p.disliked?.includes(dishId)) {
      const detail = p.dislikedDetails?.[dishId]
      dislikedBy.push({
        member,
        reason: detail?.reason ?? 'other',
        note: detail?.note,
      })
    }
  }

  return { favoritedBy, oftenCookedBy, cookedBy, dislikedBy }
}

/**
 * 解决今日掌勺:返回今天做饭的搭子。
 * 偏好冲突时,今日掌勺偏好略加权(不绝对覆盖)。
 */
export function getTodayChef(group: BuddyGroup): BuddyMember {
  return (
    group.members.find((m) => m.id === group.todayChefId) ??
    group.members[0]
  )
}

/**
 * 推荐系统问:这道菜「整组饭搭子合适吗?」+「谁不适合」
 * v1.11 阶段简单实现,v3.0 接入真实推荐引擎后由 ai.recommendTable 取代。
 */
export type BuddyGroupFitVerdict = {
  /** 整组饭搭子是否整体适合(无人 dislike + 无人 restriction 命中) */
  fitForAll: boolean
  /** 不适合的搭子清单(含原因) */
  unfitMembers: Array<{ member: BuddyMember; reason: string }>
  /** 想吃的搭子清单(命中 favorite) */
  wantedBy: BuddyMember[]
}

export function evaluateDishForBuddyGroup(
  group: BuddyGroup,
  dishId: string,
  /** 可选:菜里出现的食材关键词,用于匹配搭子 restrictions */
  ingredientKeywords: string[] = [],
): BuddyGroupFitVerdict {
  const badges = aggregateDishBadges(group, dishId)
  const unfitMembers: BuddyGroupFitVerdict['unfitMembers'] = []

  for (const member of group.members) {
    // 1. 显式 disliked
    const dislikeHit = badges.dislikedBy.find((d) => d.member.id === member.id)
    if (dislikeHit) {
      const reasonLabel = DISLIKED_REASON_LABEL[dislikeHit.reason] ?? '不想吃'
      unfitMembers.push({
        member,
        reason: dislikeHit.note ? `${reasonLabel}:${dislikeHit.note}` : reasonLabel,
      })
      continue
    }
    // 2. 健康画像 restrictions 命中
    const hit = member.healthProfile.restrictions.find((r) =>
      ingredientKeywords.some((kw) => r.includes(kw) || kw.includes(r)),
    )
    if (hit) {
      unfitMembers.push({ member, reason: `画像忌口:${hit}` })
    }
  }

  return {
    fitForAll: unfitMembers.length === 0,
    unfitMembers,
    wantedBy: badges.favoritedBy,
  }
}

/**
 * 饭搭子组合在某菜上的 disliked 原因分组(用于推荐解释 / 数据看板)
 * 例:{ taste: 2, health: 1 } 表示 2 人觉得口味不行 + 1 人健康原因
 */
export function buddyGroupDislikedReasonStats(
  group: BuddyGroup,
): Record<DislikedReason, number> {
  const stats: Record<DislikedReason, number> = {
    taste: 0,
    health: 0,
    allergy: 0,
    temporary: 0,
    other: 0,
  }
  for (const member of group.members) {
    const grouped = groupDislikedByReason(member.preferences ?? EMPTY_DISH_PREFERENCES)
    ;(Object.keys(grouped) as DislikedReason[]).forEach((reason) => {
      stats[reason] += grouped[reason].length
    })
  }
  return stats
}

// ─────────────────────────────────────────────────────────────────────
// 5. 旧 API 向后兼容别名(避免全面 break,过渡期保留)
//    新代码应使用 getTodayChef / todayChefId / readBuddyGroup / BuddyGroup
// ─────────────────────────────────────────────────────────────────────

/** @deprecated 用 getTodayChef 替代 */
export const getExecutor = getTodayChef
