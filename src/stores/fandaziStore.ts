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
  toggleShoppingItem: (id: string) => void
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
const DEFAULT_PANTRY: PantryItem[] = [
  { id: uid(), ingredientName: '番茄', category: '蔬菜', quantity: 3, unit: '个', storage: 'fridge', boughtAt: '2026-07-01', bestBeforeAt: '2026-07-06', source: 'manual_add', status: 'fresh' },
  { id: uid(), ingredientName: '鸡蛋', category: '肉蛋', quantity: 8, unit: '个', storage: 'fridge', boughtAt: '2026-07-01', bestBeforeAt: '2026-07-15', source: 'manual_add', status: 'fresh' },
  { id: uid(), ingredientName: '鸡胸肉', category: '肉蛋', quantity: 500, unit: 'g', storage: 'fridge', boughtAt: '2026-06-30', bestBeforeAt: '2026-07-04', source: 'manual_add', status: 'use_soon' },
  { id: uid(), ingredientName: '西兰花', category: '蔬菜', quantity: 1, unit: '个', storage: 'fridge', boughtAt: '2026-07-01', bestBeforeAt: '2026-07-07', source: 'manual_add', status: 'fresh' },
  { id: uid(), ingredientName: '葱', category: '蔬菜', quantity: 2, unit: '根', storage: 'fridge', boughtAt: '2026-06-28', bestBeforeAt: '2026-07-05', source: 'manual_add', status: 'use_soon' },
  { id: uid(), ingredientName: '蒜', category: '蔬菜', quantity: 1, unit: '头', storage: 'room', boughtAt: '2026-06-25', bestBeforeAt: '2026-07-25', source: 'manual_add', status: 'fresh' },
  { id: uid(), ingredientName: '生抽', category: '调味', quantity: 1, unit: '瓶', storage: 'room', boughtAt: '2026-06-20', bestBeforeAt: '2026-12-20', source: 'manual_add', status: 'fresh' },
  { id: uid(), ingredientName: '虾仁', category: '肉蛋', quantity: 200, unit: 'g', storage: 'freezer', boughtAt: '2026-06-28', bestBeforeAt: '2026-08-28', source: 'manual_add', status: 'fresh' },
]

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
        const plan: MealPlan = {
          id: uid(),
          dishId,
          status: 'planned' as PlanStatus,
          planDate: date,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({ mealPlans: [...s.mealPlans.filter((p) => p.id !== plan.id), plan] }))
        void syncMealPlan(plan)
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
        set((s) => ({ shoppingList: [...s.shoppingList.filter((i) => i.id !== item.id), item] }))
        void syncShoppingItem(item)
      },
      toggleShoppingItem: (id) => {
        let updatedItem: ShoppingItem | undefined
        set((s) => {
          const shoppingList = s.shoppingList.map((i) => {
            if (i.id !== id) return i
            updatedItem = { ...i, checked: !i.checked }
            return updatedItem
          })
          return { shoppingList }
        })
        if (updatedItem) void syncShoppingItem(updatedItem)
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
