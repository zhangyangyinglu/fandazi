import type {
  CookingTimePreference,
  DietRestriction,
  HealthGoal,
  HealthProfile,
} from '@/components/healthProfileStorage'

export type HealthPlanDraft = {
  goals: string[]
  restrictions: string[]
  people: number
  cookingTimePreference: CookingTimePreference
  needDescription: string
  contextNotes: string
}

export const HEALTH_GOAL_OPTIONS: ReadonlyArray<readonly [HealthGoal, string, string]> = [
  ['meal-planning', '日常吃得稳定', '少做决定，知道今天怎么吃'],
  ['sugar-control', '少油少糖', '减少甜、油腻和高糖做法'],
  ['light-diet', '清淡少负担', '少盐、少油、少重口'],
  ['shopping-efficiency', '省钱快手', '少买菜，尽量快点做完'],
]

export const HEALTH_RESTRICTION_OPTIONS: ReadonlyArray<readonly [DietRestriction, string]> = [
  ['no-seafood', '海鲜'],
  ['no-beef-lamb', '牛羊肉'],
  ['no-egg', '鸡蛋'],
  ['no-dairy', '奶制品'],
  ['no-nuts', '坚果'],
  ['no-spicy', '辣味'],
]

export const PEOPLE_OPTIONS = [
  [1, '自己吃', '一菜一汤或一碗面就够'],
  [2, '两个人', '日常一顿两道搭配'],
  [3, '三人以上', '按人数增加份量和搭配'],
] as const

export const COOKING_TIME_OPTIONS: ReadonlyArray<readonly [CookingTimePreference, string, string]> = [
  ['quick', '快手优先', '尽量 20 分钟左右完成'],
  ['regular', '正常做饭', '30 分钟左右，搭配更完整'],
  ['slow', '愿意慢慢做', '周末也可以做复杂一点'],
]

const GOAL_LABELS = new Map(HEALTH_GOAL_OPTIONS.map(([value, label]) => [value, label]))
const RESTRICTION_LABELS = new Map(HEALTH_RESTRICTION_OPTIONS)
const COOKING_LABELS = new Map(COOKING_TIME_OPTIONS.map(([value, label]) => [value, label]))
const PEOPLE_LABELS = new Map(PEOPLE_OPTIONS.map(([value, label]) => [value, label]))

export function getHealthGoalLabel(value: string): string {
  return GOAL_LABELS.get(value as HealthGoal) ?? value
}

export function getHealthRestrictionLabel(value: string): string {
  return RESTRICTION_LABELS.get(value as DietRestriction) ?? value
}

function compactText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function buildHealthPlanSummary(draft: HealthPlanDraft): {
  title: string
  summary: string
  bullets: string[]
  missing: string[]
} {
  const goals = draft.goals.filter(Boolean)
  const restrictions = draft.restrictions.filter(Boolean)
  const needDescription = compactText(draft.needDescription)
  const contextNotes = compactText(draft.contextNotes)
  const primaryGoal = goals[0] ? getHealthGoalLabel(goals[0]) : ''
  const secondaryGoals = goals.slice(1).map(getHealthGoalLabel)
  const peopleLabel = PEOPLE_LABELS.get(draft.people as 1 | 2 | 3) ?? `${draft.people} 人`
  const cookingLabel = COOKING_LABELS.get(draft.cookingTimePreference) ?? '正常做饭'

  const bullets = [
    primaryGoal ? `第一优先：${primaryGoal}` : '还没有明确第一优先目标',
    ...(secondaryGoals.length > 0 ? [`第二优先：${secondaryGoals.join('、')}`] : []),
    `通常是${peopleLabel}，做饭节奏：${cookingLabel}`,
    ...(restrictions.length > 0
      ? [`必须避开：${restrictions.map(getHealthRestrictionLabel).join('、')}`]
      : ['目前没有填写必须避开的食材']),
    ...(needDescription ? [`你补充的需求：${needDescription}`] : []),
    ...(contextNotes ? [`额外背景：${contextNotes}`] : []),
  ]

  const missing: string[] = []
  if (goals.length === 0) missing.push('至少选择一个第一优先目标')
  if (!needDescription) missing.push('写一句你希望饭团帮你解决的事情')

  const summary = bullets.join('；')
  return {
    title: primaryGoal ? `优先围绕「${primaryGoal}」来安排` : '还没有形成可执行的需求说明',
    summary,
    bullets,
    missing,
  }
}

export function buildHealthPlanSummaryFromProfile(profile: HealthProfile, people: number): string {
  if (profile.analysisSummary?.trim()) return profile.analysisSummary.trim()
  return buildHealthPlanSummary({
    goals: profile.priorityGoals.length > 0 ? profile.priorityGoals : profile.goals,
    restrictions: profile.restrictions,
    people,
    cookingTimePreference: profile.cookingTimePreference ?? 'regular',
    needDescription: profile.needDescription ?? '',
    contextNotes: profile.contextNotes ?? '',
  }).summary
}
