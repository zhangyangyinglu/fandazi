import { afterEach, describe, expect, it, vi } from 'vitest'
import { callFantuanAi, getChatCompletionsUrl, parseHealthFactsFromReply, testAiConnection } from '@/lib/fantuanAiClient'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fantuanAiClient', () => {
  it('无 API Key 时明确返回本地模式错误', async () => {
    const result = await callFantuanAi(
      [{ role: 'user', content: '今晚吃什么？' }],
      { pantryItems: [], todayPlans: [] },
    )

    expect(result).toEqual({ ok: false, error: 'NO_API_KEY' })
  })

  it('能解析回复末尾的健康事实 JSON，并移除协议行', () => {
    const result = parseHealthFactsFromReply(
      '我会按清淡口味推荐。\n\n{"health_facts":[{"category":"allergy","label":"花生过敏","detail":"明确提到"}]}',
    )

    expect(result.reply).toBe('我会按清淡口味推荐。')
    expect(result.healthFacts).toEqual([
      { category: 'allergy', label: '花生过敏', detail: '明确提到' },
    ])
  })

  it('没有健康事实时保留普通回复原文', () => {
    const result = parseHealthFactsFromReply('今晚可以做番茄豆腐虾仁汤。')

    expect(result).toEqual({ reply: '今晚可以做番茄豆腐虾仁汤。' })
  })

  it('兼容根地址和完整 chat/completions 地址', () => {
    expect(getChatCompletionsUrl('https://api.example.com/v1')).toBe(
      'https://api.example.com/v1/chat/completions',
    )
    expect(getChatCompletionsUrl('https://api.example.com/v1/chat/completions')).toBe(
      'https://api.example.com/v1/chat/completions',
    )
  })

  it('测试连接时不重复追加 chat/completions 路径', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '你好' } }] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await testAiConnection({
      provider: 'custom',
      baseURL: 'https://api.example.com/v1/chat/completions',
      model: 'demo-model',
      apiKey: 'test-key',
      tested: false,
    })

    expect(result).toEqual({ ok: true, reply: '连接成功' })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.any(Object),
    )
  })
})
