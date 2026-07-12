import { parseAIRecipeJson, type ParseResult } from './aiRecipeImport'

export type AIRecipeProviderKey = 'deepseek' | 'openai' | 'custom'

export const AI_RECIPE_PROVIDERS: Record<Exclude<AIRecipeProviderKey, 'custom'>, { label: string; endpoint: string; model: string }> = {
  deepseek: {
    label: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/chat/completions',
    // V4 系列；旧 deepseek-chat 将于 2026-07-24 弃用，提前切换。
    model: 'deepseek-v4-flash',
  },
  openai: {
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
  },
}

export const DEFAULT_AI_RECIPE_PROVIDER: AIRecipeProviderKey = 'deepseek'
export const DEFAULT_AI_RECIPE_ENDPOINT = AI_RECIPE_PROVIDERS[DEFAULT_AI_RECIPE_PROVIDER].endpoint
export const DEFAULT_AI_RECIPE_MODEL = AI_RECIPE_PROVIDERS[DEFAULT_AI_RECIPE_PROVIDER].model

type FetchLike = (_input: string, _init: {
  method: 'POST'
  headers: Record<string, string>
  body: string
}) => Promise<{
  ok: boolean
  status?: number
  statusText?: string
  text?: () => Promise<string>
  json: () => Promise<unknown>
}>

export type GenerateAIRecipeOptions = {
  recipeText: string
  apiKey: string
  provider?: AIRecipeProviderKey
  model?: string
  endpoint?: string
  fetchImpl?: FetchLike
}

export type GenerateAIRecipeResult = {
  rawJson: string
  parseResult: ParseResult
}

export function resolveAIRecipeProvider(provider: AIRecipeProviderKey = DEFAULT_AI_RECIPE_PROVIDER) {
  if (provider === 'custom') {
    return {
      label: '自定义兼容接口',
      endpoint: DEFAULT_AI_RECIPE_ENDPOINT,
      model: DEFAULT_AI_RECIPE_MODEL,
    }
  }
  return AI_RECIPE_PROVIDERS[provider]
}

export function buildAIRecipePrompt(recipeText: string): string {
  const cleanText = recipeText.trim()
  return `你是饭搭子的"标准菜谱整理员"。
我要把下面这道菜或菜谱录进饭搭子的家庭菜库，请你按要求输出 JSON。

菜名或原始菜谱：
${cleanText}

要求：
1. 菜名要正规、家庭常用，不写"升级版""家常版"等后缀。
2. 分类只能是「荤菜」「汤羹」「主食」「素菜」之一。
3. 食材每行写"食材名" + "用量（克）"。每道菜的克重按家庭 2-3 人份估算。
   - 蔬菜按 150-250 克
   - 主食按 50-150 克干重
   - 肉蛋按 100-180 克
   - 调味按家庭常用克数（油 5-15、酱油 8-20、葱姜蒜 5-15）
4. 步骤写 4-6 条，每条一句话、动词开头、用户能照着做。
5. 营养字段按"每份估算"给，数字根据食材克重合理推算。
   字段：kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, sugar_g, satFat_g
6. 健康评分 0-100：参考膳食指南。蛋白 ≥20 +5、纤维 ≥5 +5、钠 ≥1000 -5、饱和脂肪 ≥10 -5、糖 ≥15 -5、热量 ≥700 -3。
7. 饮食特点从下面这些 key 里挑 1-5 个最符合的：
   fat-loss, sugar-control, muscle, three-high, light-diet, gut,
   high-protein, high-fiber, low-fat, low-sodium, low-kcal,
   vitamin-c, calcium, iron, prebiotic, quick, lunchbox, soup, warm, cold
8. id 使用英文 kebab-case，全 ASCII。
9. image 没有就填 null。

只输出 JSON，不要解释，不要 markdown 包裹，不要任何多余文字。`
}

export async function generateAIRecipeJson(options: GenerateAIRecipeOptions): Promise<GenerateAIRecipeResult> {
  const recipeText = options.recipeText.trim()
  const apiKey = options.apiKey.trim()
  if (!recipeText) throw new Error('菜名或菜谱原文不能为空')
  if (!apiKey) throw new Error('外部服务密钥不能为空')

  const providerDefaults = resolveAIRecipeProvider(options.provider)
  const endpoint = options.endpoint?.trim() || providerDefaults.endpoint
  const model = options.model?.trim() || providerDefaults.model
  const fetchImpl = options.fetchImpl ?? window.fetch.bind(window)
  const prompt = buildAIRecipePrompt(recipeText)

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: '你只输出符合要求的 JSON 对象，不要 markdown，不要解释。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    const detail = response.text ? await response.text() : ''
    throw new Error(`AI 调用失败：${response.status ?? ''} ${response.statusText ?? ''}${detail ? `｜${detail.slice(0, 160)}` : ''}`)
  }

  const payload = await response.json()
  const rawJson = extractChatCompletionContent(payload)
  return {
    rawJson,
    parseResult: parseAIRecipeJson(rawJson),
  }
}

function extractChatCompletionContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new Error('AI 返回不是对象')
  }
  const obj = payload as Record<string, unknown>
  const choices = obj.choices
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('AI 返回缺少 choices')
  }
  const first = choices[0]
  if (!first || typeof first !== 'object') {
    throw new Error('AI 返回 choices[0] 不是对象')
  }
  const message = (first as Record<string, unknown>).message
  if (!message || typeof message !== 'object') {
    throw new Error('AI 返回缺少 message')
  }
  const content = (message as Record<string, unknown>).content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI 返回内容为空')
  }
  return content.trim()
}
