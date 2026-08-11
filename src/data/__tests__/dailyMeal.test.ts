import { describe, expect, it } from 'vitest'
import { DEFAULT_BUDDY_GROUP } from '../familySharing'
import { DEFAULT_DAILY_MEAL_SETTINGS, getDailyMealRecommendation } from '../dailyMeal'
import type { HealthProfile } from '../../components/healthProfileStorage'
import type { Dish, MealPlan } from '../../types'

const dish: Dish = {
  id: 'light-dish',
  name: '清蒸鸡胸肉',
  category: '荤菜',
  tags: ['清淡', '少油'],
  intro: '清淡家常菜',
  cookMethod: '蒸',
  cookTime: '20 分钟',
  color: '#fff8ee',
  ingredients: [{ name: '鸡胸肉', group: '肉蛋', amount: '120 克' }],
  steps: ['蒸熟'],
}

const profile: HealthProfile = {
  id: 'me',
  name: '我',
  role: 'owner',
  goals: ['light-diet'],
  healthStatuses: [],
  restrictions: [],
  nutritionFocus: [],
  priorityGoals: ['light-diet'],
  cookingTimePreference: 'quick',
  needDescription: '我希望晚饭清淡少油，最好 30 分钟内完成。',
  contextNotes: '',
  analysisSummary: '优先围绕「清淡少负担」来安排；你补充的需求：我希望晚饭清淡少油，最好 30 分钟内完成。',
  summaryConfirmedAt: 2,
  notes: '问卷记录',
  createdAt: 1,
  updatedAt: 1,
}

const plan: MealPlan = {
  id: 'plan-1',
  dishId: dish.id,
  status: 'planned',
  planDate: '2026-08-05',
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
}

describe('dailyMeal: 已确认今日计划也保留推荐依据', () => {
  it('不会因复用今日计划而丢失健康计划摘要和菜品命中理由', () => {
    const result = getDailyMealRecommendation({
      date: '2026-08-05',
      dishes: [dish],
      pantryItems: ['鸡胸肉'],
      mealPlans: [plan],
      cookingLogs: [],
      settings: DEFAULT_DAILY_MEAL_SETTINGS,
      buddyGroup: DEFAULT_BUDDY_GROUP,
      healthProfiles: [profile],
      mealTime: 'dinner',
    })

    expect(result.persisted).toBe(true)
    expect(result.healthReasons.join('；')).toContain('清淡少油')
    expect(result.healthReasons.join('；')).toContain('符合快手优先')
  })
})
