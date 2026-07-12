/**
 * 家庭空间 / 饭搭子组合设置
 *
 * 初次打开使用默认成员；正式使用时由用户自定义饭搭子组合。
 * 与 /health 的健康档案互补：这里管"谁在搭饭 + 今天谁掌勺"，/health 管"每个人的健康约束"。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  readBuddyGroup,
  writeBuddyGroup,
  DEFAULT_BUDDY_GROUP,
  type BuddyGroup,
  type BuddyMember,
} from '@/data/familySharing'
import { EMPTY_DISH_PREFERENCES } from '@/data/dishPreferences'
import { readHealthProfiles, type HealthProfile } from '@/components/healthProfileStorage'
import { FantuanIcon } from '@/components/FantuanIcon'
import './FamilyPage.css'

const uid = () => crypto.randomUUID()

const AVATAR_OPTIONS = ['🐶', '🐱', '🐰', '🐻', '🐼', '🦊', '🐹', '🐨', '🦁', '🐯']

const STORAGE_KEY = 'fandazi.buddyGroup'

export function FamilyPage() {
  const [group, setGroup] = useState<BuddyGroup>(DEFAULT_BUDDY_GROUP)
  const [healthProfiles, setHealthProfiles] = useState<HealthProfile[]>([])
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isCustomized, setIsCustomized] = useState(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = localStorage.getItem(STORAGE_KEY)
    setIsCustomized(!!stored)
    setGroup(readBuddyGroup())
    setHealthProfiles(readHealthProfiles())
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const isDefaultGroup = !isCustomized

  const updateMember = (memberId: string, patch: Partial<BuddyMember>) => {
    setGroup((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m)),
    }))
  }

  const addMember = () => {
    const newMember: BuddyMember = {
      id: uid(),
      name: '新成员',
      avatar: '🐰',
      healthProfile: { goals: [], restrictions: [], notes: '' },
      preferences: { ...EMPTY_DISH_PREFERENCES },
    }
    setGroup((prev) => ({ ...prev, members: [...prev.members, newMember] }))
  }

  const removeMember = (memberId: string) => {
    setGroup((prev) => {
      const remaining = prev.members.filter((m) => m.id !== memberId)
      const newChef = prev.todayChefId === memberId ? (remaining[0]?.id ?? '') : prev.todayChefId
      return { ...prev, members: remaining, todayChefId: newChef }
    })
  }

  const setTodayChef = (memberId: string) => {
    setGroup((prev) => ({ ...prev, todayChefId: memberId }))
  }

  const saveGroup = () => {
    const emptyName = group.members.find((m) => !m.name.trim())
    if (emptyName) {
      return // 有空名成员时不保存
    }
    const trimmed = { ...group, members: group.members.map((m) => ({ ...m, name: m.name.trim() })) }
    writeBuddyGroup(trimmed)
    setGroup(trimmed)
    setIsCustomized(true)
    setEditing(false)
    setSaved(true)
  }

  const resetGroup = () => {
    localStorage.removeItem(STORAGE_KEY)
    setGroup(DEFAULT_BUDDY_GROUP)
    setIsCustomized(false)
    setEditing(false)
    setSaved(false)
  }

  return (
    <div className="family-page">
      <section className="fd-hero-card family-hero">
        <div className="hero-label"><FantuanIcon name="buddy-collab" size={20} /> 家庭空间 · 饭搭子组合</div>
        <h2>谁在搭饭，今天谁掌勺</h2>
        <p>
          初次打开会先给你一组默认成员。正式使用时，改成你和搭饭的人——也可以只有你自己一个人。搭子可以是另一个人、家里的宠物、或不会用电脑的老人。掌勺人当天有决策权，但偏好冲突时双方意见都看得到。
        </p>
        <div className="cta-row">
          {!editing ? (
            <button className="fd-btn fd-btn-primary" onClick={() => setEditing(true)}>编辑成员</button>
          ) : (
            <button className="fd-btn fd-btn-primary" onClick={saveGroup}>保存</button>
          )}
          {isDefaultGroup && <span className="fd-badge gold">默认成员，可编辑</span>}
          {!isDefaultGroup && <button className="fd-btn fd-btn-secondary" onClick={resetGroup}>恢复默认成员</button>}
          <Link to="/health" className="fd-btn fd-btn-secondary">健康问卷</Link>
        </div>
        {saved && <p className="family-save-note">已保存到本机 localStorage：fandazi.buddyGroup</p>}
      </section>

      <section className="fd-panel">
        <div className="section-heading">
          <div>
            <div className="hero-label">饭搭子成员</div>
            <h3>{group.name}</h3>
          </div>
          <span className="fd-badge gold">{group.members.length} 人</span>
        </div>
        <div className="member-grid">
          {group.members.map((member) => {
            const isChef = member.id === group.todayChefId
            const healthProfile = healthProfiles.find((p) => p.name === member.name)
            return (
              <article key={member.id} className="member-card">
                <div className="member-head">
                  <span className="member-avatar">{member.avatar ?? '🍚'}</span>
                  <div className="member-info">
                    {editing ? (
                      <input
                        className="member-name-input"
                        value={member.name}
                        onChange={(e) => updateMember(member.id, { name: e.target.value })}
                      />
                    ) : (
                      <strong>{member.name}</strong>
                    )}
                    <span className="member-role">{isChef ? '今日掌勺' : '搭饭人'}</span>
                  </div>
                  {editing && group.members.length > 1 && (
                    <button className="member-remove" onClick={() => removeMember(member.id)} aria-label={`删除成员 ${member.name}`}>✕</button>
                  )}
                </div>
                {editing && (
                  <div className="member-avatar-picker">
                    {AVATAR_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        className={member.avatar === emoji ? 'avatar-option active' : 'avatar-option'}
                        onClick={() => updateMember(member.id, { avatar: emoji })}
                        aria-label={`将 ${member.name} 的头像设为 ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                <div className="member-health">
                  {healthProfile ? (
                    <>
                      <div className="chip-row">
                        {healthProfile.goals.length > 0 && healthProfile.goals.map((g) => (
                          <span key={g} className="health-chip green">{g}</span>
                        ))}
                      </div>
                      <div className="chip-row">
                        {healthProfile.restrictions.length > 0 && healthProfile.restrictions.map((r) => (
                          <span key={r} className="health-chip red">{r}</span>
                        ))}
                      </div>
                      {healthProfile.notes && <p className="member-note">{healthProfile.notes}</p>}
                    </>
                  ) : (
                    <p className="member-no-health">未填健康问卷 · <Link to="/health">去填</Link></p>
                  )}
                </div>
                {!editing && !isChef && (
                  <button className="fd-btn fd-btn-secondary chef-btn" onClick={() => setTodayChef(member.id)}>
                    设为今日掌勺
                  </button>
                )}
                {!editing && isChef && (
                  <div className="chef-badge">👩‍🍳 今日掌勺</div>
                )}
              </article>
            )
          })}
        </div>
        {editing && (
          <button className="fd-btn fd-btn-secondary add-member-btn" onClick={addMember}>+ 添加成员</button>
        )}
      </section>

      <aside className="fd-side-card family-aside">
        <h4>关于家庭空间</h4>
        <ul className="family-faq">
          <li><strong>一个人也能用</strong>：家庭组里可以只有你自己，搭子可以是宠物或不会用电脑的老人，由你代为设置。</li>
          <li><strong>掌勺权</strong>：今天谁做饭，谁有最终决策权，但搭饭人的偏好都看得到。</li>
          <li><strong>健康共享</strong>：组合内健康档案不隔离，推荐时所有成员的限制都会叠加。</li>
          <li><strong>多设备同步</strong>：开启 Supabase 同步后，冰箱/计划/购物/做饭记录/饭团进度在家庭组内共享。</li>
        </ul>
      </aside>
    </div>
  )
}
