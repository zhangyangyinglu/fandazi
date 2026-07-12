/**
 * 健康事实存储层
 *
 * 用户和饭团聊天时随口说的健康信息（过敏、忌口、慢性病、饮食目标等），
 * 饭团 AI 自动提取并存到这里。积累多了在健康页能看到完整档案。
 *
 * 设计原则：
 * - 轻量：每条事实就是一个 label + category，不需要填问卷
 * - 可累积：同一类别可多条，新的不覆盖旧的，除非用户明确说"改了"
 * - 可删除：用户可以在健康页删掉某条
 * - 不过度采集：只存用户主动说的，不追问不引导
 */

/** 健康事实类别 */
export type HealthFactCategory =
  | 'allergy'        // 过敏（花生过敏、海鲜过敏…）
  | 'intolerance'    // 不耐受/忌口（乳糖不耐受、不吃香菜…）
  | 'condition'      // 健康状况（糖尿病、高血压、孕期…）
  | 'goal'           // 饮食目标（控糖、减脂、增肌、低钠…）
  | 'medication'     // 用药相关（在吃华法林、补铁…）
  | 'preference'     // 健康偏好（少油、清淡、不吃夜宵…）

/** 单条健康事实 */
export interface HealthFact {
  id: string
  category: HealthFactCategory
  /** 人类可读的标签，如"花生过敏""控糖""在吃降压药" */
  label: string
  /** 可选的补充说明，如"医生建议每天盐不超过5g" */
  detail?: string
  /** 来源：从哪条用户消息提取的 */
  sourceMessage?: string
  createdAt: number
}

const STORAGE_KEY = 'fandazi.healthFacts'

const CATEGORY_LABELS: Record<HealthFactCategory, string> = {
  allergy: '过敏',
  intolerance: '忌口/不耐受',
  condition: '健康状况',
  goal: '饮食目标',
  medication: '用药相关',
  preference: '健康偏好',
}

export function getCategoryLabel(category: HealthFactCategory): string {
  return CATEGORY_LABELS[category]
}

export function getCategoryLabels(): { value: HealthFactCategory; label: string }[] {
  return (Object.keys(CATEGORY_LABELS) as HealthFactCategory[]).map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
  }))
}

/** 读取所有健康事实 */
export function readHealthFacts(): HealthFact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (f): f is HealthFact =>
        f &&
        typeof f === 'object' &&
        typeof f.id === 'string' &&
        typeof f.category === 'string' &&
        typeof f.label === 'string' &&
        typeof f.createdAt === 'number',
    )
  } catch {
    return []
  }
}

/** 按类别分组读取 */
export function readHealthFactsByCategory(): Record<HealthFactCategory, HealthFact[]> {
  const facts = readHealthFacts()
  const grouped: Record<HealthFactCategory, HealthFact[]> = {
    allergy: [],
    intolerance: [],
    condition: [],
    goal: [],
    medication: [],
    preference: [],
  }
  for (const f of facts) {
    if (grouped[f.category]) grouped[f.category].push(f)
  }
  return grouped
}

/** 添加健康事实（去重：同 category + 同 label 不重复添加） */
export function addHealthFact(fact: Omit<HealthFact, 'id' | 'createdAt'>): HealthFact | null {
  const facts = readHealthFacts()
  const exists = facts.some(
    (f) => f.category === fact.category && f.label === fact.label,
  )
  if (exists) return null

  const newFact: HealthFact = {
    ...fact,
    id: `hf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  }
  facts.push(newFact)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(facts))
  return newFact
}

/** 批量添加（从 AI 提取的多条事实） */
export function addHealthFacts(extracted: Omit<HealthFact, 'id' | 'createdAt'>[]): HealthFact[] {
  const added: HealthFact[] = []
  for (const fact of extracted) {
    const result = addHealthFact(fact)
    if (result) added.push(result)
  }
  return added
}

/** 删除一条健康事实 */
export function removeHealthFact(id: string): void {
  const facts = readHealthFacts()
  const filtered = facts.filter((f) => f.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}

/** 清空所有健康事实 */
export function clearHealthFacts(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/** 是否有健康事实 */
export function hasHealthFacts(): boolean {
  return readHealthFacts().length > 0
}
