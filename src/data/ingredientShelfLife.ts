// ============================================================================
// ingredientShelfLife — P0-6 默认赏味期规则表 (主档 §11.3, L499-527)
// ----------------------------------------------------------------------------
// 15 条规则,按食材名 pattern 匹配
// 存储位置(room/fridge/freezer)影响赏味期天数
// 验收标准:添加青菜时,系统能自动设置大约 5 天的最佳赏味期
// ============================================================================

import type { PantryStorage } from '../types'

export interface ShelfLifeRule {
  /** 匹配食材名的正则 */
  pattern: RegExp
  /** 规则标签(展示用) */
  label: string
  /** 常温天数 */
  roomDays: number
  /** 冷藏天数 */
  fridgeDays: number
  /** 冷冻天数(0 = 不适合冷冻) */
  freezerDays: number
  /** 提醒优先级 */
  priority: 'high' | 'medium' | 'low'
}

/**
 * 默认赏味期规则表 — 主档 §11.3
 * 顺序:从具体到通用,第一个匹配的规则生效
 */
export const SHELF_LIFE_RULES: ShelfLifeRule[] = [
  // ---- 绿叶菜 3-5 天 ----
  {
    pattern: /^(小青菜|上海青|菠菜|生菜|生菜叶|小白菜|油菜|空心菜|荠菜|韭菜|蒜苗|芹菜|芦笋|白菜|大白菜|娃娃菜|包菜|雪菜|酸菜|酸豆角)$/,
    label: '绿叶菜',
    roomDays: 2,
    fridgeDays: 5,
    freezerDays: 0,
    priority: 'high',
  },
  // ---- 香菜/葱 2-4 天 ----
  {
    pattern: /^(香菜|葱|大葱|葱花|小葱)$/,
    label: '香菜/葱',
    roomDays: 1,
    fridgeDays: 4,
    freezerDays: 30,
    priority: 'high',
  },
  // ---- 菌菇 3-5 天 ----
  {
    pattern: /^(香菇|冬菇|口蘑|杏鲍菇|金针菇|鸡腿菇|茶树菇|榛蘑|木耳|黑木耳|银耳)$/,
    label: '菌菇',
    roomDays: 2,
    fridgeDays: 5,
    freezerDays: 0,
    priority: 'medium',
  },
  // ---- 番茄 4-7 天 ----
  {
    pattern: /^(番茄|圣女果)$/,
    label: '番茄',
    roomDays: 3,
    fridgeDays: 7,
    freezerDays: 0,
    priority: 'medium',
  },
  // ---- 黄瓜/丝瓜 3-5 天 ----
  {
    pattern: /^(黄瓜|丝瓜|冬瓜|南瓜)$/,
    label: '黄瓜/瓜类',
    roomDays: 2,
    fridgeDays: 5,
    freezerDays: 0,
    priority: 'medium',
  },
  // ---- 西兰花/花菜 4-6 天 ----
  {
    pattern: /^(西兰花|花菜)$/,
    label: '西兰花/花菜',
    roomDays: 2,
    fridgeDays: 6,
    freezerDays: 0,
    priority: 'medium',
  },
  // ---- 鲜肉冷藏 1-2 天 / 冷冻 14-30 天 ----
  {
    pattern: /^(五花肉|里脊|瘦猪肉|猪肉末|排骨|猪蹄|猪肘|猪大肠|猪前腿肉|梅花肉|腊肉|咸肉|火腿|牛肉|瘦牛肉|瘦牛肉末|偏瘦牛腩|卤牛肉|牛肚|牛舌|羊肉|猪肠衣)$/,
    label: '鲜肉',
    roomDays: 0,
    fridgeDays: 2,
    freezerDays: 30,
    priority: 'high',
  },
  // ---- 虾仁/海鲜冷藏 1 天 / 冷冻 14-30 天 ----
  {
    pattern: /^(虾仁|大虾|河虾|三文鱼|鲈鱼|草鱼|鲤鱼|青鱼|黑鱼片|鳝鱼|花鲢鱼头|甲鱼|海蛎|海蜇|海参|即食海参|鱼丸)$/,
    label: '海鲜',
    roomDays: 0,
    fridgeDays: 1,
    freezerDays: 30,
    priority: 'high',
  },
  // ---- 禽肉 ----
  {
    pattern: /^(鸡胸肉|鸡腿|鸡腿肉|去皮鸡腿肉|鸡翅|鸡心|鸡胗|童子鸡|乌鸡|鸭腿|鸽子|鸭血)$/,
    label: '禽肉',
    roomDays: 0,
    fridgeDays: 2,
    freezerDays: 30,
    priority: 'high',
  },
  // ---- 鸡蛋 14-30 天 ----
  {
    pattern: /^(鸡蛋|鸡蛋清|蛋|皮蛋|咸蛋黄|咸鸭蛋|鹌鹑蛋)$/,
    label: '鸡蛋',
    roomDays: 7,
    fridgeDays: 30,
    freezerDays: 0,
    priority: 'low',
  },
  // ---- 豆腐 1-3 天 ----
  {
    pattern: /^(豆腐|嫩豆腐|北豆腐|毛豆腐|血豆腐)$/,
    label: '豆腐',
    roomDays: 1,
    fridgeDays: 3,
    freezerDays: 0,
    priority: 'high',
  },
  // ---- 豆制品(干类) ----
  {
    pattern: /^(豆腐干|豆腐皮|油面筋|腐竹)$/,
    label: '豆制品',
    roomDays: 3,
    fridgeDays: 7,
    freezerDays: 0,
    priority: 'medium',
  },
  // ---- 熟食/剩菜 1-2 天 ----
  {
    pattern: /^(午餐肉)$/,
    label: '熟食/剩菜',
    roomDays: 1,
    fridgeDays: 2,
    freezerDays: 0,
    priority: 'high',
  },
  // ---- 根茎类 7-14 天 ----
  {
    pattern: /^(土豆|白萝卜|胡萝卜|芋头|莲藕|藕片|冬笋|春笋|笋片|笋干|辣萝卜|红薯|玉米)$/,
    label: '根茎类',
    roomDays: 7,
    fridgeDays: 14,
    freezerDays: 0,
    priority: 'low',
  },
  // ---- 调料/干货 长期,低提醒优先级 ----
  {
    pattern: /^(生抽|老抽|醋|香醋|料酒|黄酒|白酒|蚝油|豆瓣酱|豆豉|甜面酱|番茄酱|沙茶酱|辣椒油|辣椒粉|辣椒酱|剁椒|泡椒|小米辣|干辣椒|食用油|橄榄油|香油|芝麻油|芝麻酱|蜂蜜|淀粉|五香粉|白胡椒|黑胡椒|花椒粉|沙姜粉|蒜粉|八角|桂皮|香叶|花椒|白芝麻|芝麻|姜|姜末|蒜|蒜末|柠檬汁|桂花|代糖|酵母|水|温水|可乐|粗盐|蒸鱼豉油|盐|糖|面粉|糯米粉|粘米粉|澄粉|黄豆粉|米粉|河粉|凉皮|粉丝|粉条|面条|荞麦面|云吞皮|白米饭|糙米饭|小米|糯米|薏米|藜麦|红枣|枸杞|花生米|红豆|黄豆|黄花菜|海带|海带结|紫菜|虾皮|龙井茶叶|咸鱼)$/,
    label: '调料/干货',
    roomDays: 180,
    fridgeDays: 365,
    freezerDays: 365,
    priority: 'low',
  },
]

/**
 * 根据食材名和存储位置获取默认赏味期天数。
 * @returns 天数;无法匹配时返回 fridge 7 天作为保守默认
 */
export function getShelfLifeDays(
  ingredientName: string,
  storage: PantryStorage,
): number {
  for (const rule of SHELF_LIFE_RULES) {
    if (rule.pattern.test(ingredientName)) {
      switch (storage) {
        case 'room':
          return rule.roomDays || rule.fridgeDays
        case 'fridge':
          return rule.fridgeDays
        case 'freezer':
          return rule.freezerDays || rule.fridgeDays
      }
    }
  }
  // 保守默认:冷藏 7 天
  return 7
}

/**
 * 根据食材名和存储位置获取规则(展示用)。
 * @returns 匹配的规则;无匹配返回 null
 */
export function getShelfLifeRule(
  ingredientName: string,
): ShelfLifeRule | null {
  for (const rule of SHELF_LIFE_RULES) {
    if (rule.pattern.test(ingredientName)) return rule
  }
  return null
}

/**
 * 根据购买日期和赏味期天数,计算最佳赏味日期(ISO string)。
 */
export function calcBestBeforeAt(
  boughtAt: string,
  ingredientName: string,
  storage: PantryStorage,
): string {
  const days = getShelfLifeDays(ingredientName, storage)
  const bought = new Date(boughtAt)
  bought.setDate(bought.getDate() + days)
  return bought.toISOString()
}
