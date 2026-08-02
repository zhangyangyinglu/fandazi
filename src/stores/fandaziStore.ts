/**
 * 饭搭子主 Store — Zustand + persist (localStorage)
 *
 * P2 主链路状态：冰箱 / 计划 / 购物 / 做饭记录 / 我家版 / 饭团
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  PantryItem,
  MealPlan,
  PlanStatus,
  MyDishVersion,
} from '@/types'
import { DISHES } from '@/data/dishes'
import type { Dish } from '@/types'
import {
  deleteMealPlan,
  deleteMyDishVersion,
  deletePantryItem,
  deleteShoppingItem,
  syncCookingLog,
  syncFantuanState,
  syncMealPlan,
  syncMyDishVersion,
  syncPantryItem,
  syncShoppingItem,
} from '@/lib/familyCloudSync'

// ─────────────────────────────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────────────────────────────

export interface CookingLog {
  id: string
  dishId: string
  dishName: string
  date: string // YYYY-MM-DD
  rating?: 'good' | 'ok' | 'bad'
  note?: string
  miliReward: number
}

export interface ShoppingItem {
  id: string
  name: string
  amount: string
  source: string // 菜名
  checked: boolean
  category?: PantryItem['category']
  packageSpec?: string
  note?: string
  status?: 'pending' | 'purchased' | 'stored'
}

export interface TasteProfile {
  /** 辣度 0-3: 不辣/微辣/中辣/重辣 */
  spicy: 0 | 1 | 2 | 3
  /** 咸度 0-2: 清淡/适中/偏咸 */
  salty: 0 | 1 | 2
  /** 偏甜偏好 0-2: 不甜/适中/嗜甜 */
  sweet: 0 | 1 | 2
  /** 忌口标签 */
  avoid: string[]
  /** 自由文本备注 */
  note: string
}

export interface FantuanState {
  mili: number
  level: number
  cookingStreak: number
  totalCooked: number
  tasteProfile: TasteProfile
}

export interface FandaziStore {
  // 冰箱
  pantry: PantryItem[]
  addPantryItem: (item: PantryItem) => void
  removePantryItem: (id: string) => void
  updatePantryItem: (id: string, patch: Partial<PantryItem>) => void

  // 计划
  mealPlans: MealPlan[]
  addMealPlan: (dishId: string, date: string) => void
  updatePlanStatus: (planId: string, status: PlanStatus) => void
  removeMealPlan: (planId: string) => void

  // 购物清单
  shoppingList: ShoppingItem[]
  addShoppingItem: (item: ShoppingItem) => void
  updateShoppingItem: (id: string, patch: Partial<ShoppingItem>) => void
  toggleShoppingItem: (id: string) => void
  markShoppingPurchased: (id: string) => void
  storeShoppingItem: (id: string) => void
  removeShoppingItem: (id: string) => void
  clearCheckedShoppingItems: () => void

  // 做饭记录
  cookingLogs: CookingLog[]
  addCookingLog: (log: CookingLog) => void

  // 我家版
  myDishVersions: MyDishVersion[]
  upsertMyDishVersion: (version: MyDishVersion) => void
  removeMyDishVersion: (dishId: string) => void

  // 饭团
  fantuan: FantuanState
  addMili: (amount: number) => void
  setFantuan: (fantuan: FantuanState) => void
  updateTasteProfile: (patch: Partial<TasteProfile>) => void

  // 云端同步回写
  replaceFamilyData: (data: Partial<Pick<FandaziStore, 'pantry' | 'mealPlans' | 'shoppingList' | 'cookingLogs' | 'myDishVersions' | 'fantuan'>>) => void

  // 派生数据
  getDishById: (id: string) => Dish | undefined
}

// ─────────────────────────────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID()

// 默认冰箱初始数据
const DEFAULT_PANTRY: PantryItem[] = []

// ─────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────

export const useFandaziStore = create<FandaziStore>()(
  persist(
    (set, get) => ({
      // === 冰箱 ===
      pantry: DEFAULT_PANTRY,
      addPantryItem: (item) => {
        set((s) => ({ pantry: [...s.pantry.filter((p) => p.id !== item.id), item] }))
        void syncPantryItem(item)
      },
      removePantryItem: (id) => {
        set((s) => ({ pantry: s.pantry.filter((p) => p.id !== id) }))
        void deletePantryItem(id)
      },
      updatePantryItem: (id, patch) => {
        let updatedItem: PantryItem | undefined
        set((s) => {
          const pantry = s.pantry.map((p) => {
            if (p.id !== id) return p
            updatedItem = { ...p, ...patch }
            return updatedItem
          })
          return { pantry }
        })
        if (updatedItem) void syncPantryItem(updatedItem)
      },

      // === 计划 ===
      mealPlans: [],
      addMealPlan: (dishId, date) => {
        let planToSync: MealPlan | undefined
        set((s) => {
          const existing = s.mealPlans.find((plan) => plan.dishId === dishId && plan.planDate === date)
          const now = new Date().toISOString()
          planToSync = existing
            ? { ...existing, status: 'planned' as PlanStatus, updatedAt: now }
            : { id: uid(), dishId, status: 'planned' as PlanStatus, planDate: date, createdAt: now, updatedAt: now }
          return {
            mealPlans: existing
              ? s.mealPlans.map((plan) => plan.id === existing.id ? planToSync! : plan)
              : [...s.mealPlans, planToSync],
          }
        })
        if (planToSync) void syncMealPlan(planToSync)
      },
      updatePlanStatus: (planId, status) => {
        let updatedPlan: MealPlan | undefined
        set((s) => {
          const mealPlans = s.mealPlans.map((p) => {
            if (p.id !== planId) return p
            updatedPlan = { ...p, status, updatedAt: new Date().toISOString() }
            return updatedPlan
          })
          return { mealPlans }
        })
        if (updatedPlan) void syncMealPlan(updatedPlan)
      },
      removeMealPlan: (planId) => {
        set((s) => ({ mealPlans: s.mealPlans.filter((p) => p.id !== planId) }))
        void deleteMealPlan(planId)
      },

      // === 购物清单 ===
      shoppingList: [],
      addShoppingItem: (item) => {
        const next = { status: 'pending' as const, ...item }
        set((s) => ({ shoppingList: [...s.shoppingList.filter((i) => i.id !== next.id), next] }))
        void syncShoppingItem(next)
      },
      updateShoppingItem: (id, patch) => {
        let updatedItem: ShoppingItem | undefined
        set((s) => ({
          shoppingList: s.shoppingList.map((item) => {
            if (item.id !== id) return item
            updatedItem = { ...item, ...patch }
            return updatedItem
          }),
        }))
        if (updatedItem) void syncShoppingItem(updatedItem)
      },
      toggleShoppingItem: (id) => {
        let updatedItem: ShoppingItem | undefined
        set((s) => {
          const shoppingList = s.shoppingList.map((i) => {
            if (i.id !== id) return i
            updatedItem = { ...i, checked: !i.checked, status: !i.checked ? 'purchased' : 'pending' }
            return updatedItem
          })
          return { shoppingList }
        })
        if (updatedItem) void syncShoppingItem(updatedItem)
      },
      markShoppingPurchased: (id) => {
        let updatedItem: ShoppingItem | undefined
        set((s) => ({ shoppingList: s.shoppingList.map((item) => {
          if (item.id !== id) return item
          updatedItem = { ...item, checked: true, status: 'purchased' }
          return updatedItem
        }) }))
        if (updatedItem) void syncShoppingItem(updatedItem)
      },
      storeShoppingItem: (id) => {
        const item = get().shoppingList.find((entry) => entry.id === id)
        if (!item || item.status !== 'purchased') return
        const quantityMatch = item.amount.match(/[\d.]+/)
        const unitMatch = item.amount.match(/[一-龥]+|[a-zA-Z]+/)
        const pantryItem: PantryItem = {
          id: uid(),
          ingredientName: item.name,
          category: item.category ?? '蔬菜',
          quantity: Number(quantityMatch?.[0] ?? 1),
          unit: unitMatch?.[0] ?? '份',
          storage: 'fridge',
          boughtAt: new Date().toISOString().slice(0, 10),
          bestBeforeAt: '',
          source: 'shopping_list',
          status: 'fresh',
          note: item.note,
        }
        set((s) => ({
          pantry: [...s.pantry, pantryItem],
          shoppingList: s.shoppingList.map((entry) => entry.id === id ? { ...entry, status: 'stored' } : entry),
        }))
        void syncPantryItem(pantryItem)
        void syncShoppingItem({ ...item, status: 'stored' })
      },
      removeShoppingItem: (id) => {
        set((s) => ({ shoppingList: s.shoppingList.filter((i) => i.id !== id) }))
        void deleteShoppingItem(id)
      },
      clearCheckedShoppingItems: () => {
        const checkedIds = get().shoppingList.filter((i) => i.checked).map((i) => i.id)
        set((s) => ({ shoppingList: s.shoppingList.filter((i) => !i.checked) }))
        checkedIds.forEach((id) => void deleteShoppingItem(id))
      },

      // === 做饭记录 ===
      cookingLogs: [],
      addCookingLog: (log) => {
        set((s) => {
          // 计算连续做菜天数
          const today = log.date || new Date().toISOString().slice(0, 10)
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
          const prevLog = s.cookingLogs[0]
          const prevDate = prevLog?.date?.slice(0, 10)
          let newStreak = s.fantuan.cookingStreak
          if (!prevDate) {
            newStreak = 1
          } else if (prevDate === today) {
            // 同一天重复记录，不增加
          } else if (prevDate === yesterday) {
            newStreak = s.fantuan.cookingStreak + 1
          } else {
            newStreak = 1 // 断了，重新开始
          }

          return {
            cookingLogs: [log, ...s.cookingLogs.filter((l) => l.id !== log.id)],
            fantuan: {
              ...s.fantuan,
              totalCooked: s.fantuan.totalCooked + 1,
              cookingStreak: newStreak,
            },
          }
        })
        void syncCookingLog(log)
      },

      // === 我家版 ===
      myDishVersions: [],
      upsertMyDishVersion: (version) => {
        const syncedVersion = { ...version, updatedAt: Date.now() }
        set((s) => {
          const idx = s.myDishVersions.findIndex((v) => v.dishId === version.dishId)
          if (idx >= 0) {
            const updated = [...s.myDishVersions]
            updated[idx] = syncedVersion
            return { myDishVersions: updated }
          }
          return { myDishVersions: [...s.myDishVersions, syncedVersion] }
        })
        void syncMyDishVersion(syncedVersion)
      },
      removeMyDishVersion: (dishId) => {
        set((s) => ({ myDishVersions: s.myDishVersions.filter((v) => v.dishId !== dishId) }))
        void deleteMyDishVersion(dishId)
      },

      // === 饭团 ===
      fantuan: { mili: 0, level: 1, cookingStreak: 0, totalCooked: 0, tasteProfile: { spicy: 1, salty: 1, sweet: 1, avoid: [], note: '' } },
      addMili: (amount) => {
        let nextFantuan: FantuanState
        set((s) => {
          nextFantuan = {
            ...s.fantuan,
            mili: s.fantuan.mili + amount,
          }
          return { fantuan: nextFantuan }
        })
        void syncFantuanState(nextFantuan!)
      },
      setFantuan: (fantuan) => {
        set({ fantuan })
        void syncFantuanState(fantuan)
      },
      updateTasteProfile: (patch) => {
        set((s) => {
          const nextFantuan = { ...s.fantuan, tasteProfile: { ...s.fantuan.tasteProfile, ...patch } }
          void syncFantuanState(nextFantuan)
          return { fantuan: nextFantuan }
        })
      },

      replaceFamilyData: (data) => set(data),

      // === 派生 ===
      getDishById: (id) => DISHES.find((d) => d.id === id),
    }),
    {
      name: 'fandazi-web-tool',
      partialize: (s) => ({
        pantry: s.pantry,
        mealPlans: s.mealPlans,
        shoppingList: s.shoppingList,
        cookingLogs: s.cookingLogs,
        myDishVersions: s.myDishVersions,
        fantuan: s.fantuan,
      }),
    },
  ),
)
