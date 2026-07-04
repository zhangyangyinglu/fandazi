import { describe, expect, it } from 'vitest'
import {
  checkDishAgainstRestriction,
  checkPlateStructure,
  scoreDishByHealthProfiles,
} from '../healthRecommend'
import type { Dish, DishCategory, Ingredient } from '../../types'
import type { DietRestriction, HealthProfile } from '../../components/healthProfileStorage'

function ing(name: string, group: Ingredient['group'], amount = '100 克'): Ingredient {
  return { name, group, amount }
}

function dish(
  id: string,
  name: string,
  category: DishCategory,
  ingredients: Ingredient[],
  cookMethod = '炒',
  tags: string[] = [],
): Dish {
  return {
    id,
    name,
    category,
    tags,
    intro: `${name} 简介`,
    cookMethod,
    cookTime: '20 分钟',
    color: '#fff8ee',
    ingredients,
    steps: ['步骤1'],
  }
}

function profile(id: string, restrictions: DietRestriction[]): HealthProfile {
  return {
    id,
    name: id,
    role: 'family',
    goals: [],
    healthStatuses: [],
    restrictions,
    nutritionFocus: [],
    priorityGoals: [],
    notes: '',
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('healthRecommend: 健康约束', () => {
  it('no-seafood 会硬过滤含鱼/虾菜品', () => {
    const shrimp = dish('shrimp', '芦笋虾仁', '荤菜', [ing('虾仁', '肉蛋'), ing('芦笋', '蔬菜')])
    const result = checkDishAgainstRestriction(shrimp, 'no-seafood')

    expect(result.hardFilter).toBe(true)
    expect(result.reason).toContain('海鲜')
  })

  it('low-oil / avoid-fried 对煎炸类软降权但不硬过滤', () => {
    const fried = dish('fried', '香煎鸡腿', '荤菜', [ing('鸡腿', '肉蛋')], '煎')
    const result = checkDishAgainstRestriction(fried, 'low-oil')

    expect(result.hardFilter).toBe(false)
    expect(result.penalty).toBeLessThan(0)
    expect(result.reason).toContain('油')
  })

  it('多人健康档案会合并限制：硬过滤优先，软降权累加', () => {
    const fish = dish('fish', '清蒸鲈鱼', '荤菜', [ing('鲈鱼', '肉蛋'), ing('姜', '调味')], '蒸')
    const result = scoreDishByHealthProfiles(fish, [
      profile('小夏', ['no-seafood']),
      profile('阿川', ['low-sodium']),
    ])

    expect(result.hardFilter).toBe(true)
    expect(result.reasons.some((r) => r.includes('海鲜') || r.includes('鱼'))).toBe(true)
  })
})

describe('checkPlateStructure: 一桌饭结构', () => {
  const protein = dish('fish', '清蒸鲈鱼', '荤菜', [ing('鲈鱼', '肉蛋'), ing('上海青', '蔬菜')], '蒸')
  const vegetable = dish('greens', '空心菜炒瘦肉', '荤菜', [ing('空心菜', '蔬菜'), ing('瘦猪肉', '肉蛋')], '炒')
  const soup = dish('soup', '冬瓜虾皮鸡蛋汤', '汤羹', [ing('冬瓜', '蔬菜'), ing('鸡蛋', '肉蛋')], '煮')
  const staple = dish('rice', '糙米饭', '主食', [ing('糙米饭', '主食')], '煮')

  it('能识别蛋白、蔬菜、主食、汤羹都覆盖的一桌饭', () => {
    const result = checkPlateStructure([protein, vegetable, soup, staple])

    expect(result.hasProtein).toBe(true)
    expect(result.hasVegetable).toBe(true)
    expect(result.hasStaple).toBe(true)
    expect(result.hasSoup).toBe(true)
    expect(result.gaps).toHaveLength(0)
  })

  it('主食缺失时要提示缺主食', () => {
    const result = checkPlateStructure([protein, vegetable, soup])

    expect(result.hasStaple).toBe(false)
    expect(result.gaps).toContain('缺主食')
  })

  it('一餐两道番茄核心菜会被判定为口味/核心食材重复', () => {
    const tomatoEgg = dish('tomato-egg', '番茄炒蛋', '荤菜', [ing('番茄', '蔬菜'), ing('鸡蛋', '肉蛋')], '炒')
    const tomatoSoup = dish('tomato-soup', '番茄豆腐虾仁汤', '汤羹', [ing('番茄', '蔬菜'), ing('豆腐', '肉蛋'), ing('虾仁', '肉蛋')], '煮')
    const result = checkPlateStructure([tomatoEgg, tomatoSoup, staple])

    expect(result.repeatedCoreIngredients).toContain('番茄')
    expect(result.repeatedFlavorFamilies).toContain('番茄')
    expect(result.gaps.some((gap) => gap.includes('番茄'))).toBe(true)
  })
})
