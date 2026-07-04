export type IngredientGroup = '蔬菜' | '肉蛋' | '主食' | '调味' | '干货'

// 菜品分类 — 7 个枚举, 涵盖家常菜主要类型
// (荤菜 / 素菜 / 汤羹 / 主食 / 早餐 / 凉菜 / 甜品)
export type DishCategory =
  | '荤菜'
  | '素菜'
  | '汤羹'
  | '主食'
  | '早餐'
  | '凉菜'
  | '甜品'

export type Ingredient = {
  name: string
  amount: string
  group: IngredientGroup
}

// 餐次场景标签 —— 一道菜可对应多个餐次。
// 设计原则(Q1=A,2026-06-25 拍板):
// - 字段层完整存在 → 后端推荐排序按时段隐式加权
// - UI 层不做强制餐次入口 → 仅在菜单页 / 搜索做可选 filter chip
// - 时段映射:6-10 早餐 / 10-15 午餐 / 15-21 晚餐 / bento 在午前看见
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'bento' | 'snack'

export type Dish = {
  id: string
  name: string
  category: DishCategory
  tags: string[]
  /** v1.11 餐次标签(可选,未填则视为 lunch+dinner) */
  mealType?: MealType[]
  intro: string
  /** v1.8 风味/口感一句话描述（可选，详情页渲染；未填写时不显示） */
  flavorDescription?: string
  cookMethod: string
  cookTime: string
  color: string
  image?: string
  ingredients: Ingredient[]
  steps: string[]
}

// 用户定制菜谱：在基础菜之上派生"我的口味版"
// 例如「番茄炒蛋（加糖版）」是对基础菜「番茄炒蛋」的覆盖层
// 同菜可多人多版本：番茄炒蛋（加糖版）、番茄炒蛋（加盐版）共存
export type CustomizationModification = {
  // 食材调整：name → 新 amount；删除食材 amount 设为空字符串
  ingredientAdjustments?: Record<string, string>
  // 步骤覆盖：不传则继承基础菜的步骤
  steps?: string[]
  // 用户备注：解释为什么这么调
  notes?: string
}

export type Customization = {
  id: string
  baseDishId: string
  ownerId: string
  variantName: string
  modification: CustomizationModification
  createdAt: number
  updatedAt: number
}

// 同一基础菜可被多个用户覆盖多次，所有覆盖都挂在 baseDishId 上
export const CUSTOMIZATIONS_STORAGE_KEY = 'fandazi.customizations'

// ============================================================================
// v1.11 P0-4 我家版本(单数 my,2026-06-25 拍板替代旧 Customization 多版本设计)
// ----------------------------------------------------------------------------
// Q3 决策:我家版 = 我做过 → 每道菜最多 1 个我家版
// Q1=A:Tab 切换(详情页 标准/我家版 两 tab)
// Q2:可编辑 4 字段(ingredients/steps/cookTime/myNote),余继承标准
// Q4:主入口在做完弹窗内,辅入口在详情页(已有 mealLog 才出现)
// Q5:重置仅编辑模式可见 + 二次确认
// ============================================================================
export type MyDishVersion = {
  /** 关联标准菜谱 id */
  dishId: string
  /** 覆盖食材清单(完整数组,允许新增/删除/改 amount) */
  ingredients: Ingredient[]
  /** 覆盖步骤(完整数组) */
  steps: string[]
  /** 覆盖烹饪时长(如 "70 分钟") */
  cookTime: string
  /** 我家备注 — 灵魂字段(120 字内) */
  myNote: string
  /** 首次创建时间 */
  createdAt: number
  /** 最后修改时间 */
  updatedAt: number
}

export const MY_DISH_VERSIONS_STORAGE_KEY = 'fandazi.myDishVersions.v1'

// ============================================================================
// v1.11 P0-5/6/7 库存三件套 (2026-06-26)
// ----------------------------------------------------------------------------
// 主档 §10.3 PantryItem 接口 (L445-458)
// 存储:PantryItem[] — localStorage key = fandazi.pantry.v2
// 旧 string[] (fandazi.pantry) 自动迁移
// category 用 IngredientGroup (Q1=可以, 用户拍板)
// ============================================================================

export type PantryStorage = 'room' | 'fridge' | 'freezer'
export type PantryStatus = 'fresh' | 'use_soon' | 'past_best' | 'check_before_use'
export type PantrySource = 'shopping_list' | 'manual_add' | 'leftover' | 'custom'

export interface PantryItem {
  id: string
  ingredientName: string
  category: IngredientGroup
  quantity: number
  unit: string
  storage: PantryStorage
  boughtAt: string
  bestBeforeAt: string
  plannedDishIds?: string[]
  source: PantrySource
  status: PantryStatus
  note?: string
}

export const PANTRY_STORAGE_KEY = 'fandazi.pantry.v2'
export const PANTRY_CHANGE_EVENT = 'fandazi:pantry-change'
/** 旧 key(纯 string[] 食材名列表)— 用于自动迁移 */
export const PANTRY_LEGACY_KEY = 'fandazi.pantry'

// ============================================================================
// P1-2: 计划状态 MealPlan (6 档)
// 存储:MealPlan[] — localStorage key = fandazi.mealPlans.v1
// ============================================================================

export type PlanStatus = 'planned' | 'shopping_done' | 'cooking' | 'done' | 'skipped' | 'favorited'

export interface MealPlan {
  id: string
  dishId: string
  status: PlanStatus
  /** YYYY-MM-DD — 哪天的计划 */
  planDate: string
  createdAt: string
  updatedAt: string
}

export const MEAL_PLAN_STORAGE_KEY = 'fandazi.mealPlans.v1'
export const MEAL_PLAN_CHANGE_EVENT = 'fandazi:meal-plan-change'
