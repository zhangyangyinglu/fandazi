import { describe, expect, it } from 'vitest'
import { getBeijingDateString, getBeijingHour, getBeijingTimeOfDay, getCurrentMealType, getMealTimeScores } from '../mealTimeContext'

describe('首页餐次时间规则', () => {
  it('按北京时间把 11:15 识别为午餐，但不是靠 11:15 这个整点写死', () => {
    const date = new Date('2026-08-03T03:15:00.000Z')

    expect(getBeijingHour(date)).toBe(11)
    expect(getBeijingTimeOfDay(date)).toBe(11.25)
    expect(getCurrentMealType(getBeijingTimeOfDay(date))).toBe('lunch')
  })

  it('午餐到晚餐之间按中心时段平滑过渡，不制造下午茶或夜宵', () => {
    expect(getCurrentMealType(15)).toBe('lunch')
    expect(getCurrentMealType(16.5)).toBe('dinner')
    expect(getCurrentMealType(20)).toBe('dinner')
    expect(getCurrentMealType(21)).toBe('dinner')
    expect(getCurrentMealType(2)).toBe('dinner')
  })

  it('过渡区允许两种餐次同时有分数，避免整点跳变', () => {
    const scores = getMealTimeScores(15.5)
    expect(scores.lunch).toBeGreaterThan(0)
    expect(scores.dinner).toBeGreaterThan(0)
  })

  it('日期也按北京时间计算，避免 UTC 凌晨错到前一天', () => {
    expect(getBeijingDateString(new Date('2026-08-02T16:30:00.000Z'))).toBe('2026-08-03')
  })
})
