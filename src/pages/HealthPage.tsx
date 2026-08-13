/**
 * 健康页 - 首次轻量问卷 + 饭团对话共同积累的健康档案
 *
 * 首次使用时先完成少量饮食偏好设置，后续和饭团聊天时提到的健康信息再自动补充。
 */
import { useMemo, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EMPTY_DISH_PREFERENCES } from '@/data/dishPreferences'
import { readBuddyGroup, writeBuddyGroup, type BuddyGroup, type BuddyMember } from '@/data/familySharing'
import { readHealthProfiles, writeHealthProfiles, type HealthGoal, type DietRestriction, type HealthProfile, type CookingTimePreference } from '@/components/healthProfileStorage'
import { FIRST_USE_COMPLETED_EVENT, FIRST_USE_COMPLETED_KEY } from '@/components/AppAccessGate'
import { hasAiKey } from '@/lib/aiProviderConfig'
import { markFirstUseCompletedInCloud } from '@/lib/familyAuth'
import { readDailyMealSettings, writeDailyMealSettings } from '@/data/dailyMeal'
import {
  readHealthFactsByCategory,
  removeHealthFact,
  getCategoryLabels,
  type HealthFactCategory,
} from '@/lib/healthFacts'
import {
  buildHealthPlanSummary,
  COOKING_TIME_OPTIONS,
  HEALTH_GOAL_OPTIONS,
  HEALTH_RESTRICTION_OPTIONS,
  PEOPLE_OPTIONS,
} from '@/data/healthPlanSummary'
import './HealthPage.css'

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
  const [people, setPeople] = useState(() => readDailyMealSettings().people)
  const [cookingTimePreference, setCookingTimePreference] = useState<CookingTimePreference>(currentProfile?.cookingTimePreference ?? 'regular')
  const [needDescription, setNeedDescription] = useState(currentProfile?.needDescription ?? '')
  const [contextNotes, setContextNotes] = useState(currentProfile?.contextNotes ?? '')
  const [questionnaireSaved, setQuestionnaireSaved] = useState(false)
  const [questionnaireError, setQuestionnaireError] = useState('')
  const [factsByCategory, setFactsByCategory] = useState(readHealthFactsByCategory())
  const categoryLabels = getCategoryLabels()

  const handleDelete = useCallback((id: string) => {
    removeHealthFact(id)
    setFactsByCategory(readHealthFactsByCategory())
  }, [])

  const totalFacts = Object.values(factsByCategory).reduce((sum, arr) => sum + arr.length, 0)

  const healthPlanSummary = useMemo(() => buildHealthPlanSummary({
    goals,
    restrictions,
    people,
    cookingTimePreference,
    needDescription,
    contextNotes,
  }), [contextNotes, cookingTimePreference, goals, needDescription, people, restrictions])

  const toggle = (value: string, current: string[], setter: (next: string[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  const toggleGoal = (value: string) => {
    if (goals.includes(value)) {
      setGoals((current) => current.filter((item) => item !== value))
      return
    }
    if (goals.length >= 2) {
      setQuestionnaireError('饮食目标最多选 2 项，其他偏好可以之后再调整。')
      return
    }
    setQuestionnaireError('')
    setGoals((current) => [...current, value])
  }

  const saveQuestionnaire = () => {
    if (goals.length === 0) {
      setQuestionnaireSaved(false)
      setQuestionnaireError('至少选择一个饮食目标，饭搭子才能开始为你推荐。')
      return
    }
    if (!needDescription.trim()) {
      setQuestionnaireSaved(false)
      setQuestionnaireError('请写一句你希望饭团帮你解决的事情，AI 才能按你的真实需求解释推荐。')
      return
    }
    setQuestionnaireError('')
    const now = Date.now()
    const profile: HealthProfile = {
      id: currentProfile?.id ?? `health-${uid()}`,
      name: currentName,
      role: currentProfile?.role ?? 'owner',
      goals: goals as HealthGoal[],
      healthStatuses: currentProfile?.healthStatuses ?? [],
      restrictions: restrictions as DietRestriction[],
      nutritionFocus: currentProfile?.nutritionFocus ?? [],
      priorityGoals: goals.slice(0, 2) as HealthGoal[],
      cookingTimePreference,
      needDescription: needDescription.trim(),
      contextNotes: contextNotes.trim(),
      analysisSummary: healthPlanSummary.summary,
      summaryConfirmedAt: now,
      notes: currentProfile?.notes || '健康问卷记录，可随时在本页修改。',
      createdAt: currentProfile?.createdAt ?? now,
      updatedAt: now,
    }
    writeHealthProfiles([...existingProfiles.filter((item) => item.id !== profile.id), profile])
    writeDailyMealSettings({ ...readDailyMealSettings(), people })

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
      void markFirstUseCompletedInCloud() // 标记到云端，清缓存/换设备后不重复填问卷
      navigate('/', { replace: true })
      return
    }
    setQuestionnaireSaved(true)
  }

  return (
    <div className="health-page">
      <section className="health-hero">
        <div className="fd-hero-card health-hero-main">
          <div className="hero-label">饮食档案 · 问卷 + 对话</div>
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
            <div className="hero-label">我的饮食问卷</div>
            <h3>{isFirstUse ? '先告诉饭团你的饮食习惯' : '随时修改我的饮食习惯'}</h3>
          </div>
          <span className="fd-badge gold">首次使用必填 · 每个人填写自己的</span>
        </div>
        <p className="health-small">这不是医学问诊，而是让饭团听懂你需求的采集表。先选目标，再用自己的话补充原因；保存前会生成一份可回看的需求摘要。</p>
        <div className="health-question-block health-text-block">
          <h4>你希望饭团具体帮你解决什么？ <span className="health-required">必填</span></h4>
          <textarea
            aria-label="你的饮食需求"
            value={needDescription}
            onChange={(event) => setNeedDescription(event.target.value)}
            placeholder="例如：我希望晚饭少油一点、别每天都要重新买很多菜，最好 30 分钟内能做完。"
            rows={3}
          />
          <span className="health-question-hint">这一句话是 AI 分析推荐的主要依据，请尽量写成你自己的话。</span>
        </div>
        <div className="health-question-block">
          <h4>先选你最优先想解决的事</h4>
          <div className="health-choice-grid">
            {HEALTH_GOAL_OPTIONS.map(([value, label, description]) => (
              <button key={value} className={goals.includes(value) ? 'health-choice selected' : 'health-choice'} onClick={() => toggleGoal(value)} type="button">
                <strong>{label}</strong><span>{description}</span>
              </button>
            ))}
          </div>
          <span className="health-question-hint">最多选 2 项，饭团会按优先级一起考虑。</span>
        </div>
        <div className="health-question-block">
          <h4>通常几个人一起吃？</h4>
          <div className="health-choice-grid health-choice-grid-compact">
            {PEOPLE_OPTIONS.map(([value, label, description]) => (
              <button key={value} className={people === value ? 'health-choice selected' : 'health-choice'} onClick={() => setPeople(value)} type="button">
                <strong>{label}</strong><span>{description}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="health-question-block">
          <h4>有什么需要避开的？</h4>
          <div className="health-choice-tags">
            {HEALTH_RESTRICTION_OPTIONS.map(([value, label]) => (
              <button key={value} className={restrictions.includes(value) ? 'health-choice-tag selected' : 'health-choice-tag'} onClick={() => toggle(value, restrictions, setRestrictions)} type="button">{label}</button>
            ))}
          </div>
          <span className="health-question-hint">不需要避开就留空；过敏或明确忌口建议以后也在这里补充。</span>
        </div>
        <div className="health-question-block">
          <h4>做饭时更希望哪种节奏？</h4>
          <div className="health-choice-grid health-choice-grid-compact">
            {COOKING_TIME_OPTIONS.map(([value, label, description]) => (
              <button key={value} className={cookingTimePreference === value ? 'health-choice selected' : 'health-choice'} onClick={() => setCookingTimePreference(value)} type="button">
                <strong>{label}</strong><span>{description}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="health-question-block health-text-block">
          <h4>还有什么背景需要让饭团知道？ <span className="health-optional">可选</span></h4>
          <textarea
            aria-label="饮食背景补充"
            value={contextNotes}
            onChange={(event) => setContextNotes(event.target.value)}
            placeholder="例如：家里有人不吃辣；最近想关注少盐；预算有限；只记录你愿意保存在本机的信息。"
            rows={3}
          />
          <span className="health-question-hint">过敏、明确忌口或医生建议请写清楚；饭团不会替你推测医学结论。</span>
        </div>
        <section className="health-summary-card" aria-label="饭团需求摘要">
          <div className="health-summary-head">
            <div>
              <div className="hero-label">饭团需求摘要</div>
              <h3>{healthPlanSummary.title}</h3>
            </div>
            <span className="health-summary-source">{aiConnected ? 'AI 对话可读取' : '本机推荐可读取'}</span>
          </div>
          <p>{healthPlanSummary.summary}</p>
          <ul>
            {healthPlanSummary.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
          </ul>
          {healthPlanSummary.missing.length > 0 ? (
            <p className="health-summary-missing">保存前还需要：{healthPlanSummary.missing.join('；')}。</p>
          ) : (
            <p className="health-summary-ready">这份摘要会同时提供给推荐引擎和饭团对话，后续推荐理由会引用其中的具体需求。</p>
          )}
        </section>
        <div className="cta-row">
          <button className="fd-btn fd-btn-primary" type="button" onClick={saveQuestionnaire}>{isFirstUse ? '保存问卷，回到首页看推荐' : '保存我的问卷'}</button>
          {questionnaireSaved && <span className="health-save-note">已保存</span>}
        </div>
        {questionnaireError && <p className="health-questionnaire-error" role="alert">{questionnaireError}</p>}
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
          <li>未配置外部 AI 时，健康问卷和摘要只保存在本机浏览器，不上传到云端。</li>
          <li>如果你配置并使用外部 AI，相关摘要会按你的 AI 配置发送给所选模型服务。</li>
          <li>饭团推荐时会参考这些信息，但不替代专业医疗建议。</li>
          <li>菜品中的"清淡、低油、控糖友好"等标签仅用于本地筛选参考。</li>
          <li>有糖尿病、肾病、过敏、孕期等特殊情况，请遵医嘱。</li>
        </ul>
      </section>
    </div>
  )
}
