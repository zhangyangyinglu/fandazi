/**
 * 饭团 AI Client
 *
 * 统一 OpenAI-compatible chat completion 调用。
 * 支持 DeepSeek / OpenAI / 任意 OpenAI-compatible 端点。
 *
 * 无 Key 时返回 null，上层应走本地 fallback（generateFantuanReply）。
 * 调用失败时抛出明确错误，上层应 catch 并回退。
 */

import { readAiConfig, type AiProviderConfig } from './aiProviderConfig'

/** 兼容用户填写 API 根地址或完整 chat/completions 地址。 */
export function getChatCompletionsUrl(baseURL: string): string {
  return baseURL.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '') + '/chat/completions'
}

/** 饭团系统提示词 - 定义饭团人格和上下文 */
export function buildFantuanSystemPrompt(context: FantuanContext): string {
  const parts: string[] = [
    '你是饭团，一个家庭做饭助手的小宠物角色。语气亲切、简短、不说套话。',
    '你知道用户的冰箱、计划、购物清单、口味偏好、健康信息，回答时要结合这些信息。',
    '你的建议要具体可执行：推荐菜品、提醒缺食材、建议搭配。',
    '不要编造不存在的菜品。如果不确定就说不知道。',
    // 健康事实提取规则
    '用户聊天时可能会随口提到健康相关信息（过敏、忌口、慢性病、饮食目标、用药等）。',
    '当你从用户消息中识别到健康信息时，在回复末尾附加一行 JSON 来记录它。',
    'JSON 格式：{"health_facts":[{"category":"类别","label":"简短标签","detail":"可选补充"}]}',
    'category 可选值：allergy（过敏）、intolerance（忌口/不耐受）、condition（健康状况）、goal（饮食目标）、medication（用药相关）、preference（健康偏好）。',
    '只提取用户明确说出的信息，不要追问、不要推测、不要引导用户填问卷。',
    '如果用户消息中没有健康信息，不要附加 JSON。',
    'JSON 必须在回复最后一行，前面用一个空行隔开。',
  ]

  if (context.pantryItems.length > 0) {
    parts.push(`用户冰箱里有：${context.pantryItems.join('、')}`)
  }
  if (context.todayPlans.length > 0) {
    parts.push(`今天已计划：${context.todayPlans.join('、')}`)
  }
  if (context.tasteProfile) {
    const tp = context.tasteProfile
    const tasteParts: string[] = []
    if (tp.spicy !== undefined) tasteParts.push(['不辣', '微辣', '中辣', '重辣'][tp.spicy])
    if (tp.salty !== undefined) tasteParts.push(['清淡', '适中', '偏咸'][tp.salty])
    if (tp.avoid.length > 0) tasteParts.push(`忌口${tp.avoid.join('、')}`)
    if (tasteParts.length > 0) parts.push(`用户口味：${tasteParts.join('，')}`)
  }
  if (context.healthFacts && context.healthFacts.length > 0) {
    const factStrs = context.healthFacts.map((f) => `${f.category}:${f.label}`)
    parts.push(`用户已记录的健康信息：${factStrs.join('，')}`)
    parts.push('注意：已在档案中的信息不需要重复提取，除非用户说了新的或要修改的。')
  }
  if (context.pageHint) {
    parts.push(`当前所在页面：${context.pageHint}`)
  }

  return parts.join('\n')
}

export interface FantuanContext {
  pantryItems: string[]
  todayPlans: string[]
  tasteProfile?: {
    spicy: number
    salty: number
    sweet: number
    avoid: string[]
    note: string
  }
  healthFacts?: { category: string; label: string }[]
  pageHint?: string
}

export interface FantuanChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** AI 从对话中提取的健康事实 */
export interface ExtractedHealthFact {
  category: string
  label: string
  detail?: string
}

export type AiCallResult =
  | { ok: true; reply: string; healthFacts?: ExtractedHealthFact[] }
  | { ok: false; error: string }

/**
 * 从 AI 回复中解析健康事实 JSON
 * AI 被要求在回复末尾附加一行 JSON：{"health_facts":[...]}
 * 返回 { reply: 去掉JSON的纯文本, healthFacts: 提取的事实数组 }
 */
export function parseHealthFactsFromReply(rawReply: string): {
  reply: string
  healthFacts?: ExtractedHealthFact[]
} {
  // 尝试匹配最后一行的 JSON
  const jsonMatch = rawReply.match(/\n\{[\s\S]*"health_facts"[\s\S]*\}\s*$/)
  if (!jsonMatch) {
    return { reply: rawReply.trim() }
  }

  try {
    const jsonStr = jsonMatch[0].trim()
    const parsed = JSON.parse(jsonStr) as { health_facts?: ExtractedHealthFact[] }
    if (!parsed.health_facts || !Array.isArray(parsed.health_facts)) {
      return { reply: rawReply.replace(jsonMatch[0], '').trim() }
    }

    // 验证每条事实
    const validFacts = parsed.health_facts.filter(
      (f) =>
        f &&
        typeof f.category === 'string' &&
        typeof f.label === 'string' &&
        f.category.length > 0 &&
        f.label.length > 0,
    )

    return {
      reply: rawReply.replace(jsonMatch[0], '').trim(),
      healthFacts: validFacts.length > 0 ? validFacts : undefined,
    }
  } catch {
    return { reply: rawReply.trim() }
  }
}

/**
 * 调用 AI 模型获取饭团回复
 *
 * @param messages 对话历史（不含 system prompt，函数内部添加）
 * @param context 饭团上下文（冰箱/计划/口味等）
 * @returns ok=true + reply 或 ok=false + error
 */
export async function callFantuanAi(
  messages: FantuanChatMessage[],
  context: FantuanContext,
): Promise<AiCallResult> {
  const config = readAiConfig()
  if (!config) {
    return { ok: false, error: 'NO_API_KEY' }
  }

  const systemPrompt = buildFantuanSystemPrompt(context)
  const fullMessages: FantuanChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ]

  try {
    const response = await fetch(getChatCompletionsUrl(config.baseURL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: fullMessages,
        max_tokens: 500,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      if (response.status === 401) {
        return { ok: false, error: 'KEY_INVALID' }
      }
      if (response.status === 429) {
        return { ok: false, error: 'RATE_LIMIT' }
      }
      return { ok: false, error: `HTTP_${response.status}: ${errText.slice(0, 200)}` }
    }

    const data = await response.json()
    const rawReply = data?.choices?.[0]?.message?.content
    if (!rawReply || typeof rawReply !== 'string') {
      return { ok: false, error: 'EMPTY_RESPONSE' }
    }

    const { reply, healthFacts } = parseHealthFactsFromReply(rawReply)
    return { ok: true, reply, healthFacts }
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return { ok: false, error: 'NETWORK_ERROR' }
    }
    return { ok: false, error: String(err).slice(0, 200) }
  }
}

/**
 * 测试 AI 连接
 */
export async function testAiConnection(config: AiProviderConfig): Promise<AiCallResult> {
  try {
    const response = await fetch(getChatCompletionsUrl(config.baseURL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: '你好' }],
        max_tokens: 10,
      }),
    })

    if (!response.ok) {
      if (response.status === 401) return { ok: false, error: 'KEY_INVALID' }
      return { ok: false, error: `HTTP_${response.status}` }
    }

    const data = await response.json()
    if (!data?.choices?.[0]?.message?.content) {
      return { ok: false, error: 'EMPTY_RESPONSE' }
    }

    return { ok: true, reply: '连接成功' }
  } catch {
    return { ok: false, error: 'NETWORK_ERROR' }
  }
}
