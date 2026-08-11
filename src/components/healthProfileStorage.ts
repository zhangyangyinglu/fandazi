export type HealthGoal =
  | 'fat-loss'
  | 'sugar-control'
  | 'fatty-liver-friendly'
  | 'blood-lipid-control'
  | 'blood-pressure-control'
  | 'muscle-gain'
  | 'light-diet'
  | 'meal-planning'
  | 'shopping-efficiency'
  | 'more-variety'

export type HealthStatus =
  | 'losing-weight'
  | 'overweight'
  | 'prediabetes'
  | 'glucose-fluctuation'
  | 'fatty-liver'
  | 'high-blood-lipid'
  | 'high-blood-pressure'
  | 'high-uric-acid'
  | 'anemia'
  | 'thyroid'
  | 'gastritis'
  | 'kidney'
  | 'low-activity'
  | 'high-activity'
  | 'sensitive-stomach'
  | 'general-healthy-eating'

export type DietRestriction =
  | 'low-sugar'
  | 'low-oil'
  | 'low-fat'
  | 'low-sodium'
  | 'low-refined-carb'
  | 'low-purine'
  | 'calorie-control'
  | 'avoid-fried'
  | 'avoid-sugary-drinks'
  | 'avoid-fatty-meat'
  | 'avoid-heavy-flavor'
  | 'avoid-raw'
  | 'avoid-cold'
  | 'no-spicy'
  | 'no-seafood'
  | 'no-beef-lamb'
  | 'no-egg'
  | 'no-dairy'
  | 'no-gluten'
  | 'no-nuts'
  | 'vegetarian'

export type NutritionFocus =
  | 'kcal'
  | 'calories'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fiber'
  | 'sugar'
  | 'sodium'
  | 'satFat'
  | 'iron'
  | 'calcium'
  | 'vitamin-c'
  | 'potassium'
  | 'purine'
  | 'cholesterol'
  | 'post-meal-glucose'

export type CookingTimePreference = 'quick' | 'regular' | 'slow'

export type HealthProfile = {
  id: string
  name: string
  role: 'owner' | 'family' | 'guest'
  goals: HealthGoal[]
  healthStatuses: HealthStatus[]
  restrictions: DietRestriction[]
  nutritionFocus: NutritionFocus[]
  priorityGoals: HealthGoal[]
  /** 首次问卷采集的做饭时间偏好；旧档案没有此字段时按常规做饭兼容。 */
  cookingTimePreference?: CookingTimePreference
  /** 用户自己写下的需求，作为 AI 和推荐理由的原始依据。 */
  needDescription?: string
  /** 用户愿意补充的身体、营养、预算或家庭背景。 */
  contextNotes?: string
  /** 保存时生成的可读摘要，供饭团对话和推荐说明读取。 */
  analysisSummary?: string
  summaryConfirmedAt?: number
  reportNotes?: string
  notes: string
  createdAt: number
  updatedAt: number
}

export const HEALTH_PROFILES_STORAGE_KEY = 'fandazi.healthProfiles'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isCookingTimePreference(value: unknown): value is CookingTimePreference {
  return value === 'quick' || value === 'regular' || value === 'slow'
}

export function readHealthProfiles(): HealthProfile[] {
  try {
    const raw = window.localStorage.getItem(HEALTH_PROFILES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (profile): profile is HealthProfile =>
        profile &&
        typeof profile === 'object' &&
        typeof profile.id === 'string' &&
        typeof profile.name === 'string' &&
        (profile.role === 'owner' || profile.role === 'family' || profile.role === 'guest') &&
        isStringArray(profile.goals) &&
        isStringArray(profile.healthStatuses) &&
        isStringArray(profile.restrictions) &&
        isStringArray(profile.nutritionFocus) &&
        isStringArray(profile.priorityGoals) &&
        (typeof profile.cookingTimePreference === 'undefined' || isCookingTimePreference(profile.cookingTimePreference)) &&
        (typeof profile.needDescription === 'undefined' || typeof profile.needDescription === 'string') &&
        (typeof profile.contextNotes === 'undefined' || typeof profile.contextNotes === 'string') &&
        (typeof profile.analysisSummary === 'undefined' || typeof profile.analysisSummary === 'string') &&
        (typeof profile.summaryConfirmedAt === 'undefined' || typeof profile.summaryConfirmedAt === 'number') &&
        typeof profile.notes === 'string' &&
        typeof profile.createdAt === 'number' &&
        typeof profile.updatedAt === 'number',
    )
  } catch {
    return []
  }
}

export function writeHealthProfiles(profiles: HealthProfile[]): void {
  try {
    window.localStorage.setItem(HEALTH_PROFILES_STORAGE_KEY, JSON.stringify(profiles))
  } catch {
    // 隐私模式或配额超限：静默降级，不阻断 UI。
  }
}
