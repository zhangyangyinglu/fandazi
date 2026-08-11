import { describe, expect, it } from 'vitest'
import { DISHES } from '../dishes'
import { DEFAULT_BUDDY_GROUP } from '../familySharing'
import { buildWeeklyPrepPlan } from '../weeklyPrepPlan'
import { DEFAULT_DAILY_MEAL_SETTINGS } from '../dailyMeal'

describe('weekly prep plan', () => {
  it('creates a seven-day draft with three prep windows without writing daily plans', () => {
    const plan = buildWeeklyPrepPlan({
      weekStart: '2026-08-10',
      dishes: DISHES,
      pantryItems: [],
      mealPlans: [],
      cookingLogs: [],
      dailySettings: DEFAULT_DAILY_MEAL_SETTINGS,
      mealsPerDay: 2,
      servings: 1,
      buddyGroup: DEFAULT_BUDDY_GROUP,
      healthProfiles: [],
    })

    expect(plan.status).toBe('draft')
    expect(plan.days).toHaveLength(7)
    expect(plan.batches).toHaveLength(3)
    expect(plan.days.every((day) => day.meals.length === 2)).toBe(true)
    expect(plan.days.flatMap((day) => day.meals.flatMap((meal) => meal.dishIds)).length).toBeGreaterThan(0)
    expect(plan.batches.every((batch) => batch.dates.length > 0)).toBe(true)
    const repeatedBatch = plan.batches.slice(0, 2).some((batch) => {
      const firstDishId = batch.dishIds[0]
      return Boolean(firstDishId) && batch.dates.filter((date) => plan.days
        .find((day) => day.date === date)
        ?.meals.some((meal) => meal.dishIds.includes(firstDishId))).length >= 2
    })
    expect(repeatedBatch).toBe(true)
  })

  it('normalizes a Sunday input to the Monday of that week', async () => {
    const { getWeekStart } = await import('../weeklyPrepPlan')
    expect(getWeekStart('2026-08-16')).toBe('2026-08-10')
  })
})
