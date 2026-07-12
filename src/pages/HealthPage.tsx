/**
 * 健康页 - 饭团聊出来的健康档案
 *
 * 用户和饭团聊天时随口提到的健康信息会自动提取存档，
 * 在这里可以看到完整的健康画像。
 * 不需要填问卷，聊着聊着就建好了。
 */
import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { hasAiKey } from '@/lib/aiProviderConfig'
import {
  readHealthFactsByCategory,
  removeHealthFact,
  getCategoryLabels,
  type HealthFactCategory,
} from '@/lib/healthFacts'
import './HealthPage.css'

export function HealthPage() {
  const aiConnected = hasAiKey()
  const [factsByCategory, setFactsByCategory] = useState(readHealthFactsByCategory())
  const categoryLabels = getCategoryLabels()

  const handleDelete = useCallback((id: string) => {
    removeHealthFact(id)
    setFactsByCategory(readHealthFactsByCategory())
  }, [])

  const totalFacts = Object.values(factsByCategory).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div className="health-page">
      <section className="health-hero">
        <div className="fd-hero-card health-hero-main">
          <div className="hero-label">健康档案 · 饭团聊出来的</div>
          <h2>{totalFacts > 0 ? `已记录 ${totalFacts} 条健康信息` : '还没有健康信息'}</h2>
          <p>
            {totalFacts > 0
              ? '这些信息是你在和饭团聊天时随口提到的，饭团帮你记住了。推荐时会考虑这些因素。'
              : '不需要填问卷。和饭团聊天时说到"我对花生过敏""我在控糖""最近在吃降压药"之类的，饭团会自动记下来，慢慢积累成你的健康档案。'}
          </p>
          <div className="cta-row">
            <Link to="/" className="fd-btn fd-btn-primary">回到菜品页</Link>
            {!aiConnected && (
              <Link to="/sync" className="fd-btn fd-btn-secondary">配置 AI 让饭团更聪明</Link>
            )}
          </div>
        </div>
        <aside className="fd-side-card health-mode-card">
          <div className="hero-label">当前状态</div>
          <div className="health-line"><span>AI 接通</span><strong>{aiConnected ? '已配置' : '本地模式'}</strong></div>
          <div className="health-line"><span>健康档案</span><strong>{totalFacts} 条</strong></div>
          <div className="health-line"><span>采集方式</span><strong>对话自动提取</strong></div>
        </aside>
      </section>

      {/* 健康档案列表 */}
      {totalFacts > 0 ? (
        <section className="fd-panel health-facts-panel">
          <h3>📋 我的健康档案</h3>
          <p style={{ fontSize: 13, color: 'var(--fd-muted)', margin: '0 0 16px' }}>
            以下信息来自和饭团的对话。如有错误可以直接删除。
          </p>
          <div className="health-facts-list">
            {categoryLabels.map(({ value: cat, label: catLabel }) => {
              const facts = factsByCategory[cat as HealthFactCategory]
              if (!facts || facts.length === 0) return null
              return (
                <div key={cat} className="health-fact-group">
                  <div className="health-fact-cat">{catLabel}</div>
                  <div className="health-fact-items">
                    {facts.map((fact) => (
                      <div key={fact.id} className="health-fact-item">
                        <span className="health-fact-label">{fact.label}</span>
                        {fact.detail && <span className="health-fact-detail">{fact.detail}</span>}
                        <button
                          className="health-fact-delete"
                          onClick={() => handleDelete(fact.id)}
                          aria-label="删除"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <section className="fd-panel health-guide-panel">
          <div>
            <div className="hero-label">怎么积累健康档案</div>
            <h3>和饭团聊天就行</h3>
            <p>
              打开右下角饭团对话框，随便聊。说到健康相关信息时，饭团会自动帮你记下来。
            </p>
          </div>
          <div className="plate-grid">
            <div><strong>💬 过敏</strong><span>说"我对花生过敏"，饭团记下并推荐时避开</span></div>
            <div><strong>🎯 饮食目标</strong><span>说"我在控糖"，饭团优先推荐低糖菜</span></div>
            <div><strong>🏥 健康状况</strong><span>说"血压偏高"，饭团推荐时少盐少油</span></div>
            <div><strong>💊 用药相关</strong><span>说"在吃华法林"，饭团避开维生素K高的菜</span></div>
          </div>
        </section>
      )}

      <section className="fd-panel health-disclaimer">
        <h3>⚠️ 说明</h3>
        <ul>
          <li>健康信息只保存在本机浏览器，不上传到云端，不同步到家庭空间。</li>
          <li>饭团推荐时会参考这些信息，但不替代专业医疗建议。</li>
          <li>菜品中的"清淡、低油、控糖友好"等标签仅用于本地筛选参考。</li>
          <li>有糖尿病、肾病、过敏、孕期等特殊情况，请遵医嘱。</li>
        </ul>
      </section>
    </div>
  )
}
