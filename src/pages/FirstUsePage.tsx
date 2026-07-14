import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EMPTY_DISH_PREFERENCES } from '@/data/dishPreferences'
import { writeBuddyGroup, type BuddyGroup, type BuddyMember } from '@/data/familySharing'
import { writeHealthProfiles, type HealthProfile } from '@/components/healthProfileStorage'
import { FIRST_USE_COMPLETED_EVENT, FIRST_USE_COMPLETED_KEY } from '@/components/AppAccessGate'
import './FirstUsePage.css'

const GOAL_OPTIONS = [
  ['meal-planning', '日常家常', '每天吃得简单、稳定'],
  ['sugar-control', '控脂控糖', '少油少糖，更轻松'],
  ['light-diet', '清淡一点', '少盐少重口'],
  ['shopping-efficiency', '省钱快手', '少买菜，快点做完'],
] as const

const RESTRICTION_OPTIONS = [
  ['no-seafood', '海鲜'],
  ['no-beef-lamb', '牛羊肉'],
  ['no-egg', '鸡蛋'],
  ['no-dairy', '奶制品'],
  ['no-nuts', '坚果'],
  ['no-spicy', '辣味'],
] as const

const uid = () => crypto.randomUUID()

function createMember(name: string, avatar: string, id = uid()): BuddyMember {
  return {
    id,
    name,
    avatar,
    healthProfile: { goals: [], restrictions: [], notes: '' },
    preferences: { ...EMPTY_DISH_PREFERENCES },
  }
}

export function FirstUsePage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [companionName, setCompanionName] = useState('')
  const [goals, setGoals] = useState<string[]>([])
  const [restrictions, setRestrictions] = useState<string[]>([])
  const [error, setError] = useState('')

  const toggle = (value: string, current: string[], setter: (next: string[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  const finish = () => {
    const ownerName = name.trim()
    if (!ownerName) {
      setError('先告诉饭团怎么称呼你，之后推荐和家庭成员才不会混乱。')
      return
    }

    const members = [createMember(ownerName, '🍚')]
    if (companionName.trim()) members.push(createMember(companionName.trim(), '🍵'))
    const group: BuddyGroup = {
      id: `buddy-group-${uid()}`,
      name: members.map((member) => member.name).join('和'),
      members,
      todayChefId: members[0].id,
    }
    writeBuddyGroup(group)

    const now = Date.now()
    const profile: HealthProfile = {
      id: `health-${uid()}`,
      name: ownerName,
      role: 'owner',
      goals: goals as HealthProfile['goals'],
      healthStatuses: [],
      restrictions: restrictions as HealthProfile['restrictions'],
      nutritionFocus: [],
      priorityGoals: goals.slice(0, 1) as HealthProfile['priorityGoals'],
      notes: '首次使用轻量问卷记录，可随时在健康页修改。',
      createdAt: now,
      updatedAt: now,
    }
    writeHealthProfiles([profile])
    localStorage.setItem(FIRST_USE_COMPLETED_KEY, 'true')
    window.dispatchEvent(new Event(FIRST_USE_COMPLETED_EVENT))
    navigate('/')
  }

  return (
    <div className="first-use-page">
      <section className="first-use-hero">
        <div className="hero-label">第一次使用 · 只需几分钟</div>
        <h1>先把你们这一餐搭起来</h1>
        <p>饭搭子会根据成员偏好、健康约束和冰箱食材给出推荐。下面几项设置完成后，你就能直接看到第一份适合你们的晚餐。</p>
      </section>

      <section className="first-use-panel">
        <div className="first-use-step"><span>1</span><div><h2>谁在一起吃饭？</h2><p>填写真实称呼，之后可以随时在家庭空间修改。</p></div></div>
        <label>你的称呼<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：杨老师" /></label>
        <label>搭子称呼（可选）<input value={companionName} onChange={(event) => setCompanionName(event.target.value)} placeholder="例如：屠老师" /></label>
      </section>

      <section className="first-use-panel">
        <div className="first-use-step"><span>2</span><div><h2>你们更在意什么？</h2><p>不需要填医学信息，先告诉饭团日常目标即可。</p></div></div>
        <div className="choice-grid">
          {GOAL_OPTIONS.map(([value, label, description]) => (
            <button key={value} className={goals.includes(value) ? 'choice-card selected' : 'choice-card'} onClick={() => toggle(value, goals, setGoals)} type="button">
              <strong>{label}</strong><span>{description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="first-use-panel">
        <div className="first-use-step"><span>3</span><div><h2>有什么需要避开的？</h2><p>选中后，推荐会优先避开这些食材或口味。</p></div></div>
        <div className="choice-tags">
          {RESTRICTION_OPTIONS.map(([value, label]) => (
            <button key={value} className={restrictions.includes(value) ? 'choice-tag selected' : 'choice-tag'} onClick={() => toggle(value, restrictions, setRestrictions)} type="button">{label}</button>
          ))}
        </div>
      </section>

      <section className="first-use-logic">
        <h2>饭搭子接下来会自动做什么？</h2>
        <div className="logic-grid">
          <div><strong>推荐</strong><span>结合你们的偏好、约束和 2026 膳食指南排序</span></div>
          <div><strong>冰箱</strong><span>优先使用已有食材，并提示缺什么</span></div>
          <div><strong>计划</strong><span>选菜加入计划后，缺少的食材进入购物清单</span></div>
          <div><strong>反馈</strong><span>做完和吃完后反馈，慢慢沉淀成你们家的口味</span></div>
        </div>
      </section>

      {error && <p className="first-use-error">{error}</p>}
      <button className="fd-btn fd-btn-primary first-use-submit" type="button" onClick={finish}>完成设置，看看第一份推荐</button>
      <p className="first-use-note">健康问卷不是医学诊断；特殊疾病、过敏和用药情况请以专业医嘱为准。</p>
    </div>
  )
}
