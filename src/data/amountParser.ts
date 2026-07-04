// ============================================================================
// amountParser — 解析菜谱 amount string ("300 克" → { value: 300, unit: "克" })
// ----------------------------------------------------------------------------
// 菜库 223 食材 / 496 条 amount,几乎全为 "N 克",仅 1 条 "适量"
// 用户库存可能输入 "2 个"、"1 根" 等非克单位
// ============================================================================

export interface ParsedAmount {
  value: number | null
  unit: string | null
  raw: string
}

/** 无法量化的文案 */
const VAGUE_AMOUNTS = new Set(['适量', '少许', '少量', '一些', '一点', '适量即可'])

/**
 * 解析 amount string → { value, unit }
 * "300 克" → { value: 300, unit: "克" }
 * "2 个"   → { value: 2, unit: "个" }
 * "适量"   → { value: null, unit: null }
 */
export function parseAmount(amountStr: string): ParsedAmount {
  const raw = (amountStr ?? '').trim()
  if (!raw || VAGUE_AMOUNTS.has(raw)) {
    return { value: null, unit: null, raw }
  }
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  if (!match) {
    return { value: null, unit: null, raw }
  }
  const value = parseFloat(match[1])
  const unit = match[2].trim() || null
  return { value, unit, raw }
}

/** 提取数值部分（无值返回 0，方便计算） */
export function extractAmountValue(amountStr: string): number {
  return parseAmount(amountStr).value ?? 0
}

/** 提取单位部分（无值返回 null） */
export function extractAmountUnit(amountStr: string): string | null {
  return parseAmount(amountStr).unit
}
