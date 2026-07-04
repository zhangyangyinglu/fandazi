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

export type HealthProfile = {
  id: string
  name: string
  role: 'owner' | 'family' | 'guest'
  goals: HealthGoal[]
  healthStatuses: HealthStatus[]
  restrictions: DietRestriction[]
  nutritionFocus: NutritionFocus[]
  priorityGoals: HealthGoal[]
  reportNotes?: string
  notes: string
  createdAt: number
  updatedAt: number
}

export const HEALTH_PROFILES_STORAGE_KEY = 'fandazi.healthProfiles'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
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
