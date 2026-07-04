/**
 * 米粒积分 + 饭搭子副本 + 饭团宠物（v1.7.1 MVP）
 *
 * 本模块是数据层 + 工具函数，不带 UI。
 * 落地：未来由 QuestBoard / MiliBadge / Fantuanzi 组件调用。
 *
 * 数据模型：
 * - `localStorage['fandazi.mili']` = JSON.stringify({ balance, history, lastCheckinAt })
 * - `localStorage['fandazi.quests']` = JSON.stringify({ completed: string[], claimedAt: Record<id, timestamp> })
 * - `localStorage['fandazi.fantuanzi']` = JSON.stringify({ owned: Fantuanzi[], active: id | null })
 *
 * 设计原则（v1.7.1）：
 * - 离线优先：纯 localStorage，不依赖后端
 * - 静默降级：try/catch 包所有读写，失败不抛错
 * - 调研依据：副本数 / 米粒定价 / 抽卡保底 详见 ../docs/任务记录/v1.7_米粒积分与饭搭子副本.md
 */

// ============================================================
// 1. 米粒定价 + 行为映射
// ============================================================

/** 用户行为 → 米粒数 */
export const MILI_REWARDS = {
  READ_RECIPE: 5,           // 读完 1 道菜谱（停留 ≥ 30s）
  MARK_COOKED: 10,          // 标记 1 道"做过"
  WRITE_FLAVOR: 30,         // 写 1 条原创口味描述
  INVITE_COMPANION: 50,     // 拉 1 个搭子
  COMPLETE_TABLE: 15,       // 完成 1 次餐桌计划
  MEAL_CHECKIN: 3,          // 餐后打卡（1 餐）
  FLOP_SHARE: 15,           // 翻车分享（带文字）
  WATCH_FREE_LESSON: 10,    // 看完 1 节免费分享课
  COMPLETE_QUEST: 50,       // 完成 1 个副本
  LEVEL_UP: 500,            // 升级 1 次等级
  STREAK_7DAYS: 100,        // 连续 7 天活跃
  COMPANION_LEVELUP: 200,   // 你的搭子也升级了
  DAILY_CHECKIN: 10,        // 每日签到
} as const

/** 米粒消耗（v1.7.1 只展示定价，不实现扣减逻辑——抽卡是 v1.7.2） */
export const MILI_COSTS = {
  GACHA_SINGLE: 100,
  GACHA_TEN: 1000,
  GACHA_UR_SINGLE: 200,
  FANTUANZI_BOOST: 200,
  FANTUANZI_SKIN: 500,
  COURSE_DEEP: 800,
  COURSE_PREMIUM: 1500,
  COURSE_MASTER: 3000,
} as const

export type MiliRewardKey = keyof typeof MILI_REWARDS

// ============================================================
// 2. 米粒存储 + 工具
// ============================================================

const MILI_STORAGE_KEY = 'fandazi.mili'

export type MiliState = {
  balance: number
  history: MiliEvent[]
  lastCheckinAt: string | null  // ISO date string
}

export type MiliEvent = {
  at: number  // timestamp
  reason: MiliRewardKey | string  // 行为 key 或自定义文案
  amount: number  // 正为获取，负为消耗
  note?: string
}

export function readMili(): MiliState {
  try {
    const raw = window.localStorage.getItem(MILI_STORAGE_KEY)
    if (!raw) return { balance: 0, history: [], lastCheckinAt: null }
    const parsed = JSON.parse(raw)
    return {
      balance: typeof parsed.balance === 'number' ? parsed.balance : 0,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      lastCheckinAt: typeof parsed.lastCheckinAt === 'string' ? parsed.lastCheckinAt : null,
    }
  } catch {
    return { balance: 0, history: [], lastCheckinAt: null }
  }
}

export function writeMili(state: MiliState): void {
  try {
    window.localStorage.setItem(MILI_STORAGE_KEY, JSON.stringify(state))
    // v1.7.1 同标签页通知：localStorage 的原生 storage 事件只跨标签页触发，
    // 同标签页内的 React 组件需要靠这个自定义事件刷新（例如顶栏 MiliBadge）
    window.dispatchEvent(new CustomEvent('fandazi:mili-changed'))
  } catch {
    // 静默降级
  }
}

/** 给用户加米粒（默认正数） */
export function earnMili(reason: MiliRewardKey, amount: number = MILI_REWARDS[reason], note?: string): number {
  const state = readMili()
  state.balance += amount
  state.history.unshift({ at: Date.now(), reason, amount, note })
  // 只保留最近 100 条历史
  state.history = state.history.slice(0, 100)
  writeMili(state)
  return state.balance
}

/** 消耗米粒（扣减），返回是否成功 */
export function spendMili(costKey: keyof typeof MILI_COSTS, reason: string): { ok: boolean; balance: number } {
  const state = readMili()
  const cost = MILI_COSTS[costKey]
  if (state.balance < cost) return { ok: false, balance: state.balance }
  state.balance -= cost
  state.history.unshift({ at: Date.now(), reason, amount: -cost })
  state.history = state.history.slice(0, 100)
  writeMili(state)
  return { ok: true, balance: state.balance }
}

// ============================================================
// 2.5 一次性奖励去重（防止 toggle 反复刷分）
// ============================================================

/**
 * 同一行为 + 同一目标 id 只奖励 1 次（持久化在 localStorage）
 * 例：MARK_COOKED + dishId xxx → 一辈子只 +10 一次
 *
 * @returns 是否首次（true = 这次发了奖；false = 已奖励过，跳过）
 */
export function earnOnce(reason: MiliRewardKey, targetId: string, note?: string): boolean {
  const storageKey = `fandazi.miliEarned.${reason}`
  let earned: string[] = []
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) earned = parsed.filter((x): x is string => typeof x === 'string')
    }
  } catch {
    // ignore
  }
  if (earned.includes(targetId)) return false
  earned.push(targetId)
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(earned))
  } catch {
    // 静默降级
  }
  earnMili(reason, MILI_REWARDS[reason], note ?? targetId)
  return true
}

/** 每日签到（同一天不重复） */
export function dailyCheckin(): { ok: boolean; earned: number } {
  const state = readMili()
  const today = new Date().toISOString().slice(0, 10)
  if (state.lastCheckinAt === today) return { ok: false, earned: 0 }
  state.lastCheckinAt = today
  state.balance += MILI_REWARDS.DAILY_CHECKIN
  state.history.unshift({ at: Date.now(), reason: 'DAILY_CHECKIN', amount: MILI_REWARDS.DAILY_CHECKIN })
  state.history = state.history.slice(0, 100)
  writeMili(state)
  return { ok: true, earned: MILI_REWARDS.DAILY_CHECKIN }
}

// ============================================================
// 3. 副本系统（15 个）
// ============================================================

export type QuestLevel = 'bronze' | 'silver' | 'gold' | 'diamond'

export type Quest = {
  id: string
  level: QuestLevel
  title: string
  emoji: string
  /** 完成判定函数需要的参数类型 */
  checkType: 'recipe_read_count' | 'dish_cooked_count' | 'companion_invited' | 'table_completed' | 'meal_checkin_count'
  /** 触发阈值 */
  threshold: number
  /** 奖励米粒 */
  reward: number
  /** 简短描述 */
  desc: string
}

export const QUESTS: Quest[] = [
  // 青铜：5 个
  { id: 'q-b1', level: 'bronze', title: '读完 5 道菜谱', emoji: '📖', checkType: 'recipe_read_count', threshold: 5, reward: 50, desc: '停留 ≥ 30s 算读完' },
  { id: 'q-b2', level: 'bronze', title: '标记 3 道"做过"', emoji: '🍳', checkType: 'dish_cooked_count', threshold: 3, reward: 50, desc: '亲手做过才算' },
  { id: 'q-b3', level: 'bronze', title: '拉 1 个搭子', emoji: '🤝', checkType: 'companion_invited', threshold: 1, reward: 50, desc: '朋友 / 家人 / 宠物 / 网络搭子 都算' },
  { id: 'q-b4', level: 'bronze', title: '完成 1 次餐桌计划', emoji: '🍽️', checkType: 'table_completed', threshold: 1, reward: 50, desc: '凑够 3 道菜 + 选餐次' },
  { id: 'q-b5', level: 'bronze', title: '餐后打卡 3 餐', emoji: '✅', checkType: 'meal_checkin_count', threshold: 3, reward: 50, desc: '早 / 午 / 晚 各算 1 餐' },

  // 白银：5 个
  { id: 'q-s1', level: 'silver', title: '跟搭子共餐 5 次', emoji: '🍽️', checkType: 'table_completed', threshold: 5, reward: 80, desc: '双方各加 ≥ 1 道' },
  { id: 'q-s2', level: 'silver', title: '餐桌营养达标 3 次', emoji: '📊', checkType: 'table_completed', threshold: 3, reward: 80, desc: '一桌热量 / 钠 / 蔬达标' },
  { id: 'q-s3', level: 'silver', title: '翻车分享给搭子', emoji: '💥', checkType: 'meal_checkin_count', threshold: 5, reward: 80, desc: '餐后标翻车 + 写吐槽' },
  { id: 'q-s4', level: 'silver', title: '尝试 1 道宠物共餐食谱', emoji: '🐾', checkType: 'companion_invited', threshold: 1, reward: 80, desc: '收藏 + 反馈' },
  { id: 'q-s5', level: 'silver', title: '看完 1 节免费分享课', emoji: '🎓', checkType: 'meal_checkin_count', threshold: 1, reward: 80, desc: '视频播放 ≥ 80%' },

  // 黄金：3 个
  { id: 'q-g1', level: 'gold', title: '拉第 3 个饭搭子', emoji: '🪜', checkType: 'companion_invited', threshold: 3, reward: 150, desc: '你的搭子 B 注册成功' },
  { id: 'q-g2', level: 'gold', title: '写 10 道原创口味描述', emoji: '✍️', checkType: 'dish_cooked_count', threshold: 10, reward: 150, desc: '填 ≥ 10 道' },
  { id: 'q-g3', level: 'gold', title: '发起 1 次搭子投票', emoji: '🗳️', checkType: 'table_completed', threshold: 1, reward: 150, desc: '"今晚吃什么" 三选一' },

  // 钻石：2 个
  { id: 'q-d1', level: 'diamond', title: '饭搭子社群 ≥ 10 人', emoji: '👑', checkType: 'companion_invited', threshold: 10, reward: 300, desc: '自动统计' },
  { id: 'q-d2', level: 'diamond', title: '连续 30 天活跃', emoji: '⏳', checkType: 'meal_checkin_count', threshold: 30, reward: 300, desc: '每天打开 × 30' },
]

const QUEST_STORAGE_KEY = 'fandazi.quests'

export type QuestState = {
  completed: string[]  // 已完成副本 id
  claimedAt: Record<string, number>  // 副本 id → 完成时间戳
}

export function readQuests(): QuestState {
  try {
    const raw = window.localStorage.getItem(QUEST_STORAGE_KEY)
    if (!raw) return { completed: [], claimedAt: {} }
    const parsed = JSON.parse(raw)
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      claimedAt: parsed.claimedAt && typeof parsed.claimedAt === 'object' ? parsed.claimedAt : {},
    }
  } catch {
    return { completed: [], claimedAt: {} }
  }
}

export function writeQuests(state: QuestState): void {
  try {
    window.localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 静默降级
  }
}

export function completeQuest(questId: string): QuestState {
  const state = readQuests()
  if (state.completed.includes(questId)) return state
  state.completed.push(questId)
  state.claimedAt[questId] = Date.now()
  writeQuests(state)
  // 触发米粒奖励
  const quest = QUESTS.find(q => q.id === questId)
  if (quest) {
    earnMili('COMPLETE_QUEST', quest.reward, `完成副本: ${quest.title}`)
  }
  return state
}

export function getQuestProgress(): Record<QuestLevel, { done: number; total: number }> {
  const state = readQuests()
  const result: Record<QuestLevel, { done: number; total: number }> = {
    bronze: { done: 0, total: 0 },
    silver: { done: 0, total: 0 },
    gold: { done: 0, total: 0 },
    diamond: { done: 0, total: 0 },
  }
  for (const q of QUESTS) {
    result[q.level].total++
    if (state.completed.includes(q.id)) result[q.level].done++
  }
  return result
}

/** 当前等级（每级做完 80% 升级） */
export function getCurrentLevel(): QuestLevel {
  const progress = getQuestProgress()
  if (progress.bronze.done < Math.ceil(progress.bronze.total * 0.8)) return 'bronze'
  if (progress.silver.done < Math.ceil(progress.silver.total * 0.8)) return 'silver'
  if (progress.gold.done < Math.ceil(progress.gold.total * 0.67)) return 'gold'
  return 'diamond'
}

// ============================================================
// 4. 饭团宠物（基础数据 + 升级规则）
// ============================================================

export type FantuanziRarity = 'N' | 'R' | 'SR' | 'SSR' | 'UR'

export type Fantuanzi = {
  id: string
  rarity: FantuanziRarity
  name: string
  ingredient: string  // 食材 / 主题
  emoji: string  // 临时 emoji 占位
  flavor: string  // 一句话描述
}

export const FANTUANZI_CATALOG: Fantuanzi[] = [
  // N 级：基础白饭团
  { id: 'ft-n-1', rarity: 'N', name: '白饭团', ingredient: '米', emoji: '🍙', flavor: '最纯粹的饭团本团' },
  { id: 'ft-n-2', rarity: 'N', name: '小饭团', ingredient: '米', emoji: '🍙', flavor: '迷你版，更可爱' },
  { id: 'ft-n-3', rarity: 'N', name: '胖饭团', ingredient: '米', emoji: '🍙', flavor: '饭多馅少的朴实派' },
  { id: 'ft-n-4', rarity: 'N', name: '瘦饭团', ingredient: '米', emoji: '🍙', flavor: '精致小巧' },
  { id: 'ft-n-5', rarity: 'N', name: '圆饭团', ingredient: '米', emoji: '🍙', flavor: '圆形传统款' },

  // R 级：基础食材组合（8 种）
  { id: 'ft-r-1', rarity: 'R', name: '紫菜饭团', ingredient: '紫菜', emoji: '🍙', flavor: '经典基础款' },
  { id: 'ft-r-2', rarity: 'R', name: '鲑鱼饭团', ingredient: '鲑鱼', emoji: '🍙', flavor: '粉橙鱼肉点缀' },
  { id: 'ft-r-3', rarity: 'R', name: '梅子饭团', ingredient: '梅子', emoji: '🍙', flavor: '酸甜开胃' },
  { id: 'ft-r-4', rarity: 'R', name: '昆布饭团', ingredient: '昆布', emoji: '🍙', flavor: '日式传统味' },
  { id: 'ft-r-5', rarity: 'R', name: '明太子饭团', ingredient: '明太子', emoji: '🍙', flavor: '微辣海味' },
  { id: 'ft-r-6', rarity: 'R', name: '鲣鱼饭团', ingredient: '鲣鱼', emoji: '🍙', flavor: '烟熏香气' },
  { id: 'ft-r-7', rarity: 'R', name: '金枪鱼饭团', ingredient: '金枪鱼', emoji: '🍙', flavor: '红肉鲜美' },
  { id: 'ft-r-8', rarity: 'R', name: '梅干饭团', ingredient: '梅干', emoji: '🍙', flavor: '酸味升级' },

  // SR 级：中档食材（10 种）
  { id: 'ft-sr-1', rarity: 'SR', name: '鸡肉饭团', ingredient: '烤鸡肉', emoji: '🍙', flavor: '暖金黄色鸡肉块' },
  { id: 'ft-sr-2', rarity: 'SR', name: '金枪鱼饭团', ingredient: '金枪鱼', emoji: '🍙', flavor: '红肉中档款' },
  { id: 'ft-sr-3', rarity: 'SR', name: '烤鳕鱼饭团', ingredient: '鳕鱼', emoji: '🍙', flavor: '白肉鲜嫩' },
  { id: 'ft-sr-4', rarity: 'SR', name: '烤三文鱼饭团', ingredient: '三文鱼', emoji: '🍙', flavor: '橙红鱼肉' },
  { id: 'ft-sr-5', rarity: 'SR', name: '炸虾饭团', ingredient: '炸虾', emoji: '🍙', flavor: '酥脆海味' },
  { id: 'ft-sr-6', rarity: 'SR', name: '牛肉饭团', ingredient: '牛肉', emoji: '🍙', flavor: '浓郁肉香' },
  { id: 'ft-sr-7', rarity: 'SR', name: '叉烧饭团', ingredient: '叉烧', emoji: '🍙', flavor: '蜜汁微甜' },
  { id: 'ft-sr-8', rarity: 'SR', name: '章鱼饭团', ingredient: '章鱼', emoji: '🍙', flavor: '海味弹牙' },
  { id: 'ft-sr-9', rarity: 'SR', name: '烤鸭饭团', ingredient: '烤鸭', emoji: '🍙', flavor: '烟熏鸭香' },
  { id: 'ft-sr-10', rarity: 'SR', name: '温泉蛋饭团', ingredient: '温泉蛋', emoji: '🍙', flavor: '蛋黄流心' },

  // SSR 级：高档食材（6 种）
  { id: 'ft-ssr-1', rarity: 'SSR', name: '鳗鱼饭团', ingredient: '鳗鱼', emoji: '🍙', flavor: '焦糖色烤鳗鱼' },
  { id: 'ft-ssr-2', rarity: 'SSR', name: '和牛饭团', ingredient: '和牛', emoji: '🍙', flavor: '粉嫩雪花纹理' },
  { id: 'ft-ssr-3', rarity: 'SSR', name: '鱼子酱饭团', ingredient: '鱼子酱', emoji: '🍙', flavor: '黑色颗粒奢华' },
  { id: 'ft-ssr-4', rarity: 'SSR', name: '松露饭团', ingredient: '松露', emoji: '🍙', flavor: '稀有菌香' },
  { id: 'ft-ssr-5', rarity: 'SSR', name: '鹅肝饭团', ingredient: '鹅肝', emoji: '🍙', flavor: '法式奢华' },
  { id: 'ft-ssr-6', rarity: 'SSR', name: '龙虾饭团', ingredient: '龙虾', emoji: '🍙', flavor: '海鲜之王' },

  // UR 级：限定主题（P2 实现）
  { id: 'ft-ur-1', rarity: 'UR', name: '中秋限定饭团', ingredient: '月饼馅', emoji: '🌕', flavor: '节日限定' },
  { id: 'ft-ur-2', rarity: 'UR', name: '春节限定饭团', ingredient: '年糕', emoji: '🧧', flavor: '红金喜庆' },
]

const FANTUANZI_STORAGE_KEY = 'fandazi.fantuanzi'

export type FantuanziState = {
  owned: string[]  // 已拥有的饭团 id
  active: string | null  // 当前展示的饭团 id
}

export function readFantuanzi(): FantuanziState {
  try {
    const raw = window.localStorage.getItem(FANTUANZI_STORAGE_KEY)
    if (!raw) return { owned: [], active: null }
    const parsed = JSON.parse(raw)
    return {
      owned: Array.isArray(parsed.owned) ? parsed.owned : [],
      active: typeof parsed.active === 'string' ? parsed.active : null,
    }
  } catch {
    return { owned: [], active: null }
  }
}

export function writeFantuanzi(state: FantuanziState): void {
  try {
    window.localStorage.setItem(FANTUANZI_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 静默降级
  }
}

/** 单抽：随机返回一只饭团（按概率） */
export function gachaSingle(): Fantuanzi {
  const roll = Math.random() * 100
  let rarity: FantuanziRarity
  if (roll < 1) rarity = 'UR'      // 1%
  else if (roll < 6) rarity = 'SSR' // 5%
  else if (roll < 26) rarity = 'SR' // 20%
  else if (roll < 61) rarity = 'R'  // 35%
  else rarity = 'N'                // 39%
  const pool = FANTUANZI_CATALOG.filter(f => f.rarity === rarity)
  return pool[Math.floor(Math.random() * pool.length)]
}

/** 10 连抽：保底 1 R+ */
export function gachaTen(): Fantuanzi[] {
  const result: Fantuanzi[] = []
  for (let i = 0; i < 10; i++) result.push(gachaSingle())
  // 保底：10 抽必出 R+
  if (!result.some(f => f.rarity !== 'N')) {
    const rPool = FANTUANZI_CATALOG.filter(f => f.rarity === 'R')
    result[Math.floor(Math.random() * 10)] = rPool[Math.floor(Math.random() * rPool.length)]
  }
  return result
}

/** 抽到后写入"已拥有" */
export function addOwnedFantuanzi(ft: Fantuanzi): FantuanziState {
  const state = readFantuanzi()
  if (!state.owned.includes(ft.id)) state.owned.push(ft.id)
  if (!state.active) state.active = ft.id
  writeFantuanzi(state)
  return state
}

export function setActiveFantuanzi(id: string): void {
  const state = readFantuanzi()
  if (state.owned.includes(id)) {
    state.active = id
    writeFantuanzi(state)
  }
}
