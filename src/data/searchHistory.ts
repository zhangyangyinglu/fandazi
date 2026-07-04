// v1.9 真实搜索历史 — localStorage 持久化
// 用于桌面端「大家在搜」从 mock 升级到真实历史
// - 写入:菜单页 search-box onChange(debounce 600ms,>= 2 字)
// - 读取:桌面首屏 POPULAR KEYWORDS(最近 6 条去重,不足用 fallback 填充)

const STORAGE_KEY = 'fandazi.searchHistory'
const MAX_HISTORY = 20

export const FALLBACK_KEYWORDS = [
  '夏日凉菜', '10 分钟快手', '控糖晚餐',
  '单人份', '便当', '不开火',
] as const

export function readSearchHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function pushSearchHistory(query: string): void {
  const trimmed = query.trim()
  if (trimmed.length < 2) return
  if (trimmed.length > 30) return
  try {
    const history = readSearchHistory()
    // 去重,新值放到最前
    const filtered = history.filter((kw) => kw !== trimmed)
    filtered.unshift(trimmed)
    const next = filtered.slice(0, MAX_HISTORY)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('fandazi:search-history-changed'))
  } catch {
    // localStorage 不可用,静默失败
  }
}

// 给桌面首屏:取最近 N 条,不足用 fallback 补
export function getPopularKeywords(n: number = 6): string[] {
  const history = readSearchHistory()
  const seen = new Set<string>()
  const result: string[] = []
  for (const kw of history) {
    if (!seen.has(kw)) {
      seen.add(kw)
      result.push(kw)
      if (result.length >= n) return result
    }
  }
  for (const kw of FALLBACK_KEYWORDS) {
    if (!seen.has(kw)) {
      seen.add(kw)
      result.push(kw)
      if (result.length >= n) return result
    }
  }
  return result
}
