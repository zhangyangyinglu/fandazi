/**
 * 健康页 - 首次轻量问卷 + 饭团对话共同积累的健康档案
 *
 * 首次使用时先完成少量饮食偏好设置，后续和饭团聊天时提到的健康信息再自动补充。
 */
import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EMPTY_DISH_PREFERENCES } from '@/data/dishPreferences'
import { readBuddyGroup, writeBuddyGroup, type BuddyGroup, type BuddyMember } from '@/data/familySharing'
import { readHealthProfiles, writeHealthProfiles, type HealthGoal, type DietRestriction, type HealthProfile } from '@/components/healthProfileStorage'
import { FIRST_USE_COMPLETED_EVENT, FIRST_USE_COMPLETED_KEY } from '@/components/AppAccessGate'
import { hasAiKey } from '@/lib/aiProviderConfig'
import {
  readHealthFactsByCategory,
  removeHealthFact,
  getCategoryLabels,
  type HealthFactCategory,
} from '@/lib/healthFacts'
import './HealthPage.css'

const GOAL_OPTIONS = [
  ['meal-planning', '日常家常', '每天吃得简单、稳定'],
  ['sugar-control', '控脂控糖', '少油少糖，更轻松'],
  ['light-diet', '清淡一点', '少盐少重口'],
  ['shopping-efficiency', '省钱快手', '少买菜，快点做完'],
] as const

const RESTRICTION_OPTIONS = [
  ['no-seafood', '海鲜'], ['no-beef-lamb', '牛羊肉'], ['no-egg', '鸡蛋'],
  ['no-dairy', '奶制品'], ['no-nuts', '坚果'], ['no-spicy', '辣味'],
] as const

const uid = () => crypto.randomUUID()

export function HealthPage() {
  const navigate = useNavigate()
  const aiConnected = hasAiKey()
  const isFirstUse = localStorage.getItem(FIRST_USE_COMPLETED_KEY) !== 'true'
  const existingProfiles = readHealthProfiles()
  const currentName = localStorage.getItem('fandazi.currentDisplayName') || '家庭成员'
  const currentProfile = existingProfiles.find((profile) => profile.name === currentName) ?? existingProfiles[0]
  const [goals, setGoals] = useState<string[]>(currentProfile?.goals ?? [])
  const [restrictions, setRestrictions] = useState<string[]>(currentProfile?.restrictions ?? [])
  const [questionnaireSaved, setQuestionnaireSaved] = useState(false)
  const [factsByCategory, setFactsByCategory] = useState(readHealthFactsByCategory())
  const categoryLabels = getCategoryLabels()

  const handleDelete = useCallback((id: string) => {
    removeHealthFact(id)
    setFactsByCategory(readHealthFactsByCategory())
  }, [])

  const totalFacts = Object.values(factsByCategory).reduce((sum, arr) => sum + arr.length, 0)

  const toggle = (value: string, current: string[], setter: (next: string[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  const saveQuestionnaire = () => {
    const now = Date.now()
    const profile: HealthProfile = {
      id: currentProfile?.id ?? `health-${uid()}`,
      name: currentName,
      role: currentProfile?.role ?? 'owner',
      goals: goals as HealthGoal[],
      healthStatuses: currentProfile?.healthStatuses ?? [],
      restrictions: restrictions as DietRestriction[],
      nutritionFocus: currentProfile?.nutritionFocus ?? [],
      priorityGoals: goals.slice(0, 1) as HealthGoal[],
      notes: '健康问卷记录，可随时在本页修改。',
      createdAt: currentProfile?.createdAt ?? now,
      updatedAt: now,
    }
    writeHealthProfiles([...existingProfiles.filter((item) => item.id !== profile.id), profile])

    if (isFirstUse) {
      const currentMember: BuddyMember = {
        id: `member-${uid()}`,
        name: currentName,
        avatar: '🍚',
        healthProfile: { goals: [], restrictions: [], notes: '' },
        preferences: { ...EMPTY_DISH_PREFERENCES },
      }
      const existingGroup = localStorage.getItem('fandazi.buddyGroup') ? readBuddyGroup() : null
      const group: BuddyGroup = existingGroup && existingGroup.members.length > 0
        ? existingGroup
        : { id: `buddy-group-${uid()}`, name: currentName, members: [currentMember], todayChefId: currentMember.id }
      writeBuddyGroup(group)
      localStorage.setItem(FIRST_USE_COMPLETED_KEY, 'true')
      window.dispatchEvent(new Event(FIRST_USE_COMPLETED_EVENT))
      navigate('/')
      return
    }
    setQuestionnaireSaved(true)
  }

  return (
    <div className="health-page">
      <section className="health-hero">
        <div className="fd-hero-card health-hero-main">
          <div className="hero-label">健康档案 · 问卷 + 对话</div>
          <h2>{totalFacts > 0 ? `已记录 ${totalFacts} 条健康信息` : '还没有健康信息'}</h2>
          <p>
            {totalFacts > 0
              ? '这些信息来自健康问卷和你与饭团的对话。推荐时会考虑这些因素，你也可以随时删除或补充。'
              : '先完成下面的健康问卷；之后和饭团聊天时说到健康信息，饭团会继续帮你记住。'}
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

      <section className="fd-panel health-questionnaire">
        <div className="section-heading">
          <div>
            <div className="hero-label">我的健康问卷</div>
            <h3>{isFirstUse ? '先告诉饭团你的饮食习惯' : '随时修改我的饮食习惯'}</h3>
          </div>
          <span className="fd-badge gold">每个人填写自己的</span>
        </div>
        <p className="health-small">不需要填写医学信息，只选择会影响日常推荐的内容即可。</p>
        <div className="health-question-block">
          <h4>你更在意什么？</h4>
          <div className="health-choice-grid">
            {GOAL_OPTIONS.map(([value, label, description]) => (
              <button key={value} className={goals.includes(value) ? 'health-choice selected' : 'health-choice'} onClick={() => toggle(value, goals, setGoals)} type="button">
                <strong>{label}</strong><span>{description}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="health-question-block">
          <h4>有什么需要避开的？</h4>
          <div className="health-choice-tags">
            {RESTRICTION_OPTIONS.map(([value, label]) => (
              <button key={value} className={restrictions.includes(value) ? 'health-choice-tag selected' : 'health-choice-tag'} onClick={() => toggle(value, restrictions, setRestrictions)} type="button">{label}</button>
            ))}
          </div>
        </div>
        <div className="cta-row">
          <button className="fd-btn fd-btn-primary" type="button" onClick={saveQuestionnaire}>{isFirstUse ? '保存问卷，看看第一份推荐' : '保存我的问卷'}</button>
          {questionnaireSaved && <span className="health-save-note">已保存</span>}
        </div>
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
            <h3>先填几项，再边用边补充</h3>
            <p>
              上面的问卷会收集最影响推荐的少量偏好；打开右下角饭团对话框继续聊天，说到健康相关信息时，饭团会自动帮你记下来。
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
