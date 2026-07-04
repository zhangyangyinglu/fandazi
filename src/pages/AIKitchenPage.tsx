/**
 * AI 厨房页面 — P5
 * 用户自配 API Key + AI 生成菜谱 + 根据冰箱推荐
 */
import { useState, useRef } from 'react'
import { useFandaziStore } from '@/stores/fandaziStore'
import {
  AI_RECIPE_PROVIDERS,
  DEFAULT_AI_RECIPE_PROVIDER,
  buildAIRecipePrompt,
  resolveAIRecipeProvider,
  type AIRecipeProviderKey,
} from '@/data/aiRecipeGenerate'
import { parseAIRecipeJson } from '@/data/aiRecipeImport'
import { aiParsedToDish } from '@/data/aiParsedToDish'
import type { Dish } from '@/types'
import './AIKitchenPage.css'

const STORAGE_KEY_API = 'fandazi.aiKitchen.apiConfig'

type ApiConfig = {
  provider: AIRecipeProviderKey
  apiKey: string
  customEndpoint?: string
  customModel?: string
}

function readApiConfig(): ApiConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_API)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeApiConfig(config: ApiConfig) {
  localStorage.setItem(STORAGE_KEY_API, JSON.stringify(config))
}

export function AIKitchenPage() {
  const pantry = useFandaziStore((s) => s.pantry)

  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(readApiConfig)
  const [showKeyInput, setShowKeyInput] = useState(!apiConfig)
  const [provider, setProvider] = useState<AIRecipeProviderKey>(apiConfig?.provider || DEFAULT_AI_RECIPE_PROVIDER)
  const [apiKey, setApiKey] = useState(apiConfig?.apiKey || '')
  const [customEndpoint, setCustomEndpoint] = useState(apiConfig?.customEndpoint || '')
  const [customModel, setCustomModel] = useState(apiConfig?.customModel || '')

  const [inputDishName, setInputDishName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Dish[]>([])
  const [rawOutputs, setRawOutputs] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const pantryNames = pantry.map((p) => p.ingredientName)
  const pantrySummary = pantryNames.slice(0, 8).join('、') + (pantryNames.length > 8 ? '…' : '')

  const handleSaveKey = () => {
    if (!apiKey.trim()) return
    const config: ApiConfig = { provider, apiKey: apiKey.trim(), customEndpoint, customModel }
    writeApiConfig(config)
    setApiConfig(config)
    setShowKeyInput(false)
  }

  const handleClearKey = () => {
    localStorage.removeItem(STORAGE_KEY_API)
    setApiConfig(null)
    setApiKey('')
    setShowKeyInput(true)
  }

  const callAI = async (prompt: string): Promise<string> => {
    if (!apiConfig) throw new Error('请先配置 API Key')
    const ac = new AbortController()
    abortRef.current = ac
    const providerDefaults = resolveAIRecipeProvider(apiConfig.provider)
    const endpoint = apiConfig.provider === 'custom' ? (apiConfig.customEndpoint || providerDefaults.endpoint) : providerDefaults.endpoint
    const model = apiConfig.provider === 'custom' ? (apiConfig.customModel || providerDefaults.model) : providerDefaults.model
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: '你只输出符合要求的 JSON 对象，不要 markdown，不要解释。' },
          { role: 'user', content: prompt },
        ],
      }),
      signal: ac.signal,
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`AI 调用失败 ${response.status}: ${detail.slice(0, 200)}`)
    }
    const payload = await response.json()
    const content = payload?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) throw new Error('AI 返回内容为空')
    return content.trim()
  }

  const handleGenerateFromName = async () => {
    if (!inputDishName.trim()) return
    setLoading(true)
    setError(null)
    setResults([])
    setRawOutputs([])
    try {
      const prompt = buildAIRecipePrompt(inputDishName.trim())
      const raw = await callAI(prompt)
      setRawOutputs([raw])
      const parsed = parseAIRecipeJson(raw)
      if (parsed.ok && parsed.dish) {
        const dish = aiParsedToDish(parsed.dish, `ai-${Date.now()}`, new Set())
        setResults([dish])
      } else {
        setError(!parsed.ok ? (parsed.errors.join('; ') || 'AI 输出解析失败') : 'AI 输出解析失败')
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        // 用户取消
      } else {
        setError(e.message || '生成失败')
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const handleGenerateFromPantry = async () => {
    if (pantryNames.length === 0) return
    setLoading(true)
    setError(null)
    setResults([])
    setRawOutputs([])
    try {
      const prompt = `你是饭搭子的"冰箱清理厨神"。
用户冰箱里有这些食材：${pantryNames.join('、')}

请根据这些食材，推荐 3 道能做或基本能做的家常菜。要求：
1. 优先用完快过期的食材
2. 菜名正规、家庭常用
3. 每道菜输出完整的菜谱 JSON（包含 name, category, ingredients, steps, nutrition, healthTags, healthScore, cookTime, difficulty）
4. id 用英文 kebab-case

只输出一个 JSON 数组，包含 3 个菜谱对象，不要解释，不要 markdown 包裹。`
      const raw = await callAI(prompt)
      setRawOutputs([raw])
      // 尝试解析数组
      const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
      const arr = JSON.parse(jsonStr)
      if (Array.isArray(arr)) {
        const dishes: Dish[] = []
        arr.forEach((item: any, idx: number) => {
          const parsed = parseAIRecipeJson(JSON.stringify(item))
          if (parsed.ok && parsed.dish) {
            dishes.push(aiParsedToDish(parsed.dish, `ai-${Date.now()}-${idx}`, new Set()))
          }
        })
        setResults(dishes)
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message || '生成失败')
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const handleAbort = () => {
    abortRef.current?.abort()
  }

  if (showKeyInput) {
    return (
      <div className="ai-kitchen-page">
        <span className="fd-page-tag">AI 厨房 · 配置</span>
        <h2>🤖 AI 厨房</h2>
        <p className="fd-muted">配置你自己的 API Key，AI 帮你生成菜谱、推荐搭配</p>

        <section className="fd-panel">
          <h3>🔑 API Key 配置</h3>
          <div className="ai-config-form">
            <label className="ai-form-label">选择服务商</label>
            <div className="ai-provider-row">
              {Object.entries(AI_RECIPE_PROVIDERS).map(([key, val]) => (
                <button
                  key={key}
                  className={`ai-provider-btn ${provider === key ? 'active' : ''}`}
                  onClick={() => setProvider(key as AIRecipeProviderKey)}
                >
                  {val.label}
                </button>
              ))}
              <button
                className={`ai-provider-btn ${provider === 'custom' ? 'active' : ''}`}
                onClick={() => setProvider('custom')}
              >
                自定义
              </button>
            </div>

            <label className="ai-form-label">API Key</label>
            <input
              type="password"
              className="fd-input ai-key-input"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />

            {provider === 'custom' && (
              <>
                <label className="ai-form-label">Endpoint</label>
                <input
                  type="text"
                  className="fd-input"
                  placeholder="https://api.example.com/v1/chat/completions"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                />
                <label className="ai-form-label">Model</label>
                <input
                  type="text"
                  className="fd-input"
                  placeholder="model-name"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                />
              </>
            )}

            <div className="ai-config-actions">
              <button
                className="fd-btn fd-btn-primary"
                onClick={handleSaveKey}
                disabled={!apiKey.trim()}
              >
                保存
              </button>
            </div>
          </div>
          <div className="ai-security-note">
            <p>🔒 Key 只存在你浏览器的 localStorage，不会上传到任何服务器</p>
            <p>💡 推荐 DeepSeek（便宜）或 OpenAI 兼容接口</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="ai-kitchen-page">
      <span className="fd-page-tag">AI 厨房</span>
      <h2>🤖 AI 厨房</h2>
      <p className="fd-muted">用 AI 生成菜谱、根据冰箱推荐搭配</p>

      {/* API 状态 */}
      <section className="fd-panel ai-api-status">
        <div className="ai-api-info">
          <span className="ai-api-provider">
            {apiConfig?.provider === 'custom' ? '自定义接口' : resolveAIRecipeProvider(apiConfig?.provider as AIRecipeProviderKey).label}
          </span>
          <span className="ai-api-key">🔑 {apiConfig?.apiKey.slice(0, 6)}...{apiConfig?.apiKey.slice(-4)}</span>
        </div>
        <button className="fd-btn ai-reset-key" onClick={handleClearKey}>重设</button>
      </section>

      {/* 根据冰箱推荐 */}
      <section className="fd-panel">
        <h3>🧊 根据冰箱食材推荐</h3>
        <p className="fd-muted">冰箱里现在有：{pantrySummary || '（空）'}</p>
        <button
          className="fd-btn fd-btn-primary"
          onClick={handleGenerateFromPantry}
          disabled={loading || pantryNames.length === 0}
        >
          {loading ? '🤔 思考中...' : '🎲 AI 推荐 3 道菜'}
        </button>
      </section>

      {/* 手动输入菜名生成 */}
      <section className="fd-panel">
        <h3>📝 输入菜名生成菜谱</h3>
        <div className="ai-input-row">
          <input
            type="text"
            className="fd-input"
            placeholder="比如：酸菜鱼、番茄炒蛋..."
            value={inputDishName}
            onChange={(e) => setInputDishName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleGenerateFromName()}
          />
          {loading ? (
            <button className="fd-btn ai-abort-btn" onClick={handleAbort}>取消</button>
          ) : (
            <button
              className="fd-btn fd-btn-primary"
              onClick={handleGenerateFromName}
              disabled={!inputDishName.trim()}
            >
              生成
            </button>
          )}
        </div>
      </section>

      {/* 错误 */}
      {error && (
        <section className="fd-panel ai-error">
          <p>❌ {error}</p>
        </section>
      )}

      {/* 生成结果 */}
      {results.length > 0 && (
        <section className="fd-panel">
          <h3>✨ AI 生成的菜谱</h3>
          <div className="ai-results">
            {results.map((dish, i) => (
              <div key={i} className="ai-result-card">
                <div className="ai-result-header">
                  <span className="ai-result-emoji">🍳</span>
                  <div>
                    <h4>{dish.name}</h4>
                    <span className="ai-result-meta">{dish.category} · {dish.cookTime}</span>
                  </div>
                </div>
                {dish.tags && dish.tags.length > 0 && (
                  <div className="ai-result-score">{dish.tags.join(' · ')}</div>
                )}
                <div className="ai-result-ingredients">
                  <span className="ai-result-label">食材：</span>
                  {dish.ingredients.map((ing, j) => (
                    <span key={j} className="ai-result-tag">{ing.name}</span>
                  ))}
                </div>
                <div className="ai-result-steps">
                  <span className="ai-result-label">步骤：</span>
                  <ol>
                    {dish.steps.map((step, j) => (
                      <li key={j}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Raw 输出（调试用） */}
      {rawOutputs.length > 0 && (
        <details className="ai-raw-output">
          <summary>查看 AI 原始输出</summary>
          <pre>{rawOutputs.join('\n\n---\n\n')}</pre>
        </details>
      )}
    </div>
  )
}
