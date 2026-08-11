import { describe, expect, it } from 'vitest'
import { buildHealthPlanSummary } from '../healthPlanSummary'

describe('healthPlanSummary: 需求采集摘要', () => {
  it('把目标优先级、限制、节奏和用户原话整理成可读摘要', () => {
    const result = buildHealthPlanSummary({
      goals: ['light-diet', 'shopping-efficiency'],
      restrictions: ['no-spicy'],
      people: 2,
      cookingTimePreference: 'quick',
      needDescription: '我希望晚饭少油，别每天重新买很多菜。',
      contextNotes: '家里有人不吃辣。',
    })

    expect(result.title).toContain('清淡少负担')
    expect(result.summary).toContain('第二优先：省钱快手')
    expect(result.summary).toContain('你补充的需求：我希望晚饭少油，别每天重新买很多菜。')
    expect(result.summary).toContain('必须避开：辣味')
    expect(result.missing).toHaveLength(0)
  })

  it('没有目标或用户原话时明确指出缺口', () => {
    const result = buildHealthPlanSummary({
      goals: [],
      restrictions: [],
      people: 1,
      cookingTimePreference: 'regular',
      needDescription: '',
      contextNotes: '',
    })

    expect(result.missing).toEqual([
      '至少选择一个第一优先目标',
      '写一句你希望饭团帮你解决的事情',
    ])
  })
})
