/**
 * 饭团游戏化页面 — P4
 * 米粒积分 + 副本系统 + 饭团宠物图鉴 + 抽卡
 * 纯前端，localStorage 持久化
 */
import { useState } from 'react'
import { useFandaziStore } from '@/stores/fandaziStore'
import {
  MILI_REWARDS,
  readMili,
  dailyCheckin,
  QUESTS,
  readQuests,
  completeQuest,
  getQuestProgress,
  getCurrentLevel,
  FANTUANZI_CATALOG,
  readFantuanzi,
  gachaSingle,
  gachaTen,
  addOwnedFantuanzi,
  setActiveFantuanzi,
  type Fantuanzi,
  type QuestLevel,
} from '@/data/gamification'
import { FantuanIcon } from '@/components/FantuanIcon'
import { FantuanPetImage } from '@/components/FantuanPetImage'
import './FantuanPage.css'

const LEVEL_LABELS: Record<QuestLevel, string> = {
  bronze: '青铜饭团',
  silver: '白银饭团',
  gold: '黄金饭团',
  diamond: '钻石饭团',
}

const LEVEL_EMOJI: Record<QuestLevel, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  diamond: '💎',
}

const RARITY_COLORS: Record<string, string> = {
  N: '#b0a899',
  R: '#5b9bd5',
  SR: '#a855f7',
  SSR: '#f59e0b',
  UR: '#ef4444',
}

export function FantuanPage() {
  const fantuanStore = useFandaziStore((s) => s.fantuan)
  const addMiliStore = useFandaziStore((s) => s.addMili)
  const cookingLogs = useFandaziStore((s) => s.cookingLogs)
  const mealPlans = useFandaziStore((s) => s.mealPlans)

  const [miliState, setMiliState] = useState(() => readMili())
  const [questState, setQuestState] = useState(() => readQuests())
  const [ftState, setFtState] = useState(() => readFantuanzi())
  const [questProgress, setQuestProgress] = useState(() => getQuestProgress())
  const [currentLevel, setCurrentLevel] = useState(() => getCurrentLevel())
  const [gachaResult, setGachaResult] = useState<Fantuanzi[] | null>(null)
  const [showAllQuests, setShowAllQuests] = useState(false)

  const refreshMiliState = () => setMiliState(readMili())
  const refreshQuestState = () => {
    setQuestState(readQuests())
    setQuestProgress(getQuestProgress())
    setCurrentLevel(getCurrentLevel())
  }
  const refreshFantuanziState = () => setFtState(readFantuanzi())

  // store.fantuan.mili 是唯一米粒来源（签到/做菜/副本/抽卡都通过 addMili 同步到 store）
  // gamification.ts 的 miliState.balance 仅用于签到去重和历史记录，不重复计入
  const displayMili = fantuanStore.mili

  const handleCheckin = () => {
    const result = dailyCheckin()
    if (result.ok) {
      addMiliStore(result.earned)
      refreshMiliState()
    }
  }

  const handleClaimQuest = (questId: string) => {
    completeQuest(questId)
    const quest = QUESTS.find((q) => q.id === questId)
    if (quest) {
      addMiliStore(quest.reward)
    }
    refreshQuestState()
    refreshMiliState()
  }

  const handleGachaSingle = () => {
    const cost = 100
    if (displayMili < cost) return
    const ft = gachaSingle()
    addOwnedFantuanzi(ft)
    addMiliStore(-cost)
    setGachaResult([ft])
    refreshFantuanziState()
    refreshMiliState()
  }

  const handleGachaTen = () => {
    const cost = 1000
    if (displayMili < cost) return
    const results = gachaTen()
    results.forEach((ft) => addOwnedFantuanzi(ft))
    addMiliStore(-cost)
    setGachaResult(results)
    refreshFantuanziState()
    refreshMiliState()
  }

  const handleSetActive = (id: string) => {
    setActiveFantuanzi(id)
    refreshFantuanziState()
  }

  const today = new Date().toISOString().slice(0, 10)
  const hasCheckedIn = miliState.lastCheckinAt === today

  // 副本完成判定（简化：基于 cookingLogs / mealPlans 数量）
  const questChecks: Record<string, number> = {
    recipe_read_count: 0, // 简化：暂不追踪
    dish_cooked_count: cookingLogs.length,
    companion_invited: 0,
    table_completed: mealPlans.filter((p) => p.status === 'done').length,
    meal_checkin_count: cookingLogs.length,
  }

  const visibleQuests = showAllQuests ? QUESTS : QUESTS.slice(0, 6)
  const activeFantuanzi = ftState.active ? FANTUANZI_CATALOG.find((f) => f.id === ftState.active) : null
  const ownedCount = ftState.owned.length
  const totalCount = FANTUANZI_CATALOG.length

  return (
    <div className="fantuan-page">
      <span className="fd-page-tag">饭团 · 游戏化</span>
      <h2><FantuanIcon name="home" size={34} /> 饭团的家</h2>
      <p className="fd-muted">做饭攒米粒，抽饭团宠物，完成副本升等级</p>

      {/* 饭团状态卡 */}
      <section className="fd-panel ft-status-card">
        <div className="ft-pet-display">
          <span className="ft-pet-emoji"><FantuanPetImage state={activeFantuanzi ? 'happy' : 'default'} /></span>
          <div className="ft-pet-info">
            <span className="ft-pet-name">{activeFantuanzi?.name || '白饭团'}</span>
            <span className="ft-pet-rarity" style={{ color: RARITY_COLORS[activeFantuanzi?.rarity || 'N'] }}>
              {activeFantuanzi?.rarity || 'N'} 级
            </span>
            {activeFantuanzi && <span className="ft-pet-flavor">{activeFantuanzi.flavor}</span>}
          </div>
        </div>
        <div className="ft-stats-row">
          <div className="ft-stat">
            <span className="ft-stat-label">🌾 米粒</span>
            <strong className="ft-stat-value">{displayMili}</strong>
          </div>
          <div className="ft-stat">
            <span className="ft-stat-label">🏅 等级</span>
            <strong className="ft-stat-value">
              {currentLevel === 'diamond' ? <FantuanIcon name="diamond" size={20} /> : LEVEL_EMOJI[currentLevel]} {LEVEL_LABELS[currentLevel]}
            </strong>
          </div>
          <div className="ft-stat">
            <span className="ft-stat-label">🍳 做过</span>
            <strong className="ft-stat-value">{cookingLogs.length}</strong>
          </div>
        </div>
        <button
          className="fd-btn fd-btn-primary ft-checkin-btn"
          onClick={handleCheckin}
          disabled={hasCheckedIn}
        >
          {hasCheckedIn ? '✅ 今日已签到' : <><FantuanIcon name="checkin" size={22} /> 每日签到 +{MILI_REWARDS.DAILY_CHECKIN}🌾</>}
        </button>
      </section>

      {/* 副本系统 */}
      <section className="fd-panel">
        <div className="ft-section-header">
          <h3><FantuanIcon name="challenge-copy" size={26} /> 副本挑战</h3>
          <div className="ft-level-progress">
            {(Object.keys(questProgress) as QuestLevel[]).map((lv) => (
              <span key={lv} className={`ft-level-badge ${lv}`}>
                {LEVEL_EMOJI[lv]} {questProgress[lv].done}/{questProgress[lv].total}
              </span>
            ))}
          </div>
        </div>
        <div className="ft-quest-list">
          {visibleQuests.map((quest) => {
            const isDone = questState.completed.includes(quest.id)
            const current = questChecks[quest.checkType] || 0
            const canClaim = !isDone && current >= quest.threshold
            return (
              <div key={quest.id} className={`ft-quest-item ${isDone ? 'done' : ''} ${canClaim ? 'claimable' : ''}`}>
                <span className="ft-quest-emoji">{quest.emoji}</span>
                <div className="ft-quest-info">
                  <span className="ft-quest-title">{quest.title}</span>
                  <span className="ft-quest-desc">{quest.desc}</span>
                  <div className="ft-quest-bar">
                    <div
                      className="ft-quest-bar-fill"
                      style={{ width: `${Math.min(100, (current / quest.threshold) * 100)}%` }}
                    />
                    <span className="ft-quest-bar-text">{Math.min(current, quest.threshold)}/{quest.threshold}</span>
                  </div>
                </div>
                <div className="ft-quest-action">
                  {isDone ? (
                    <span className="ft-quest-done">✅ 已完成</span>
                  ) : canClaim ? (
                    <button className="fd-btn fd-btn-primary ft-claim-btn" onClick={() => handleClaimQuest(quest.id)}>
                      领取 +{quest.reward}🌾
                    </button>
                  ) : (
                    <span className="ft-quest-reward">+{quest.reward}🌾</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {!showAllQuests && QUESTS.length > 6 && (
          <button className="fd-btn ft-show-more" onClick={() => setShowAllQuests(true)}>
            查看全部 {QUESTS.length} 个副本 ↓
          </button>
        )}
      </section>

      {/* 抽卡 */}
      <section className="fd-panel">
        <h3><FantuanIcon name="draw" size={26} /> 抽饭团</h3>
        <p className="fd-muted">100🌾 单抽 · 1000🌾 十连（保底 R+）</p>
        <div className="ft-gacha-buttons">
          <button
            className="fd-btn fd-btn-primary"
            onClick={handleGachaSingle}
            disabled={displayMili < 100}
          >
            单抽 -100🌾
          </button>
          <button
            className="fd-btn"
            onClick={handleGachaTen}
            disabled={displayMili < 1000}
          >
            十连抽 -1000🌾
          </button>
        </div>

        {gachaResult && (
          <div className="ft-gacha-result">
            <h4><FantuanIcon name="celebration" size={24} /> 抽到了！</h4>
            <div className={`ft-gacha-grid ${gachaResult.length > 1 ? 'ten' : ''}`}>
              {gachaResult.map((ft, i) => (
                <div key={i} className="ft-gacha-card" style={{ borderColor: RARITY_COLORS[ft.rarity] }}>
                  <span className="ft-gacha-emoji"><FantuanPetImage state="happy" /></span>
                  <span className="ft-gacha-name">{ft.name}</span>
                  <span className="ft-gacha-rarity" style={{ color: RARITY_COLORS[ft.rarity] }}>{ft.rarity}</span>
                </div>
              ))}
            </div>
            <button className="fd-btn ft-close-result" onClick={() => setGachaResult(null)}>收下</button>
          </div>
        )}
      </section>

      {/* 饭团图鉴 */}
      <section className="fd-panel">
        <h3><FantuanIcon name="catalog" size={26} /> 饭团图鉴</h3>
        <p className="fd-muted">已收集 {ownedCount}/{totalCount} · {Math.round((ownedCount / totalCount) * 100)}%</p>
        <div className="ft-dex-progress">
          <div className="ft-dex-progress-fill" style={{ width: `${(ownedCount / totalCount) * 100}%` }} />
        </div>
        <div className="ft-dex-grid">
          {FANTUANZI_CATALOG.map((ft) => {
            const owned = ftState.owned.includes(ft.id)
            const isActive = ftState.active === ft.id
            return (
              <div
                key={ft.id}
                className={`ft-dex-card ${owned ? 'owned' : 'locked'} ${isActive ? 'active' : ''}`}
                style={{ borderColor: owned ? RARITY_COLORS[ft.rarity] : undefined }}
                onClick={() => owned && handleSetActive(ft.id)}
              >
                <span className="ft-dex-emoji">{owned ? <FantuanPetImage state="happy" /> : '❓'}</span>
                <span className="ft-dex-name">{owned ? ft.name : '???'}</span>
                <span className="ft-dex-rarity" style={{ color: owned ? RARITY_COLORS[ft.rarity] : undefined }}>
                  {owned ? ft.rarity : '?'}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* 米粒获取方式 */}
      <section className="fd-panel">
        <h3>💡 怎么赚米粒</h3>
        <div className="ft-mili-guide">
          {Object.entries(MILI_REWARDS).map(([key, val]) => (
            <div key={key} className="ft-mili-item">
              <span className="ft-mili-label">
                {key === 'MARK_COOKED' && '🍳 标记做过'}
                {key === 'COMPLETE_TABLE' && '🍽️ 完成餐桌计划'}
                {key === 'WRITE_FLAVOR' && '✍️ 写口味描述'}
                {key === 'DAILY_CHECKIN' && '📅 每日签到'}
                {key === 'COMPLETE_QUEST' && '🗺️ 完成副本'}
                {key === 'READ_RECIPE' && '📖 读完菜谱'}
                {key === 'MEAL_CHECKIN' && '✅ 餐后打卡'}
                {key === 'FLOP_SHARE' && <><FantuanIcon name="fail-share" size={20} /> 翻车分享</>}
                {key === 'STREAK_7DAYS' && <><FantuanIcon name="streak" size={20} /> 连续 7 天</>}
                {key === 'LEVEL_UP' && '⬆️ 升级'}
                {key === 'INVITE_COMPANION' && <><FantuanIcon name="buddy-collab" size={20} /> 邀请搭子</>}
                {key === 'COMPANION_LEVELUP' && '🎉 搭子升级'}
                {key === 'WATCH_FREE_LESSON' && '🎓 看免费课'}
              </span>
              <strong className="ft-mili-amount">+{val}🌾</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
