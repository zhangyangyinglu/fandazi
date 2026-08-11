/**
 * 家庭数据同步 Hook
 *
 * 云端优先 + 本地降级：
 * - 未配置 Supabase / 未登录 / 未加入家庭 → 保留 Zustand + localStorage 单机体验
 * - 已配置且有 householdId → 启动初始拉取 + Realtime 订阅 + store action 写回云端
 */
import { useEffect, useRef } from 'react'
import { FANDAZI_SYNC_CONFIG_EVENT, getSupabase, isSupabaseConfigured } from '@/lib/supabaseClient'
import { useFandaziStore } from '@/stores/fandaziStore'
import { refreshAiConfigFromCloud } from '@/lib/aiProviderConfig'
import {
  getHouseholdId,
  toCookingLog,
  toFantuanState,
  toMealPlan,
  toMyDishVersion,
  toPantryItem,
  toShoppingItem,
  toWeeklyPrepPlan,
  withRemoteApply,
} from '@/lib/familyCloudSync'
import { onSyncError } from '@/lib/familyCloudSync'

export type SyncStatus = 'offline' | 'connecting' | 'synced' | 'error'

let currentStatus: SyncStatus = 'offline'
const statusListeners = new Set<(_s: SyncStatus) => void>()

export function getSyncStatus(): SyncStatus {
  return currentStatus
}

export function onSyncStatusChange(fn: (_s: SyncStatus) => void): () => void {
  statusListeners.add(fn)
  return () => statusListeners.delete(fn)
}

function setStatus(s: SyncStatus) {
  currentStatus = s
  statusListeners.forEach((fn) => fn(s))
}

async function loadInitialFamilyData(householdId: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  const [pantry, mealPlans, shopping, cooking, versions, fantuan] = await Promise.all([
    supabase.from('pantry_items').select('*').eq('household_id', householdId),
    supabase.from('meal_plans').select('*').eq('household_id', householdId),
    supabase.from('shopping_items').select('*').eq('household_id', householdId),
    supabase.from('cooking_logs').select('*').eq('household_id', householdId),
    supabase.from('my_dish_versions').select('*').eq('household_id', householdId),
    supabase.from('fantuan_state').select('*').eq('household_id', householdId).maybeSingle(),
  ])

  const errors = [pantry.error, mealPlans.error, shopping.error, cooking.error, versions.error, fantuan.error].filter(Boolean)
  if (errors.length > 0) {
    void errors
    setStatus('error')
    return
  }

  withRemoteApply(() => {
    const store = useFandaziStore.getState()
    const localFantuan = store.fantuan

    // 云端饭团数据与本地合并：保留本地口味档案，取较高的进度值
    let mergedFantuan = localFantuan
    if (fantuan.data) {
      const remote = toFantuanState(fantuan.data)
      mergedFantuan = {
        mili: Math.max(localFantuan.mili, remote.mili),
        level: Math.max(localFantuan.level, remote.level),
        cookingStreak: Math.max(localFantuan.cookingStreak, remote.cookingStreak),
        totalCooked: Math.max(localFantuan.totalCooked, remote.totalCooked),
        // 口味档案：本地优先，本地为默认值时才取云端
        tasteProfile: localFantuan.tasteProfile.spicy === 1
          && localFantuan.tasteProfile.salty === 1
          && localFantuan.tasteProfile.sweet === 1
          && localFantuan.tasteProfile.avoid.length === 0
          && localFantuan.tasteProfile.note === ''
          ? remote.tasteProfile
          : localFantuan.tasteProfile,
      }
    }

    // 合并策略：以云端数据为主，但保留本地独有的条目
    const cloudPantry = (pantry.data ?? []).map((row) => toPantryItem(row))
    const cloudMealPlans = (mealPlans.data ?? []).map((row) => toMealPlan(row))
    const cloudShopping = (shopping.data ?? []).map((row) => toShoppingItem(row))
    const cloudCooking = (cooking.data ?? []).map((row) => toCookingLog(row))
    const cloudVersions = (versions.data ?? []).map((row) => toMyDishVersion(row))

    const localPantryIds = new Set(cloudPantry.map((p) => p.id))
    const localMealPlanIds = new Set(cloudMealPlans.map((p) => p.id))
    const localShoppingIds = new Set(cloudShopping.map((p) => p.id))
    const localCookingIds = new Set(cloudCooking.map((p) => p.id))
    const localVersionDishIds = new Set(cloudVersions.map((p) => p.dishId))

    store.replaceFamilyData({
      pantry: [...cloudPantry, ...store.pantry.filter((p) => !localPantryIds.has(p.id))],
      mealPlans: [...cloudMealPlans, ...store.mealPlans.filter((p) => !localMealPlanIds.has(p.id))],
      shoppingList: [...cloudShopping, ...store.shoppingList.filter((p) => !localShoppingIds.has(p.id))],
      cookingLogs: [...cloudCooking, ...store.cookingLogs.filter((p) => !localCookingIds.has(p.id))],
      myDishVersions: [...cloudVersions, ...store.myDishVersions.filter((p) => !localVersionDishIds.has(p.dishId))],
      fantuan: mergedFantuan,
    })
  })
}

/**
 * useFamilySync — 在 App 根节点调用一次
 */
export function useFamilySync() {
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    function stopSync() {
      cleanupRef.current?.()
      cleanupRef.current = null
    }

    function startSync() {
      stopSync()

      if (!isSupabaseConfigured()) {
        setStatus('offline')
        return
      }

      const supabase = getSupabase()
      if (!supabase) {
        setStatus('offline')
        return
      }

      const householdId = getHouseholdId()
      if (!householdId) {
        setStatus('offline')
        return
      }

      let cancelled = false
      setStatus('connecting')

      void loadInitialFamilyData(householdId).then(() => {
        if (!cancelled && currentStatus !== 'error') setStatus('synced')
      })
      // 拉取家庭共享的 AI Key 配置
      void refreshAiConfigFromCloud()

      const channel = supabase
        .channel(`family-sync-${householdId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pantry_items', filter: `household_id=eq.${householdId}` },
          (payload) => {
            withRemoteApply(() => {
              const store = useFandaziStore.getState()
              if (payload.eventType === 'DELETE') {
                store.removePantryItem(String(payload.old.id))
              } else {
                // UPDATE/INSERT: 先移除旧的再添加新的，避免重复
                const item = toPantryItem(payload.new)
                store.removePantryItem(item.id)
                store.addPantryItem(item)
              }
            })
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'meal_plans', filter: `household_id=eq.${householdId}` },
          (payload) => {
            withRemoteApply(() => {
              const store = useFandaziStore.getState()
              if (payload.eventType === 'DELETE') {
                store.removeMealPlan(String(payload.old.id))
              } else {
                const plan = toMealPlan(payload.new)
                store.replaceFamilyData({ mealPlans: [...store.mealPlans.filter((p) => p.id !== plan.id), plan] })
              }
            })
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shopping_items', filter: `household_id=eq.${householdId}` },
          (payload) => {
            withRemoteApply(() => {
              const store = useFandaziStore.getState()
              if (payload.eventType === 'DELETE') {
                store.removeShoppingItem(String(payload.old.id))
              } else {
                // UPDATE/INSERT: 先移除旧的再添加新的，避免重复
                const item = toShoppingItem(payload.new)
                store.removeShoppingItem(item.id)
                store.addShoppingItem(item)
              }
            })
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cooking_logs', filter: `household_id=eq.${householdId}` },
          (payload) => {
            withRemoteApply(() => {
              const store = useFandaziStore.getState()
              if (payload.eventType === 'DELETE') {
                store.removeCookingLog(String(payload.old.id))
              } else {
                store.addCookingLog(toCookingLog(payload.new))
              }
            })
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'my_dish_versions', filter: `household_id=eq.${householdId}` },
          (payload) => {
            withRemoteApply(() => {
              const store = useFandaziStore.getState()
              if (payload.eventType === 'DELETE') {
                store.removeMyDishVersion(String(payload.old.dish_id))
              } else {
                store.upsertMyDishVersion(toMyDishVersion(payload.new))
              }
            })
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'fantuan_state', filter: `household_id=eq.${householdId}` },
          (payload) => {
            if (payload.eventType === 'DELETE') return
            withRemoteApply(() => {
              useFandaziStore.getState().setFantuan(toFantuanState(payload.new))
            })
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'weekly_prep_plans', filter: `household_id=eq.${householdId}` },
          (payload) => {
            if (payload.eventType === 'DELETE') return
            // 周备餐计划变更通过事件通知 UI 刷新
            window.dispatchEvent(new CustomEvent('fandazi:weekly-prep-cloud', {
              detail: toWeeklyPrepPlan(payload.new),
            }))
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'household_settings', filter: `household_id=eq.${householdId}` },
          (payload) => {
            // 家庭设置（AI Key 等）变更通知 UI 刷新
            window.dispatchEvent(new CustomEvent('fandazi:household-settings-cloud', {
              detail: payload.new,
            }))
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setStatus('synced')
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setStatus('error')
          }
        })

      cleanupRef.current = () => {
        cancelled = true
        supabase.removeChannel(channel)
      }
    }

    startSync()
    window.addEventListener(FANDAZI_SYNC_CONFIG_EVENT, startSync)
    window.addEventListener('storage', startSync)

    // 同步错误监听：写入失败时切换到 error 状态
    const removeSyncErrorListener = onSyncError((_action, _error) => {
      setStatus('error')
    })

    return () => {
      window.removeEventListener(FANDAZI_SYNC_CONFIG_EVENT, startSync)
      window.removeEventListener('storage', startSync)
      removeSyncErrorListener()
      stopSync()
    }
  }, [])
}
