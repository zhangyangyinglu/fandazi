/**
 * 家庭空间 / 饭搭子组合设置
 *
 * 正式使用读取真实家庭成员；没有成员时显示空状态，不注入 Demo 成员。
 * 与 /health 的健康档案互补：这里管"谁在搭饭 + 今天谁掌勺"，/health 管"每个人的健康约束"。
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  readBuddyGroup,
  writeBuddyGroup,
  type BuddyGroup,
  type BuddyMember,
} from '@/data/familySharing'
import { syncTodayChefId, fetchTodayChefId } from '@/lib/familyCloudSync'
import { EMPTY_DISH_PREFERENCES } from '@/data/dishPreferences'
import { readHealthProfiles, type HealthProfile } from '@/components/healthProfileStorage'
import { FantuanIcon } from '@/components/FantuanIcon'
import { getMyHouseholdMembers } from '@/lib/familyAuth'
import './FamilyPage.css'

const uid = () => crypto.randomUUID()

const AVATAR_OPTIONS = ['🐶', '🐱', '🐰', '🐻', '🐼', '🦊', '🐹', '🐨', '🦁', '🐯']

const STORAGE_KEY = 'fandazi.buddyGroup'
const DEMO_MEMBER_NAMES = new Set(['小夏', '阿川'])

function createEmptyGroup(): BuddyGroup {
  return { id: 'buddy-group-empty', name: '我的饭搭子组合', members: [], todayChefId: '' }
}

export function FamilyPage() {
  const [group, setGroup] = useState<BuddyGroup>(createEmptyGroup)
  const [healthProfiles, setHealthProfiles] = useState<HealthProfile[]>([])
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loadMembers = async () => {
      const stored = localStorage.getItem(STORAGE_KEY)
      const storedGroup = stored ? readBuddyGroup() : createEmptyGroup()
      const localGroup = storedGroup.members.some((member) => DEMO_MEMBER_NAMES.has(member.name))
        ? createEmptyGroup()
        : storedGroup
      const remoteMembers = await getMyHouseholdMembers()
      if (cancelled) return

      if (remoteMembers.length > 0) {
        const localByName = new Map(localGroup.members.map((member) => [member.name, member]))
        const members = remoteMembers.map((member) => {
          const local = localByName.get(member.displayName)
          return {
            id: member.userId,
            name: member.displayName,
            avatar: member.avatarEmoji,
            healthProfile: local?.healthProfile ?? { goals: [], restrictions: [], notes: '' },
            preferences: local?.preferences ?? { ...EMPTY_DISH_PREFERENCES },
          }
        })
        setGroup({ id: localGroup.id, name: members.map((member) => member.name).join('和'), members, todayChefId: members[0]?.id ?? '' })
      } else {
        setGroup(localGroup)
      }
      setHealthProfiles(readHealthProfiles())

      // 从云端拉取今日掌勺人（新设备首次打开时同步）
      const remoteChefId = await fetchTodayChefId()
      if (!cancelled && remoteChefId) {
        setGroup((prev) =>
          prev.todayChefId === remoteChefId ? prev : { ...prev, todayChefId: remoteChefId }
        )
      }
    }
    void loadMembers()

    // 监听云端 todayChefId 变更（其他设备切换掌勺人时同步）
    const onCloudChef = (e: Event) => {
      const detail = (e as CustomEvent).detail as Record<string, unknown>
      const remoteChefId = detail?.today_chef_id
      if (typeof remoteChefId === 'string' && remoteChefId) {
        setGroup((prev) => {
          if (prev.todayChefId === remoteChefId) return prev
          const updated = { ...prev, todayChefId: remoteChefId }
          writeBuddyGroup(updated)
          return updated
        })
      }
    }
    window.addEventListener('fandazi:household-settings-cloud', onCloudChef)

    return () => {
      cancelled = true
      window.removeEventListener('fandazi:household-settings-cloud', onCloudChef)
    }
  }, [])

  const isDefaultGroup = group.members.length === 0

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
    if (group.members.length === 0) return
    const emptyName = group.members.find((m) => !m.name.trim())
    if (emptyName) {
      return // 有空名成员时不保存
    }
    const trimmed = { ...group, members: group.members.map((m) => ({ ...m, name: m.name.trim() })) }
    writeBuddyGroup(trimmed)
    void syncTodayChefId(trimmed.todayChefId)
    setGroup(trimmed)
    setEditing(false)
    setSaved(true)
  }

  const resetGroup = () => {
    localStorage.removeItem(STORAGE_KEY)
    setGroup(createEmptyGroup())
    setEditing(false)
    setSaved(false)
  }

  return (
    <div className="family-page">
      <section className="fd-hero-card family-hero">
        <div className="hero-label"><FantuanIcon name="buddy-collab" size={20} /> 家庭空间 · 饭搭子组合</div>
        <h2>谁在搭饭，今天谁掌勺</h2>
        <p>
          这里显示当前家庭组的真实成员。你可以只有自己，也可以邀请搭子加入；今天掌勺的人拥有当日决策权，但每个人的偏好都会参与推荐。
        </p>
        <div className="cta-row">
          {!editing ? (
            <button className="fd-btn fd-btn-primary" onClick={() => setEditing(true)}>{isDefaultGroup ? '设置成员' : '编辑成员'}</button>
          ) : (
            <button className="fd-btn fd-btn-primary" onClick={saveGroup}>保存</button>
          )}
          {isDefaultGroup && <span className="fd-badge gold">尚未设置成员</span>}
          {!isDefaultGroup && <button className="fd-btn fd-btn-secondary" onClick={resetGroup}>清空成员</button>}
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
        {group.members.length === 0 && !editing && (
          <div className="family-empty-state">
            <h4>还没有设置家庭成员</h4>
            <p>先设置你自己，之后可以在这里继续添加搭子。</p>
          </div>
        )}
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
          <li><strong>健康偏好</strong>：每个人填写自己的问卷；推荐会结合当前已填写的成员限制。</li>
          <li><strong>多设备同步</strong>：开启 Supabase 同步后，冰箱/计划/购物/做饭记录/饭团进度在家庭组内共享。</li>
        </ul>
      </aside>
    </div>
  )
}
