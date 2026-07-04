/**
 * 家庭数据同步 Hook
 *
 * 设计：云端优先 + 本地降级
 * - Supabase 已配置且登录 → 读写走云端，实时订阅推送更新
 * - Supabase 未配置或未登录 → 降级到 localStorage（现有逻辑不变）
 *
 * 数据流：
 *   用户操作 → Zustand store.set() → 本地立即更新
 *                          ↓ (异步)
 *                    Supabase upsert → 实时订阅 → 远端变更回写 store
 */
import { useEffect, useRef } from 'react'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabaseClient'
import { useFandaziStore } from '@/stores/fandaziStore'
import type { PantryItem, MealPlan, MyDishVersion } from '@/types'
import type { CookingLog, ShoppingItem, FantuanState } from '@/stores/fandaziStore'

type SyncStatus = 'offline' | 'connecting' | 'synced' | 'error'

let currentStatus: SyncStatus = 'offline'
const statusListeners = new Set<(s: SyncStatus) => void>()

export function getSyncStatus(): SyncStatus {
  return currentStatus
}

export function onSyncStatusChange(fn: (s: SyncStatus) => void): () => void {
  statusListeners.add(fn)
  return () => statusListeners.delete(fn)
}

function setStatus(s: SyncStatus) {
  currentStatus = s
  statusListeners.forEach((fn) => fn(s))
}

/** 获取当前家庭 ID（从 localStorage 读取登录后缓存的） */
function getHouseholdId(): string | null {
  try {
    return localStorage.getItem('fandazi.householdId')
  } catch {
    return null
  }
}

/**
 * useFamilySync — 在 App 根节点调用一次
 * 负责建立 Supabase 实时订阅，将远端变更同步回 Zustand store
 */
export function useFamilySync() {
  const subscribed = useRef(false)

  useEffect(() => {
    if (subscribed.current) return
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
      setStatus('offline') // 未加入家庭，走本地模式
      return
    }

    subscribed.current = true
    setStatus('connecting')

    // ── 实时订阅 ──
    // 每张表监听 INSERT/UPDATE/DELETE，变更回写 store

    const channel = supabase
      .channel('family-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pantry_items', filter: `household_id=eq.${householdId}` },
        (payload) => {
          const store = useFandaziStore.getState()
          if (payload.eventType === 'DELETE') {
            const old = payload.old as PantryItem
            store.removePantryItem(old.id)
          } else {
            const row = payload.new as PantryItem
            // upsert to store
            const exists = store.pantry.find((p) => p.id === row.id)
            if (!exists) {
              store.addPantryItem(row)
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meal_plans', filter: `household_id=eq.${householdId}` },
        (payload) => {
          const store = useFandaziStore.getState()
          if (payload.eventType === 'DELETE') {
            const old = payload.old as MealPlan
            store.removeMealPlan(old.id)
          } else {
            const row = payload.new as MealPlan
            const exists = store.mealPlans.find((p) => p.id === row.id)
            if (!exists) {
              store.addMealPlan(row.dishId, row.planDate)
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_items', filter: `household_id=eq.${householdId}` },
        (payload) => {
          const store = useFandaziStore.getState()
          if (payload.eventType === 'DELETE') {
            const old = payload.old as ShoppingItem
            store.removeShoppingItem(old.id)
          } else {
            const row = payload.new as ShoppingItem
            const exists = store.shoppingList.find((i) => i.id === row.id)
            if (!exists) {
              store.addShoppingItem(row)
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cooking_logs', filter: `household_id=eq.${householdId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as CookingLog
            const store = useFandaziStore.getState()
            const exists = store.cookingLogs.find((l) => l.id === row.id)
            if (!exists) {
              store.addCookingLog(row)
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'my_dish_versions', filter: `household_id=eq.${householdId}` },
        (payload) => {
          const store = useFandaziStore.getState()
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { dish_id: string }
            store.removeMyDishVersion(old.dish_id)
          } else {
            const row = payload.new as MyDishVersion & { dish_id: string }
            const exists = store.myDishVersions.find((v) => v.dishId === row.dish_id)
            if (!exists && row.dish_id) {
              store.upsertMyDishVersion({
                dishId: row.dish_id,
                ingredients: row.ingredients,
                steps: row.steps,
                cookTime: row.cookTime,
                myNote: row.myNote,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
              })
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fantuan_state', filter: `household_id=eq.${householdId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as FantuanState
            const store = useFandaziStore.getState()
            const current = store.fantuan
            if (row.mili !== current.mili || row.level !== current.level) {
              store.addMili(row.mili - current.mili)
            }
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setStatus('synced')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setStatus('error')
        }
      })

    return () => {
      supabase.removeChannel(channel)
      subscribed.current = false
    }
  }, [])
}
