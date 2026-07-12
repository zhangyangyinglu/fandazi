/**
 * P0-3 偏好参与推荐 — 验收测试
 *
 * 对应任务文档 §2 验收标准:
 * T1: 标记 5 道菜「喜欢」→ 推荐优先命中喜欢的菜
 * T2: 标记 5 道菜「过敏」→ 推荐结果 0 命中(强过滤)
 * T3: 标记 3 道菜「最近做过」→ 推荐结果与无偏好版本有差异(降权生效)
 * T4: 1 搭子喜欢 + 1 搭子不喜欢 → 标记分歧 ⚠️
 */

import { describe, it, expect } from 'vitest'
import { recommendMeal, getBuddyGroupVerdictForDish } from '../recommend'
import type { Dish, Ingredient, DishCategory } from '../../types'
import type { BuddyGroup } from '../familySharing'
import type { DishPreferences, DislikedItem, DislikedReason } from '../dishPreferences'
import { EMPTY_DISH_PREFERENCES } from '../dishPreferences'

// ── helpers ──

function ing(name: string, amount: string, group: Ingredient['group'] = '蔬菜'): Ingredient {
  return { name, amount, group }
}

function dish(
  id: string,
  name: string,
  category: DishCategory,
  ingredients: Ingredient[],
  cookMethod = '炒',
): Dish {
  return { id, name, category, tags: [], intro: '', cookMethod, cookTime: '20 分钟', color: '#ccc', ingredients, steps: ['步骤1'] }
}

function prefs(o: {
  favorite?: string[]
  cooked?: string[]
  disliked?: string[]
  dislikedDetails?: Record<string, DislikedItem>
} = {}): DishPreferences {
  return {
    favorite: o.favorite ?? [],
    oftenCooked: [],
    cooked: o.cooked ?? [],
    disliked: o.disliked ?? [],
    dislikedDetails: o.dislikedDetails ?? {},
  }
}

function makeGroup(
  members: Array<{ id: string; name: string; p?: DishPreferences }>,
  chefId?: string,
): { group: BuddyGroup; prefMap: Record<string, DishPreferences> } {
  const group: BuddyGroup = {
    id: 'test-group',
    name: '测试搭子组',
    todayChefId: chefId ?? members[0].id,
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      avatar: '🍚',
      healthProfile: { goals: [], restrictions: [] },
      preferences: m.p ?? EMPTY_DISH_PREFERENCES,
    })),
  }
  const prefMap: Record<string, DishPreferences> = {}
  for (const m of members) prefMap[m.id] = m.p ?? EMPTY_DISH_PREFERENCES
  return { group, prefMap }
}

function dislike(dishId: string, reason: DislikedReason, daysAgo = 0): DislikedItem {
  return { dishId, reason, createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString() }
}

// ── mock dish pool: 8 荤 + 5 素 + 3 主食 + 2 汤 = 18 道 ──

const pool: Dish[] = [
  // 荤菜
  dish('m1', '番茄牛肉', '荤菜', [ing('牛肉', '120克', '肉蛋'), ing('番茄', '200克')], '炖'),
  dish('m2', '清蒸鲈鱼', '荤菜', [ing('鲈鱼', '180克', '肉蛋'), ing('姜', '5克', '调味')], '蒸'),
  dish('m3', '宫保鸡丁', '荤菜', [ing('鸡胸肉', '120克', '肉蛋'), ing('花生', '15克', '干货')], '炒'),
  dish('m4', '虾仁滑蛋', '荤菜', [ing('虾仁', '100克', '肉蛋'), ing('鸡蛋', '55克', '肉蛋')], '炒'),
  dish('m5', '红烧排骨', '荤菜', [ing('排骨', '150克', '肉蛋')], '炖'),
  dish('m6', '芹菜炒肉丝', '荤菜', [ing('猪肉', '120克', '肉蛋'), ing('芹菜', '150克')], '炒'),
  dish('m7', '蒜蓉粉丝虾', '荤菜', [ing('大虾', '150克', '肉蛋'), ing('粉丝', '50克', '主食')], '蒸'),
  dish('m8', '香菇滑鸡', '荤菜', [ing('鸡腿肉', '150克', '肉蛋'), ing('香菇', '80克')], '蒸'),
  // 素菜
  dish('v1', '蒜蓉西兰花', '素菜', [ing('西兰花', '200克')], '炒'),
  dish('v2', '清炒菠菜', '素菜', [ing('菠菜', '200克')], '炒'),
  dish('v3', '凉拌黄瓜', '素菜', [ing('黄瓜', '150克')], '拌'),
  dish('v4', '手撕包菜', '素菜', [ing('包菜', '200克')], '炒'),
  dish('v5', '清炒生菜', '素菜', [ing('生菜', '200克')], '炒'),
  // 主食
  dish('s1', '白米饭', '主食', [ing('白米饭', '100克', '主食')], '蒸'),
  dish('s2', '荞麦面', '主食', [ing('荞麦面', '60克', '主食')], '煮'),
  dish('s3', '蒸红薯', '主食', [ing('红薯', '150克', '主食')], '蒸'),
  // 汤羹
  dish('sp1', '番茄蛋汤', '汤羹', [ing('番茄', '200克'), ing('鸡蛋', '55克', '肉蛋')], '煮'),
  dish('sp2', '冬瓜排骨汤', '汤羹', [ing('冬瓜', '250克'), ing('排骨', '150克', '肉蛋')], '炖'),
]

const PANTRY = ['番茄', '鸡蛋', '姜', '葱']

function runLunch(group?: BuddyGroup, prefMap?: Record<string, DishPreferences>) {
  return recommendMeal({
    mealTime: 'lunch',
    pantryItems: PANTRY,
    candidateDishes: pool,
    buddyGroup: group,
    memberPreferences: prefMap,
    currentMealType: 'lunch',
  })
}

function runLunchWithSeed(seed: number) {
  return recommendMeal({
    mealTime: 'lunch',
    pantryItems: PANTRY,
    candidateDishes: pool,
    currentMealType: 'lunch',
    seed,
  })
}

function rerunLunchWithout(previousIds: string[]) {
  return recommendMeal({
    mealTime: 'lunch',
    pantryItems: PANTRY,
    candidateDishes: pool,
    currentMealType: 'lunch',
    seed: 1,
    excludeDishIds: previousIds,
  })
}

// ── tests ──

describe('P0-3 偏好参与推荐', () => {
  const ME = 'me'
  const TU = 'tu'

  it('T1: 标记 5 道菜为喜欢 → 推荐的荤菜命中 favorite', () => {
    const favs = ['m1', 'm2', 'm3', 'm4', 'm5']
    const { group, prefMap } = makeGroup([
      { id: ME, name: '我', p: prefs({ favorite: favs }) },
      { id: TU, name: '阿川' },
    ], ME)

    const result = runLunch(group, prefMap)
    expect(result).not.toBeNull()

    const meatPicked = result!.dishes.filter((d) => d.category === '荤菜')
    expect(meatPicked.length).toBeGreaterThanOrEqual(1)
    expect(favs).toContain(meatPicked[0].id)
  })

  it('T2: 标记 5 道菜为过敏 → 推荐结果 0 命中过敏菜', () => {
    const allergyIds = ['m1', 'm2', 'v1', 's1', 'sp1']
    const details: Record<string, DislikedItem> = {}
    for (const id of allergyIds) details[id] = dislike(id, 'allergy')

    const { group, prefMap } = makeGroup([
      { id: ME, name: '我', p: prefs({ disliked: allergyIds, dislikedDetails: details }) },
      { id: TU, name: '阿川' },
    ], ME)

    const result = runLunch(group, prefMap)
    expect(result).not.toBeNull()

    const resultIds = result!.dishes.map((d) => d.id)
    for (const id of allergyIds) {
      expect(resultIds).not.toContain(id)
    }
  })

  it('T3: 标记 3 道菜为做过 → 推荐结果与无偏好基线有差异', () => {
    // 基线: 无偏好
    const { group: g0, prefMap: pm0 } = makeGroup([
      { id: ME, name: '我' },
      { id: TU, name: '阿川' },
    ], ME)
    const baseline = runLunch(g0, pm0)
    expect(baseline).not.toBeNull()
    const baselineIds = new Set(baseline!.dishes.map((d) => d.id))

    // 把基线推荐的 3 道菜标记为 cooked(双方都做过 → -0.2 delta)
    const cookedIds = baseline!.dishes.map((d) => d.id)
    const { group: g1, prefMap: pm1 } = makeGroup([
      { id: ME, name: '我', p: prefs({ cooked: cookedIds }) },
      { id: TU, name: '阿川', p: prefs({ cooked: cookedIds }) },
    ], ME)

    const after = runLunch(g1, pm1)
    expect(after).not.toBeNull()
    const afterIds = new Set(after!.dishes.map((d) => d.id))

    // 至少 1 道新菜替换了 cooked 菜
    const newDishes = [...afterIds].filter((id) => !baselineIds.has(id))
    expect(newDishes.length).toBeGreaterThanOrEqual(1)
  })

  it('T4: 搭子意见不一致 → disagreementDishIds + verdict 正确', () => {
    const targetId = 'm1' // 小夏喜欢 + 阿川不喜欢
    const { group, prefMap } = makeGroup([
      { id: ME, name: '我', p: prefs({ favorite: [targetId] }) },
      {
        id: TU,
        name: '阿川',
        p: prefs({
          disliked: [targetId],
          dislikedDetails: { [targetId]: dislike(targetId, 'taste') },
        }),
      },
    ], ME)

    // 直接测 getBuddyGroupVerdictForDish
    const verdicts = getBuddyGroupVerdictForDish(targetId, group, prefMap)
    expect(verdicts).toHaveLength(2)
    expect(verdicts[0].verdict).toBe('love')  // 我喜欢
    expect(verdicts[0].isChef).toBe(true)
    expect(verdicts[1].verdict).toBe('hate')  // 阿川不喜欢
    expect(verdicts[1].isChef).toBe(false)

    // 测 recommendMeal: m1 应被推荐(净 delta +0.11)且标记分歧
    const result = runLunch(group, prefMap)
    expect(result).not.toBeNull()

    expect(result!.dishes.map((d) => d.id)).toContain(targetId)
    expect(result!.disagreementDishIds).toContain(targetId)

    const reasons = result!.perDishReasons[targetId]
    expect(reasons).toBeDefined()
    expect(reasons!.some((r) => r.includes('不一致'))).toBe(true)
  })

  it('T5: 换版会排除上一桌，确保推荐真的发生变化', () => {
    const first = runLunchWithSeed(0)
    const second = first ? rerunLunchWithout(first.dishes.map((item) => item.id)) : null

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(second!.dishes.map((item) => item.id)).not.toEqual(first!.dishes.map((item) => item.id))
  })
})
