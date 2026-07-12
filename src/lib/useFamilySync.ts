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
  withRemoteApply,
} from '@/lib/familyCloudSync'

type SyncStatus = 'offline' | 'connecting' | 'synced' | 'error'

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
    useFandaziStore.getState().replaceFamilyData({
      pantry: (pantry.data ?? []).map((row) => toPantryItem(row)),
      mealPlans: (mealPlans.data ?? []).map((row) => toMealPlan(row)),
      shoppingList: (shopping.data ?? []).map((row) => toShoppingItem(row)),
      cookingLogs: (cooking.data ?? []).map((row) => toCookingLog(row)),
      myDishVersions: (versions.data ?? []).map((row) => toMyDishVersion(row)),
      ...(fantuan.data ? { fantuan: toFantuanState(fantuan.data) } : {}),
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
            if (payload.eventType === 'DELETE') return
            withRemoteApply(() => {
              useFandaziStore.getState().addCookingLog(toCookingLog(payload.new))
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

    return () => {
      window.removeEventListener(FANDAZI_SYNC_CONFIG_EVENT, startSync)
      window.removeEventListener('storage', startSync)
      stopSync()
    }
  }, [])
}
