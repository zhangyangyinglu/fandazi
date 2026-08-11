/**
 * 我家版+做饭记录页 — P2-5
 * 对应渲染图：P1-1e 我家版+做饭记录页 v6
 */
import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useFandaziStore } from '@/stores/fandaziStore'
import { exportAllData } from '@/lib/dataExport'
import { FantuanIcon } from '@/components/FantuanIcon'
import { readBuddyGroup } from '@/data/familySharing'
import { DISH_PREFERENCES_CHANGE_EVENT, readDishPreferences } from '@/data/dishPreferences'
import './MinePage.css'

type MineTab = 'favorites' | 'dishes' | 'logs' | 'taste' | 'partner'
type MobileCollectionTab = 'dishes' | 'favorites'

function tabFromSection(section: string | null): MineTab {
  if (section === 'favorites') return 'favorites'
  if (section === 'logs') return 'logs'
  if (section === 'taste') return 'taste'
  if (section === 'partner') return 'partner'
  return 'dishes'
}

export function MinePage() {
  const cookingLogs = useFandaziStore((s) => s.cookingLogs)
  const myDishVersions = useFandaziStore((s) => s.myDishVersions)
  const fantuan = useFandaziStore((s) => s.fantuan)
  const getDishById = useFandaziStore((s) => s.getDishById)
  const [searchParams] = useSearchParams()
  const sectionParam = searchParams.get('section')

  const [activeTab, setActiveTab] = useState<MineTab>(() => tabFromSection(sectionParam))
  const [mobileCollectionOpen, setMobileCollectionOpen] = useState(() => Boolean(sectionParam))
  const [mobileCollectionTab, setMobileCollectionTab] = useState<MobileCollectionTab>(() => sectionParam === 'favorites' ? 'favorites' : 'dishes')
  const [dishPreferences, setDishPreferences] = useState(readDishPreferences)
  const tabRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const refreshPreferences = () => setDishPreferences(readDishPreferences())
    window.addEventListener(DISH_PREFERENCES_CHANGE_EVENT, refreshPreferences)
    window.addEventListener('storage', refreshPreferences)
    return () => {
      window.removeEventListener(DISH_PREFERENCES_CHANGE_EVENT, refreshPreferences)
      window.removeEventListener('storage', refreshPreferences)
    }
  }, [])

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const switchTab = (tab: MineTab) => {
    setActiveTab(tab)
    scrollTo(tabRef)
  }

  // 做过的菜（去重）
  const cookedDishIds = new Set(cookingLogs.map((log) => log.dishId))
  const cookedDishes = Array.from(cookedDishIds)
    .map((id) => getDishById(id))
    .filter(Boolean)
  const displayDishes = cookedDishes
  const displayLogs = cookingLogs
  const favoriteDishes = useMemo(
    () => dishPreferences.favorite.map((id) => getDishById(id)).filter(Boolean),
    [dishPreferences.favorite, getDishById],
  )
  const oftenCookedDishes = useMemo(() => {
    const ids = new Set([...dishPreferences.oftenCooked, ...cookingLogs.map((log) => log.dishId)])
    return Array.from(ids).map((id) => getDishById(id)).filter(Boolean)
  }, [cookingLogs, dishPreferences.oftenCooked, getDishById])
  const displayCookedCount = cookedDishes.length
  const displayTotalCooked = fantuan.totalCooked
  const buddyGroup = readBuddyGroup()
  const displayName = localStorage.getItem('fandazi.currentDisplayName') || '我'
  const spicyLabels = ['不辣', '微辣', '中辣', '重辣'] as const
  const saltyLabels = ['偏清淡', '适中', '偏咸'] as const
  const sweetLabels = ['不爱甜', '甜度适中', '偏爱甜'] as const
  const tasteProfile = fantuan.tasteProfile
  const avoidText = tasteProfile.avoid.length > 0 ? tasteProfile.avoid.join('、') : '暂无忌口记录'
  const tasteNote = tasteProfile.note.trim() || '还没有补充口味备注'

  return (
    <div className="mine-page">
      <section className="mobile-mine-card" aria-label="我的">
        <div className="mobile-mine-profile"><div className="mobile-mine-avatar">我</div><div><span>我的饭搭子</span><h1>{displayName}</h1></div><Link to="/health" aria-label="打开健康计划">›</Link></div>
        <div className="mobile-mine-stats"><div><strong>{displayCookedCount}</strong><span>做过的菜</span></div><div><strong>{cookingLogs.length}</strong><span>次记录</span></div><div><strong>{fantuan.mili}</strong><span>米粒</span></div></div>
        <section className="mobile-mine-section"><div className="mobile-mine-section-head"><h2>最近常做</h2><button type="button" onClick={() => { setMobileCollectionOpen(true); setMobileCollectionTab('dishes') }}>查看全部</button></div>{displayDishes.length === 0 ? <p className="mobile-mine-empty">做完一道菜后，它会出现在这里。</p> : <div className="mobile-mine-dishes">{displayDishes.slice(0, 3).map((dish) => dish && <Link key={dish.id} to={`/recipes/${dish.id}`}><span className="mobile-mine-dish-dot">🍽️</span><strong>{dish.name}</strong><small>{cookingLogs.filter((log) => log.dishId === dish.id).length} 次</small></Link>)}</div>}</section>
        <div className="mobile-mine-collection-links" aria-label="我的聚合工具">
          <button type="button" onClick={() => { setMobileCollectionOpen(true); setMobileCollectionTab('dishes') }}><strong>常做菜</strong><small>{oftenCookedDishes.length} 道</small><span>›</span></button>
          <button type="button" onClick={() => { setMobileCollectionOpen(true); setMobileCollectionTab('favorites') }}><strong>收藏</strong><small>{favoriteDishes.length} 道</small><span>›</span></button>
          <Link to="/health"><strong>个人信息</strong><small>健康档案</small><span>›</span></Link>
        </div>
        {mobileCollectionOpen && <section className="mobile-mine-section mobile-mine-collection" aria-label="我的菜品聚合"><div className="mobile-mine-section-head"><h2>{mobileCollectionTab === 'favorites' ? '收藏菜品' : '常做菜'}</h2><button type="button" onClick={() => setMobileCollectionOpen(false)}>收起</button></div><div className="mobile-mine-collection-tabs" role="tablist"><button type="button" role="tab" aria-selected={mobileCollectionTab === 'dishes'} className={mobileCollectionTab === 'dishes' ? 'active' : ''} onClick={() => setMobileCollectionTab('dishes')}>常做菜 <small>{oftenCookedDishes.length}</small></button><button type="button" role="tab" aria-selected={mobileCollectionTab === 'favorites'} className={mobileCollectionTab === 'favorites' ? 'active' : ''} onClick={() => setMobileCollectionTab('favorites')}>收藏 <small>{favoriteDishes.length}</small></button></div>{(mobileCollectionTab === 'favorites' ? favoriteDishes : oftenCookedDishes).length === 0 ? <p className="mobile-mine-empty">{mobileCollectionTab === 'favorites' ? '还没有收藏的菜。去菜品详情点“收藏这道菜”。' : '做过或标记常做的菜会出现在这里。'}</p> : <div className="mobile-mine-dishes">{(mobileCollectionTab === 'favorites' ? favoriteDishes : oftenCookedDishes).map((dish) => dish && <Link key={dish.id} to={`/recipes/${dish.id}`}><span className="mobile-mine-dish-dot">{mobileCollectionTab === 'favorites' ? '♥' : '🍽️'}</span><strong>{dish.name}</strong><small>{mobileCollectionTab === 'favorites' ? '已收藏' : `${cookingLogs.filter((log) => log.dishId === dish.id).length || '常做'}${cookingLogs.some((log) => log.dishId === dish.id) ? ' 次' : ''}`}</small></Link>)}</div>}</section>}
        <section className="mobile-mine-section"><div className="mobile-mine-section-head"><h2>个人工具</h2><span>需要时再打开</span></div><div className="mobile-mine-tools"><Link to="/health"><span>✦</span><strong>健康计划</strong><small>饭团按你的身体需求推荐</small><b>›</b></Link><Link to="/fantuan"><span>☻</span><strong>饭团 AI</strong><small>问它今天怎么吃</small><b>›</b></Link><Link to="/weekly-prep"><span>▤</span><strong>周备餐</strong><small>一次定好这周怎么做</small><b>›</b></Link><Link to="/plan"><span>▦</span><strong>今晚计划</strong><small>查冰箱、采购、开做</small><b>›</b></Link><Link to="/shopping"><span>□</span><strong>购物清单</strong><small>缺什么一次补齐</small><b>›</b></Link><Link to="/family"><span>⌂</span><strong>家庭同步</strong><small>和家人共享冰箱</small><b>›</b></Link></div></section>
      </section>
      {/* Hero */}
      <div className="mine-hero">
        <div className="fd-hero-card">
          <div className="hero-label">本机家庭</div>
          <h2>你家做过 {displayCookedCount} 道菜，饭团帮你记着每次口味调整</h2>
          <p>
            每次标记“做过”后，饭团会问你一句口味反馈，沉淀成你家独有版本。下次做同一道菜，自动带上你的调整。
          </p>
          <div className="cta-row">
            <button className="fd-btn fd-btn-primary" onClick={() => switchTab('dishes')}>看我家菜品</button>
            <button className="fd-btn fd-btn-secondary" onClick={() => switchTab('logs')}>看做饭记录</button>
            <button className="fd-btn fd-btn-green" onClick={exportAllData}>导出我的数据</button>
            <Link to="/privacy" className="fd-btn fd-btn-secondary">隐私政策</Link>
          </div>
        </div>
        <div className="fd-side-card">
          <h4><FantuanIcon name="growth" size={22} /> 饭团状态</h4>
          <div className="fd-list-item">
            <span>米粒</span>
            <strong>🌾 {fantuan.mili}</strong>
          </div>
          <div className="fd-list-item">
            <span>等级</span>
            <strong>Lv.{fantuan.level}</strong>
          </div>
          <div className="fd-list-item">
            <span>累计做菜</span>
            <strong>{displayTotalCooked} 次</strong>
          </div>
        </div>
      </div>

      <section className="fd-panel">
        <div className="hero-label">更多工具</div>
        <h3>需要时再打开</h3>
        <p className="empty-text">这些功能继续保留，但不占用“今天吃什么”的首页。</p>
        <div className="cta-row">
          <Link to="/weekly-prep" className="fd-btn fd-btn-secondary">周备餐</Link>
          <Link to="/plan" className="fd-btn fd-btn-secondary">今晚计划</Link>
          <Link to="/shopping" className="fd-btn fd-btn-secondary">购物清单</Link>
          <Link to="/catalog" className="fd-btn fd-btn-secondary">完整菜品库</Link>
          <button type="button" className="fd-btn fd-btn-secondary" onClick={() => switchTab('dishes')}>常做菜</button>
          <button type="button" className="fd-btn fd-btn-secondary" onClick={() => switchTab('favorites')}>收藏菜品</button>
          <Link to="/ai-kitchen" className="fd-btn fd-btn-secondary">AI 厨房</Link>
          <Link to="/health" className="fd-btn fd-btn-secondary">健康档案</Link>
          <Link to="/family" className="fd-btn fd-btn-secondary">家庭空间</Link>
          <Link to="/sync" className="fd-btn fd-btn-secondary">同步设置</Link>
        </div>
      </section>

      <div className="mine-workspace">
        <main className="mine-main">
          {/* 我家菜品 */}
          <section className="fd-panel" ref={tabRef}>
            <div className="tab-row">
              <button className={`fd-tab ${activeTab === 'dishes' ? 'active' : ''}`} onClick={() => setActiveTab('dishes')}>常做菜</button>
              <button className={`fd-tab ${activeTab === 'favorites' ? 'active' : ''}`} onClick={() => setActiveTab('favorites')}>收藏</button>
              <button className={`fd-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>做饭记录</button>
              <button className={`fd-tab ${activeTab === 'taste' ? 'active' : ''}`} onClick={() => setActiveTab('taste')}>口味偏好</button>
              <button className={`fd-tab ${activeTab === 'partner' ? 'active' : ''}`} onClick={() => setActiveTab('partner')}>搭子偏好</button>
            </div>
            {/* 收藏菜品 */}
            {activeTab === 'favorites' && (
              <>
                <h3>收藏菜品</h3>
                {favoriteDishes.length === 0 ? (
                  <div className="empty-dishes">
                    <p>还没有收藏的菜。去菜品详情点“收藏这道菜”，下次从这里直接打开。</p>
                    <Link className="fd-btn fd-btn-primary" to="/catalog">去菜品库</Link>
                  </div>
                ) : favoriteDishes.map((dish) => dish && (
                  <div key={dish.id} className="mine-dish fd-list-item">
                    <div className="mine-dish-info">
                      <Link to={`/recipes/${dish.id}`} className="mine-dish-name">{dish.name}</Link>
                      <div className="mine-dish-meta"><span>♥ 已收藏</span></div>
                    </div>
                    <Link to={`/recipes/${dish.id}`} className="fd-btn fd-btn-secondary fd-btn-sm">查看</Link>
                  </div>
                ))}
              </>
            )}
            {/* 我家菜品 */}
            {activeTab === 'dishes' && (
              <>
                <h3>常做菜 / 我家菜品</h3>
                {displayDishes.length === 0 ? (
                  <div className="empty-dishes">
                    <p>还没有做过的菜。去计划页标记“做完了”后，这里会沉淀你的我家菜品。</p>
                    <Link className="fd-btn fd-btn-primary" to="/plan">去计划页</Link>
                  </div>
                ) : displayDishes.map((dish) => {
                  if (!dish) return null
                  const myVersion = myDishVersions.find((v) => v.dishId === dish.id)
                  const logCount = cookingLogs.filter((l) => l.dishId === dish.id).length
                  const tweak = myVersion?.myNote?.trim()
                  return (
                    <div key={dish.id} className="mine-dish fd-list-item">
                      <div className="mine-dish-info">
                        <Link to={`/recipes/${dish.id}`} className="mine-dish-name">{dish.name}</Link>
                        <div className="mine-dish-meta">
                          <span>做过 {logCount} 次</span>
                          {myVersion && <span className="fd-badge gold">我家版</span>}
                        </div>
                        <div className="mine-dish-note">
                          <span className="tweak-tag">📝 {tweak || '还没有记录我家调整'}</span>
                        </div>
                      </div>
                      <Link to={`/recipes/${dish.id}`} className="fd-btn fd-btn-secondary fd-btn-sm">查看</Link>
                    </div>
                  )
                })}
              </>
            )}

            {/* 做饭记录 */}
            {activeTab === 'logs' && (
              <>
                <h3>做饭记录</h3>
                {displayLogs.length === 0 ? (
                  <div className="empty-dishes">
                    <p>还没有做饭记录。完成计划后点“做完了”，饭团会把记录和米粒奖励放在这里。</p>
                    <Link className="fd-btn fd-btn-primary" to="/plan">去计划页</Link>
                  </div>
                ) : (
                  <div className="mine-timeline">
                    {displayLogs.slice(0, 20).map((log) => (
                      <div key={log.id} className="record-row fd-list-item">
                        <span className="record-dot">🍳</span>
                        <div className="record-info">
                          <span className="record-date">{log.date}</span>
                          <Link to={`/recipes/${log.dishId}`} className="record-dish-name">
                            {log.dishName}
                          </Link>
                          {log.note && <span className="record-note">💬 {log.note}</span>}
                        </div>
                        <div className="record-reward">+{log.miliReward} 🌾</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* 口味偏好 */}
            {activeTab === 'taste' && (
              <>
                <h3>口味偏好</h3>
                <div className="preference-list">
                  <div className="fd-list-item">
                    <span>咸淡偏好</span>
                    <strong>{saltyLabels[tasteProfile.salty]}</strong>
                  </div>
                  <div className="fd-list-item">
                    <span>辣度偏好</span>
                    <strong>{spicyLabels[tasteProfile.spicy]}</strong>
                  </div>
                  <div className="fd-list-item">
                    <span>甜度偏好</span>
                    <strong>{sweetLabels[tasteProfile.sweet]}</strong>
                  </div>
                  <div className="fd-list-item">
                    <span>忌口</span>
                    <strong>{avoidText}</strong>
                  </div>
                  <div className="fd-list-item">
                    <span>备注</span>
                    <strong>{tasteNote}</strong>
                  </div>
                </div>
                <p className="empty-text">口味偏好来自饭团记录的真实家庭口味档案，可在反馈和健康档案中继续补充。</p>
              </>
            )}

            {/* 搭子偏好 */}
            {activeTab === 'partner' && (
              <>
                <h3>搭子偏好</h3>
                <div className="preference-list">
                  {buddyGroup.members.map((member) => {
                    const restrictions = member.healthProfile.restrictions
                    const preferenceCount = member.preferences.favorite.length + member.preferences.oftenCooked.length
                    return (
                      <div className="fd-list-item" key={member.id}>
                        <span>{member.avatar ?? '🍚'} {member.name}</span>
                        <strong>{restrictions.length > 0 ? `忌口：${restrictions.join('、')}` : `已记录 ${preferenceCount} 项偏好`}</strong>
                      </div>
                    )
                  })}
                </div>
                <p className="empty-text">偏好来自家庭空间成员资料；在家庭空间修改成员偏好后，这里会同步显示摘要。</p>
              </>
            )}
          </section>
        </main>

        <aside className="mine-aside">
          {/* 口味偏好沉淀说明 */}
          <section className="fd-side-card">
            <h4>口味偏好怎么沉淀</h4>
            <div className="preference-flow">
              <div className="fd-list-item">
                <strong>① 做完标记</strong>
                <span className="flow-desc">计划页点“做完了”</span>
              </div>
              <div className="fd-list-item">
                <strong>② 口味反馈</strong>
                <span className="flow-desc">饭团问一句</span>
              </div>
              <div className="fd-list-item">
                <strong>③ 沉淀我家版</strong>
                <span className="flow-desc">调整记到菜谱</span>
              </div>
              <div className="fd-list-item">
                <strong>④ 下次自动带</strong>
                <span className="flow-desc">少踩坑</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
