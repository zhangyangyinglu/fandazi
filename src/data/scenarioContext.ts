/**
 * 饭搭子首页动态主卡 — 场景系统
 *
 * 核心概念：场景（Scenario）≠ 餐次（MealTime）
 * 同样是晚餐，任务可能完全不同：日常一起吃 / 一个人简单吃 / 顺手多做一份 / 准备明天带饭 / 家里来人
 *
 * Phase 1（当前）：用规则推断默认场景（时间 + 星期几），不做习惯学习
 * Phase 2（未来）：接入使用习惯追踪，基于历史选择预测场景
 */

import { getCurrentMealType, type CurrentMealTime } from './mealTimeContext'
import type { MealTime } from './recommend'

// ============================================================
// 场景类型定义
// ============================================================

export type MealScenario =
  | 'daily'        // 日常一起吃
  | 'solo'         // 一个人简单吃
  | 'extra'        // 顺手多做一份
  | 'bento'        // 准备明天带饭
  | 'guests'       // 家里来人

export interface ScenarioInfo {
  id: MealScenario
  label: string           // 场景名称（用户可见）
  emoji: string           // 场景图标
  fantuanLine: string     // 饭团预设文案（主卡标题下方的饭团话术）
  defaultMealTime: MealTime  // 该场景默认对应的餐次
}

// ============================================================
// 6 种场景定义（方案 §8.2 + §19 文案草案）
// ============================================================

export const SCENARIO_CATALOG: ScenarioInfo[] = [
  {
    id: 'daily',
    label: '日常一起吃',
    emoji: '🍽️',
    fantuanLine: '先按你家的习惯预设了一版',
    defaultMealTime: 'dinner',
  },
  {
    id: 'solo',
    label: '一个人简单吃',
    emoji: '🍚',
    fantuanLine: '一个人吃也不用凑合，给你搭了简单一餐',
    defaultMealTime: 'dinner',
  },
  {
    id: 'extra',
    label: '顺手多做一份',
    emoji: '🥘',
    fantuanLine: '反正要开火，帮你多备一份，省一顿的功夫',
    defaultMealTime: 'dinner',
  },
  {
    id: 'bento',
    label: '准备明天带饭',
    emoji: '🍱',
    fantuanLine: '挑了适合带饭、复热也不难吃的菜',
    defaultMealTime: 'bento',
  },
  {
    id: 'guests',
    label: '家里来人',
    emoji: '👨‍👩‍👧',
    fantuanLine: '人多热闹，按人数帮你加了两道硬菜',
    defaultMealTime: 'dinner',
  },
]

export const SCENARIO_MAP: Record<MealScenario, ScenarioInfo> = Object.fromEntries(
  SCENARIO_CATALOG.map((s) => [s.id, s]),
) as Record<MealScenario, ScenarioInfo>

// ============================================================
// 条件摘要 — 主卡片上显示的"饭团预设条件"
// ============================================================

export interface ConditionSummaryInput {
  mealTime: MealTime
  familySize: number
  healthGoal: string        // activeHealthGoal，'全部' 表示未设
  pantryCount: number       // 冰箱食材数量
  scenario: MealScenario
}

export interface ConditionSummary {
  mealLabel: string         // "晚餐" / "午餐" / ...
  peopleLabel: string       // "2 人" / "1 人" / "4 人"
  healthLabel: string       // "低脂低油" / "" （空=不显示）
  pantryLabel: string       // "优先用冰箱食材" / ""
  /** 组合成一行：晚餐 · 2 人 · 低脂低油 · 优先用冰箱食材 */
  fullLine: string
}

const MEAL_LABELS: Record<MealTime, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  bento: '便当',
  snack: '加餐',
}

// 健康目标 → 用户可读短语
const HEALTH_GOAL_LABELS: Record<string, string> = {
  '全部': '',
  '控糖友好': '控糖',
  '低脂': '低脂',
  '减脂': '减脂',
  '低油低脂': '低油低脂',
}

export function buildConditionSummary(input: ConditionSummaryInput): ConditionSummary {
  const mealLabel = MEAL_LABELS[input.mealTime] ?? '一餐'

  // 场景影响人数显示
  let peopleLabel: string
  if (input.scenario === 'solo') {
    peopleLabel = '1 人'
  } else if (input.scenario === 'guests' && input.familySize <= 2) {
    peopleLabel = '3-4 人'
  } else if (input.familySize > 0) {
    peopleLabel = `${input.familySize} 人`
  } else {
    // familySize=0：未设置人数，不显示人数标签
    peopleLabel = ''
  }

  const healthLabel = input.healthGoal && input.healthGoal !== '全部'
    ? (HEALTH_GOAL_LABELS[input.healthGoal] ?? input.healthGoal)
    : ''

  const pantryLabel = input.pantryCount > 0 ? '优先用冰箱食材' : ''

  const parts = [mealLabel, peopleLabel].filter(Boolean)
  if (healthLabel) parts.push(healthLabel)
  if (pantryLabel) parts.push(pantryLabel)

  return {
    mealLabel,
    peopleLabel,
    healthLabel,
    pantryLabel,
    fullLine: parts.join(' · '),
  }
}

// ============================================================
// 场景推断 — 基于时间 + 星期几（Phase 1 规则引擎）
// ============================================================

/**
 * 根据当前时间和星期几推断最可能的场景
 *
 * 规则：
 * - 工作日早餐 → daily
 * - 工作日午餐 → daily
 * - 工作日晚餐 → daily（默认）
 * - 周末早餐 → daily
 * - 周末午餐 → guests（家人都在）
 * - 周末晚餐 → daily
 * - 21:00 后 → solo（夜宵场景，一个人简单吃）
 * - 默认 → daily
 *
 * 注意：Phase 1 只做规则推断，用户可以通过"改一下"手动切换
 */
export function inferScenario(hour?: number, dayOfWeek?: number): MealScenario {
  const h = hour ?? new Date().getHours()
  const dow = dayOfWeek ?? new Date().getDay()
  const isWeekend = dow === 0 || dow === 6

  // 深夜 → 一个人简单吃
  if (h >= 21 || h < 6) return 'solo'

  // 周末午餐 → 家里来人（家人都在）
  if (isWeekend && h >= 10 && h < 15) return 'guests'

  // 默认
  return 'daily'
}

/**
 * 根据场景推断餐次
 * bento 场景 → bento
 * 其他场景 → 跟随当前时段
 */
export function inferMealTime(scenario: MealScenario, currentMeal?: CurrentMealTime): MealTime {
  if (scenario === 'bento') return 'bento'
  return currentMeal ?? getCurrentMealType()
}

// ============================================================
// 饭团语气 — 主卡标题文案
// ============================================================

/**
 * 生成主卡片标题
 * 方案 §19：这一餐，怎么安排？
 */
export function fantuanCardTitle(_scenario: MealScenario): string {
  // 所有场景统一用"这一餐，怎么安排？"作为标题
  // 场景差异通过 fantuanLine 体现
   
  void _scenario
  return '这一餐，怎么安排？'
}

/**
 * 生成主卡片副标题（饭团预设文案）
 */
export function fantuanCardSubtitle(scenario: MealScenario): string {
  return SCENARIO_MAP[scenario]?.fantuanLine ?? SCENARIO_MAP.daily.fantuanLine
}

// ============================================================
// 轻提醒 — 主卡下方的信息条
// ============================================================

export type ReminderType = 'fridge' | 'recent' | 'plan' | 'growth'

export interface Reminder {
  type: ReminderType
  emoji: string
  text: string
  action?: string   // 点击跳转目标
}

/**
 * 从现有数据生成轻提醒列表
 */
export function buildReminders(params: {
  pantryItems: { id: string; ingredientName: string; bestBeforeAt?: string }[]
  recentDishNames: string[]
  plannedDishCount: number
  miliBalance: number
}): Reminder[] {
  const reminders: Reminder[] = []
  const now = Date.now()

  // 1. 冰箱快过期
  const expiring = params.pantryItems
    .filter((it) => {
      if (!it.bestBeforeAt) return false
      const days = Math.floor((new Date(it.bestBeforeAt).getTime() - now) / (24 * 3600 * 1000))
      return days >= 0 && days <= 3
    })
    .slice(0, 3)

  if (expiring.length > 0) {
    reminders.push({
      type: 'fridge',
      emoji: '🧊',
      text: `${expiring.map((e) => e.ingredientName).join('、')} 快过期了，饭团帮你优先用掉`,
      action: 'pantry',
    })
  }

  // 2. 最近做过
  if (params.recentDishNames.length > 0) {
    reminders.push({
      type: 'recent',
      emoji: '👨‍🍳',
      text: `上次做的「${params.recentDishNames[0]}」不错，要不要再来一次？`,
      action: 'profile',
    })
  }

  // 3. 待做计划
  if (params.plannedDishCount > 0) {
    reminders.push({
      type: 'plan',
      emoji: '📋',
      text: `餐桌上有 ${params.plannedDishCount} 道待做，今天安排吗？`,
      action: 'table',
    })
  }

  // 4. 米粒提醒（仅在余额接近兑换时）
  if (params.miliBalance > 0 && params.miliBalance < 100) {
    reminders.push({
      type: 'growth',
      emoji: '🌾',
      text: `攒了 ${params.miliBalance} 米粒，再做一些就能换饭团了`,
      action: 'fantuan',
    })
  }

  return reminders
}
