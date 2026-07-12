/**
 * AI 厨房页面
 *
 * 显示当前饭团 AI 配置状态：
 * - 有 Key：显示已连接状态 + 模型信息 + 去和饭团对话
 * - 无 Key：显示本地模式说明 + 去配置 AI
 */
import { Link } from 'react-router-dom'
import { readAiConfig, hasAiKey } from '@/lib/aiProviderConfig'
import './AIKitchenPage.css'

export function AIKitchenPage() {
  const config = readAiConfig()
  const connected = hasAiKey()

  const providerLabels: Record<string, string> = {
    deepseek: 'DeepSeek',
    openai: 'OpenAI',
    custom: '自定义',
  }

  return (
    <div className="ai-kitchen-page">
      <span className="fd-page-tag">AI 厨房 · 饭团大脑</span>
      <h2>🤖 饭团 AI 厨房</h2>

      {/* AI 状态卡 */}
      <section className="fd-panel" style={{ marginBottom: 16 }}>
        {connected && config ? (
          <>
            <div className="ai-api-status">
              <div className="ai-api-info">
                <span className="ai-api-provider">
                  ✅ {providerLabels[config.provider] || config.provider} · {config.model}
                </span>
                <span className="ai-api-key">
                  {config.baseURL}
                </span>
              </div>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--fd-muted)' }}>
              饭团已接上 AI 模型，可以聊菜谱、问搭配、查冰箱、生成购物建议。
              点右下角饭团图标开始对话。
            </p>
            <div className="ai-config-actions" style={{ marginTop: 12 }}>
              <Link to="/sync" className="fd-btn fd-btn-secondary">修改 AI 配置</Link>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ margin: '0 0 8px' }}>饭团还在本地模式</h3>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--fd-muted)', lineHeight: 1.6 }}>
              现在饭团只能用本地规则回复。配置一个 AI Key（DeepSeek / OpenAI / 自定义），
              饭团就能真正理解你的冰箱、计划、口味，给出个性化建议。
            </p>
            <div className="ai-config-actions">
              <Link to="/sync" className="fd-btn fd-btn-primary">去配置 AI</Link>
            </div>
          </>
        )}
      </section>

      {/* 饭团能做什么 */}
      <section className="fd-panel" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px' }}>饭团能帮你做什么</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="ai-capability">
            <span className="ai-cap-icon">🧊</span>
            <div>
              <strong>看冰箱搭菜</strong>
              <p>告诉饭团冰箱里有什么，它帮你搭一桌能做的菜。</p>
            </div>
          </div>
          <div className="ai-capability">
            <span className="ai-cap-icon">📋</span>
            <div>
              <strong>调整计划</strong>
              <p>说"今晚不想吃太油腻"，饭团按你的口味和健康标签改推荐。</p>
            </div>
          </div>
          <div className="ai-capability">
            <span className="ai-cap-icon">🛒</span>
            <div>
              <strong>补购物清单</strong>
              <p>选了菜但缺食材？饭团帮你列出来，一键加到购物清单。</p>
            </div>
          </div>
          <div className="ai-capability">
            <span className="ai-cap-icon">👅</span>
            <div>
              <strong>记口味偏好</strong>
              <p>说"我不吃香菜"，饭团记住并在以后推荐时避开。</p>
            </div>
          </div>
        </div>
      </section>

      {/* 安全边界 */}
      <section className="fd-panel">
        <h3 style={{ margin: '0 0 8px' }}>数据安全</h3>
        <div className="ai-security-note">
          <p>✅ AI Key 未开启家庭同步时保存在本机；开启后保存在家庭组云端，不进仓库、不进公开 Demo。</p>
          <p>✅ 饭团只读取你允许的上下文（冰箱、计划、口味），不会主动写入数据。</p>
          <p>✅ 饭团建议的"加入计划""生成购物项"等操作需要你确认才会执行。</p>
          <p>✅ 不配置 AI Key 时，饭团完全在本地运行，不调用任何外部服务。</p>
        </div>
      </section>
    </div>
  )
}
