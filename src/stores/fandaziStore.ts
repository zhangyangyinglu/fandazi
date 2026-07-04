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

export interface FantuanState {
  mili: number
  level: number
  cookingStreak: number
  totalCooked: number
}

interface FandaziStore {
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

  // 派生数据
  getDishById: (id: string) => Dish | undefined
  getPantryMatchForDish: (dishId: string) => { have: number; missing: number; missingNames: string[] }
  getShoppingItemsForPlan: (planId: string) => ShoppingItem[]
}

// ─────────────────────────────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

// Demo 冰箱初始数据
const DEMO_PANTRY: PantryItem[] = [
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
      pantry: DEMO_PANTRY,
      addPantryItem: (item) => set((s) => ({ pantry: [...s.pantry, item] })),
      removePantryItem: (id) => set((s) => ({ pantry: s.pantry.filter((p) => p.id !== id) })),
      updatePantryItem: (id, patch) =>
        set((s) => ({
          pantry: s.pantry.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      // === 计划 ===
      mealPlans: [],
      addMealPlan: (dishId, date) =>
        set((s) => ({
          mealPlans: [
            ...s.mealPlans,
            {
              id: uid(),
              dishId,
              status: 'planned' as PlanStatus,
              planDate: date,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        })),
      updatePlanStatus: (planId, status) =>
        set((s) => ({
          mealPlans: s.mealPlans.map((p) =>
            p.id === planId ? { ...p, status, updatedAt: new Date().toISOString() } : p,
          ),
        })),
      removeMealPlan: (planId) =>
        set((s) => ({ mealPlans: s.mealPlans.filter((p) => p.id !== planId) })),

      // === 购物清单 ===
      shoppingList: [],
      addShoppingItem: (item) => set((s) => ({ shoppingList: [...s.shoppingList, item] })),
      toggleShoppingItem: (id) =>
        set((s) => ({
          shoppingList: s.shoppingList.map((i) =>
            i.id === id ? { ...i, checked: !i.checked } : i,
          ),
        })),
      removeShoppingItem: (id) =>
        set((s) => ({ shoppingList: s.shoppingList.filter((i) => i.id !== id) })),
      clearCheckedShoppingItems: () =>
        set((s) => ({ shoppingList: s.shoppingList.filter((i) => !i.checked) })),

      // === 做饭记录 ===
      cookingLogs: [],
      addCookingLog: (log) => set((s) => ({ cookingLogs: [log, ...s.cookingLogs] })),

      // === 我家版 ===
      myDishVersions: [],
      upsertMyDishVersion: (version) =>
        set((s) => {
          const idx = s.myDishVersions.findIndex((v) => v.dishId === version.dishId)
          if (idx >= 0) {
            const updated = [...s.myDishVersions]
            updated[idx] = { ...version, updatedAt: Date.now() }
            return { myDishVersions: updated }
          }
          return { myDishVersions: [...s.myDishVersions, version] }
        }),
      removeMyDishVersion: (dishId) =>
        set((s) => ({ myDishVersions: s.myDishVersions.filter((v) => v.dishId !== dishId) })),

      // === 饭团 ===
      fantuan: { mili: 128, level: 3, cookingStreak: 0, totalCooked: 0 },
      addMili: (amount) =>
        set((s) => ({
          fantuan: {
            ...s.fantuan,
            mili: s.fantuan.mili + amount,
            totalCooked: s.fantuan.totalCooked + (amount > 0 ? 1 : 0),
          },
        })),

      // === 派生 ===
      getDishById: (id) => DISHES.find((d) => d.id === id),

      getPantryMatchForDish: (dishId) => {
        const dish = DISHES.find((d) => d.id === dishId)
        if (!dish) return { have: 0, missing: 0, missingNames: [] }
        const pantry = get().pantry
        const pantryNames = new Set(pantry.map((p) => p.ingredientName))
        let have = 0
        const missingNames: string[] = []
        for (const ing of dish.ingredients) {
          if (pantryNames.has(ing.name)) {
            have++
          } else {
            missingNames.push(ing.name)
          }
        }
        return { have, missing: missingNames.length, missingNames }
      },

      getShoppingItemsForPlan: (planId) => {
        const plan = get().mealPlans.find((p) => p.id === planId)
        if (!plan) return []
        return get().shoppingList.filter((i) => i.source === get().getDishById(plan.dishId)?.name)
      },
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
