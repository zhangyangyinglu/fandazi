import { getSupabase } from '@/lib/supabaseClient'
import type { MealPlan, MyDishVersion, PantryItem } from '@/types'
import type { CookingLog, FantuanState, ShoppingItem } from '@/stores/fandaziStore'

let remoteApplyDepth = 0

export function withRemoteApply(fn: () => void): void {
  remoteApplyDepth += 1
  try {
    fn()
  } finally {
    remoteApplyDepth -= 1
  }
}

function shouldSync(): boolean {
  return remoteApplyDepth === 0 && !!getHouseholdId()
}

export function getHouseholdId(): string | null {
  try {
    return localStorage.getItem('fandazi.householdId')
  } catch {
    return null
  }
}

async function getUserId(): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

type SyncErrorListener = (action: string, error: unknown) => void
const syncErrorListeners = new Set<SyncErrorListener>()

export function onSyncError(fn: SyncErrorListener): () => void {
  syncErrorListeners.add(fn)
  return () => syncErrorListeners.delete(fn)
}

function reportSyncError(action: string, error: unknown): void {
  if (!error) return
  console.error(`[饭搭子同步] ${action}失败:`, error)
  syncErrorListeners.forEach((fn) => fn(action, error))
}

export function toPantryItem(row: Record<string, unknown>): PantryItem {
  return {
    id: String(row.id),
    ingredientName: String(row.ingredient_name ?? ''),
    category: row.category as PantryItem['category'],
    quantity: Number(row.quantity ?? 1),
    unit: String(row.unit ?? '个'),
    storage: row.storage as PantryItem['storage'],
    boughtAt: String(row.bought_at ?? ''),
    bestBeforeAt: String(row.best_before_at ?? ''),
    source: row.source as PantryItem['source'],
    status: row.status as PantryItem['status'],
    note: typeof row.note === 'string' ? row.note : undefined,
    plannedDishIds: Array.isArray(row.planned_dish_ids) ? row.planned_dish_ids as string[] : undefined,
  }
}

function fromPantryItem(item: PantryItem, householdId: string) {
  return {
    id: item.id,
    household_id: householdId,
    ingredient_name: item.ingredientName,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    storage: item.storage,
    bought_at: item.boughtAt || null,
    best_before_at: item.bestBeforeAt || null,
    source: item.source,
    status: item.status,
    note: item.note ?? null,
    planned_dish_ids: item.plannedDishIds ?? [],
    updated_at: new Date().toISOString(),
  }
}

export function toMealPlan(row: Record<string, unknown>): MealPlan {
  return {
    id: String(row.id),
    dishId: String(row.dish_id ?? ''),
    status: row.status as MealPlan['status'],
    planDate: String(row.plan_date ?? ''),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  }
}

function fromMealPlan(plan: MealPlan, householdId: string, userId: string | null) {
  return {
    id: plan.id,
    household_id: householdId,
    dish_id: plan.dishId,
    status: plan.status,
    plan_date: plan.planDate || null,
    created_by: userId,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
  }
}

export function toShoppingItem(row: Record<string, unknown>): ShoppingItem {
  const status = (row.status as ShoppingItem['status']) ?? (row.checked ? 'purchased' : 'pending')
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    amount: String(row.amount ?? ''),
    source: String(row.source ?? ''),
    checked: Boolean(row.checked),
    status,
  }
}

function fromShoppingItem(item: ShoppingItem, householdId: string) {
  return {
    id: item.id,
    household_id: householdId,
    name: item.name,
    amount: item.amount,
    source: item.source,
    checked: item.checked,
    status: item.status ?? (item.checked ? 'purchased' : 'pending'),
    updated_at: new Date().toISOString(),
  }
}

export function toCookingLog(row: Record<string, unknown>): CookingLog {
  return {
    id: String(row.id),
    dishId: String(row.dish_id ?? ''),
    dishName: String(row.dish_name ?? ''),
    date: String(row.cook_date ?? ''),
    rating: row.rating as CookingLog['rating'],
    note: typeof row.note === 'string' ? row.note : undefined,
    miliReward: Number(row.mili_reward ?? 0),
  }
}

function fromCookingLog(log: CookingLog, householdId: string, userId: string | null) {
  return {
    id: log.id,
    household_id: householdId,
    dish_id: log.dishId,
    dish_name: log.dishName,
    cook_date: log.date,
    rating: log.rating ?? null,
    note: log.note ?? null,
    mili_reward: log.miliReward,
    cooked_by: userId,
  }
}

export function toMyDishVersion(row: Record<string, unknown>): MyDishVersion {
  return {
    dishId: String(row.dish_id ?? ''),
    ingredients: Array.isArray(row.ingredients) ? row.ingredients as MyDishVersion['ingredients'] : [],
    steps: Array.isArray(row.steps) ? row.steps as string[] : [],
    cookTime: String(row.cook_time ?? ''),
    myNote: String(row.my_note ?? ''),
    rating: typeof row.rating === 'string' ? row.rating : undefined,
    createdAt: Number(row.created_at_ms ?? (row.created_at ? Date.parse(String(row.created_at)) : Date.now())),
    updatedAt: Number(row.updated_at_ms ?? (row.updated_at ? Date.parse(String(row.updated_at)) : Date.now())),
  }
}

function fromMyDishVersion(version: MyDishVersion, householdId: string, userId: string | null) {
  return {
    household_id: householdId,
    dish_id: version.dishId,
    ingredients: version.ingredients,
    steps: version.steps,
    cook_time: version.cookTime,
    my_note: version.myNote,
    rating: version.rating ?? null,
    created_by: userId,
    created_at_ms: version.createdAt,
    updated_at_ms: version.updatedAt,
    updated_at: new Date(version.updatedAt).toISOString(),
  }
}

export function toFantuanState(row: Record<string, unknown>): FantuanState {
  return {
    mili: Number(row.mili ?? 0),
    level: Number(row.level ?? 1),
    cookingStreak: Number(row.cooking_streak ?? 0),
    totalCooked: Number(row.total_cooked ?? 0),
    tasteProfile: {
      spicy: (Number(row.spicy ?? 1) as 0 | 1 | 2 | 3),
      salty: (Number(row.salty ?? 1) as 0 | 1 | 2),
      sweet: (Number(row.sweet ?? 1) as 0 | 1 | 2),
      avoid: Array.isArray(row.avoid) ? row.avoid as string[] : [],
      note: typeof row.taste_note === 'string' ? row.taste_note : '',
    },
  }
}

function fromFantuanState(fantuan: FantuanState, householdId: string) {
  return {
    household_id: householdId,
    mili: fantuan.mili,
    level: fantuan.level,
    cooking_streak: fantuan.cookingStreak,
    total_cooked: fantuan.totalCooked,
    spicy: fantuan.tasteProfile.spicy,
    salty: fantuan.tasteProfile.salty,
    sweet: fantuan.tasteProfile.sweet,
    avoid: fantuan.tasteProfile.avoid,
    taste_note: fantuan.tasteProfile.note,
    updated_at: new Date().toISOString(),
  }
}

export async function syncPantryItem(item: PantryItem): Promise<void> {
  if (!shouldSync()) return
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return
  const { error } = await supabase.from('pantry_items').upsert(fromPantryItem(item, householdId))
  reportSyncError('写入冰箱', error)
}

export async function deletePantryItem(id: string): Promise<void> {
  if (!shouldSync()) return
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return
  const { error } = await supabase.from('pantry_items').delete().eq('household_id', householdId).eq('id', id)
  reportSyncError('删除冰箱', error)
}

export async function syncMealPlan(plan: MealPlan): Promise<void> {
  if (!shouldSync()) return
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return
  const userId = await getUserId()
  const { error } = await supabase.from('meal_plans').upsert(fromMealPlan(plan, householdId, userId))
  reportSyncError('写入计划', error)
}

export async function deleteMealPlan(id: string): Promise<void> {
  if (!shouldSync()) return
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return
  const { error } = await supabase.from('meal_plans').delete().eq('household_id', householdId).eq('id', id)
  reportSyncError('删除计划', error)
}

export async function syncShoppingItem(item: ShoppingItem): Promise<void> {
  if (!shouldSync()) return
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return
  const { error } = await supabase.from('shopping_items').upsert(fromShoppingItem(item, householdId))
  reportSyncError('写入购物清单', error)
}

export async function deleteShoppingItem(id: string): Promise<void> {
  if (!shouldSync()) return
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return
  const { error } = await supabase.from('shopping_items').delete().eq('household_id', householdId).eq('id', id)
  reportSyncError('删除购物清单', error)
}

export async function syncCookingLog(log: CookingLog): Promise<void> {
  if (!shouldSync()) return
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return
  const userId = await getUserId()
  const { error } = await supabase.from('cooking_logs').upsert(fromCookingLog(log, householdId, userId))
  reportSyncError('写入做饭记录', error)
}

export async function syncMyDishVersion(version: MyDishVersion): Promise<void> {
  if (!shouldSync()) return
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return
  const userId = await getUserId()
  const { error } = await supabase
    .from('my_dish_versions')
    .upsert(fromMyDishVersion(version, householdId, userId), { onConflict: 'household_id,dish_id' })
  reportSyncError('写入我家版', error)
}

export async function deleteMyDishVersion(dishId: string): Promise<void> {
  if (!shouldSync()) return
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return
  const { error } = await supabase.from('my_dish_versions').delete().eq('household_id', householdId).eq('dish_id', dishId)
  reportSyncError('删除我家版', error)
}

export async function syncFantuanState(fantuan: FantuanState): Promise<void> {
  if (!shouldSync()) return
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return
  const { error } = await supabase
    .from('fantuan_state')
    .upsert(fromFantuanState(fantuan, householdId), { onConflict: 'household_id' })
  reportSyncError('写入饭团状态', error)
}

export async function deleteCookingLog(id: string): Promise<void> {
  if (!shouldSync()) return
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return
  const { error } = await supabase.from('cooking_logs').delete().eq('household_id', householdId).eq('id', id)
  reportSyncError('删除做饭记录', error)
}

// ── 周备餐计划云端同步 ──
import type { WeeklyPrepPlan } from '@/data/weeklyPrepPlan'

export function toWeeklyPrepPlan(row: Record<string, unknown>): WeeklyPrepPlan {
  const planData = row.plan_data as Record<string, unknown>
  return {
    weekStart: String(planData.weekStart ?? row.week_start ?? ''),
    weekEnd: String(planData.weekEnd ?? row.week_end ?? ''),
    mealsPerDay: (Number(planData.mealsPerDay ?? row.meals_per_day ?? 2)) as 1 | 2,
    servings: Number(planData.servings ?? row.servings ?? 2),
    status: (String(planData.status ?? row.status ?? 'draft')) as WeeklyPrepPlan['status'],
    createdAt: String(planData.createdAt ?? row.created_at ?? new Date().toISOString()),
    days: Array.isArray(planData.days) ? planData.days as WeeklyPrepPlan['days'] : [],
    batches: Array.isArray(planData.batches) ? planData.batches as WeeklyPrepPlan['batches'] : [],
  }
}

export async function syncWeeklyPrepPlan(plan: WeeklyPrepPlan): Promise<void> {
  if (!shouldSync()) return
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return
  const id = `${householdId}-${plan.weekStart}`
  const { error } = await supabase.from('weekly_prep_plans').upsert({
    id,
    household_id: householdId,
    week_start: plan.weekStart,
    week_end: plan.weekEnd,
    meals_per_day: plan.mealsPerDay,
    servings: plan.servings,
    status: plan.status,
    plan_data: plan,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'household_id,week_start' })
  reportSyncError('写入周备餐', error)
}

export async function deleteWeeklyPrepPlan(weekStart: string): Promise<void> {
  if (!shouldSync()) return
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return
  const { error } = await supabase.from('weekly_prep_plans')
    .delete().eq('household_id', householdId).eq('week_start', weekStart)
  reportSyncError('删除周备餐', error)
}

// ── 今日掌勺人云端同步 ──

export async function syncTodayChefId(chefId: string): Promise<void> {
  if (!shouldSync()) return
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return
  const { error } = await supabase
    .from('household_settings')
    .upsert({
      household_id: householdId,
      today_chef_id: chefId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'household_id' })
  reportSyncError('写入今日掌勺', error)
}

export async function fetchTodayChefId(): Promise<string | null> {
  if (!shouldSync()) return null
  const supabase = getSupabase(); const householdId = getHouseholdId()
  if (!supabase || !householdId) return null
  const { data, error } = await supabase
    .from('household_settings')
    .select('today_chef_id')
    .eq('household_id', householdId)
    .maybeSingle()
  if (error) {
    reportSyncError('读取今日掌勺', error)
    return null
  }
  return data?.today_chef_id ?? null
}
