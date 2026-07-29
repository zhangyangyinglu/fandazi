/**
 * 计划页 — P2-3
 * 对应渲染图：P1-1d 计划+购物联动页 v6
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useFandaziStore } from '@/stores/fandaziStore'
import { DISHES } from '@/data/dishes'
import type { PlanStatus } from '@/types'
import { FantuanIcon } from '@/components/FantuanIcon'
import './PlanPage.css'

const STATUS_INFO: Record<PlanStatus, { text: string; cls: string }> = {
  planned: { text: '已计划', cls: '' },
  shopping_done: { text: '已采购', cls: 'gold' },
  cooking: { text: '在做', cls: 'gold' },
  done: { text: '已完成', cls: 'green' },
  skipped: { text: '跳过', cls: 'red' },
  favorited: { text: '收藏', cls: 'gold' },
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function tomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function dayAfterTomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  return d.toISOString().slice(0, 10)
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === -1) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function PlanPage() {
  const mealPlans = useFandaziStore((s) => s.mealPlans)
  const addMealPlan = useFandaziStore((s) => s.addMealPlan)
  const updatePlanStatus = useFandaziStore((s) => s.updatePlanStatus)
  const pantry = useFandaziStore((s) => s.pantry)
  const getDishById = useFandaziStore((s) => s.getDishById)
  const addMili = useFandaziStore((s) => s.addMili)
  const addCookingLog = useFandaziStore((s) => s.addCookingLog)
  const upsertMyDishVersion = useFandaziStore((s) => s.upsertMyDishVersion)

  // 做完后的口味反馈弹窗
  const [feedbackPlan, setFeedbackPlan] = useState<{
    planId: string
    dishId: string
    dishName: string
  } | null>(null)
  const [rating, setRating] = useState<'good' | 'ok' | 'bad'>('good')
  const [note, setNote] = useState('')

  // 计划页的加菜入口默认展开：来源和可选范围直接可见，不再藏在按钮后面。
  const [showAdd, setShowAdd] = useState(true)
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [quickDishQuery, setQuickDishQuery] = useState('')
  const quickAddRef = useRef<HTMLDivElement>(null)
  const quickSearchRef = useRef<HTMLInputElement>(null)

  // 冰箱匹配计算（在 selector 外）
  const pantryNames = useMemo(() => new Set(pantry.map((p) => p.ingredientName)), [pantry])
  const getMatchForDish = (dishId: string) => {
    const dish = getDishById(dishId)
    if (!dish) return { have: 0, missing: 0 }
    const have = dish.ingredients.filter((ing) => pantryNames.has(ing.name)).length
    const missing = dish.ingredients.length - have
    return { have, missing }
  }

  const todayPlans = mealPlans.filter((p) => p.planDate === selectedDate)
  const displayPlans = todayPlans.length > 0
    ? todayPlans
    : [
        { id: 'demo-plan-1', dishId: 'broccoli-chicken-egg', status: 'planned' as PlanStatus, planDate: selectedDate, createdAt: '', updatedAt: '' },
        { id: 'demo-plan-2', dishId: 'tomato-tofu-shrimp-soup', status: 'planned' as PlanStatus, planDate: selectedDate, createdAt: '', updatedAt: '' },
        { id: 'demo-plan-3', dishId: 'asparagus-shrimp-mushroom', status: 'shopping_done' as PlanStatus, planDate: selectedDate, createdAt: '', updatedAt: '' },
      ]
  const displayMissingTotal = displayPlans.reduce((sum, plan) => sum + getMatchForDish(plan.dishId).missing, 0)
  const displayDoneCount = displayPlans.filter((p) => p.status === 'done').length
  const isDemoPlan = todayPlans.length === 0
  const upcomingPlans = mealPlans
    .filter((p) => p.planDate > selectedDate)
    .sort((a, b) => a.planDate.localeCompare(b.planDate))
  const tomorrowPlans = mealPlans.filter((p) => p.planDate === tomorrowStr())

  const quickDishes = useMemo(() => {
    const query = quickDishQuery.trim().toLowerCase()
    if (!query) return DISHES
    return DISHES.filter((dish) => (
      dish.name.toLowerCase().includes(query)
      || dish.category.toLowerCase().includes(query)
      || dish.tags.some((tag) => tag.toLowerCase().includes(query))
      || dish.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(query))
    ))
  }, [quickDishQuery])

  const openQuickAdd = () => {
    setShowAdd(true)
    window.requestAnimationFrame(() => {
      quickAddRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      quickSearchRef.current?.focus()
    })
  }

  useEffect(() => {
    if (!showAdd) return
    window.requestAnimationFrame(() => quickAddRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [showAdd])

  const handleMarkDone = (planId: string, dishId: string) => {
    const dish = getDishById(dishId)
    if (!dish) return
    // 弹出口味反馈
    setFeedbackPlan({ planId, dishId, dishName: dish.name })
    setRating('good')
    setNote('')
  }

  const handleSubmitFeedback = () => {
    if (!feedbackPlan) return
    updatePlanStatus(feedbackPlan.planId, 'done')
    addCookingLog({
      id: crypto.randomUUID(),
      dishId: feedbackPlan.dishId,
      dishName: feedbackPlan.dishName,
      date: todayStr(),
      rating,
      note: note.trim() || undefined,
      miliReward: 15,
    })
    addMili(15)

    // 如果有备注或口味评分，沉淀到我家版
    if (note.trim() || rating) {
      const dish = getDishById(feedbackPlan.dishId)
      if (dish) {
        const existing = useFandaziStore.getState().myDishVersions.find((v) => v.dishId === feedbackPlan.dishId)
        upsertMyDishVersion({
          dishId: feedbackPlan.dishId,
          ingredients: existing?.ingredients ?? dish.ingredients,
          steps: existing?.steps ?? dish.steps,
          cookTime: existing?.cookTime ?? dish.cookTime,
          myNote: note.trim() || existing?.myNote || '',
          rating: rating || existing?.rating,
          createdAt: existing?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        })
      }
    }

    setFeedbackPlan(null)
    setNote('')
  }

  const handleSkipFeedback = () => {
    if (!feedbackPlan) return
    updatePlanStatus(feedbackPlan.planId, 'done')
    addCookingLog({
      id: crypto.randomUUID(),
      dishId: feedbackPlan.dishId,
      dishName: feedbackPlan.dishName,
      date: todayStr(),
      miliReward: 15,
    })
    addMili(15)
    setFeedbackPlan(null)
  }

  return (
    <div className="plan-page">
      {/* Hero */}
      <div className="plan-hero">
        <div className="fd-hero-card">
          <div className="hero-label">今晚计划</div>
          <h2>
            {displayMissingTotal > 0
              ? `今晚计划差 ${displayMissingTotal} 样食材，买完就能开做`
              : '今晚计划已就绪，可以开做'}
          </h2>
          <p>
            {isDemoPlan
              ? '西兰花鸡胸肉炒蛋、番茄豆腐虾仁汤与芦笋虾仁炒口蘑已排进今晚示例计划；购物清单会按菜品来源自动分组。'
              : `已计划 ${displayPlans.length} 道菜，做完后自动沉淀到我家版。`}
          </p>
          <div className="cta-row">
            <Link to="/shopping" className="fd-btn fd-btn-primary">打开购物清单</Link>
            <button className="fd-btn fd-btn-secondary" onClick={() => showAdd ? setShowAdd(false) : openQuickAdd()}>
              {showAdd ? '收起加菜' : <><FantuanIcon name="takeout" size={20} /> 让饭团重搭</>}
            </button>
            <button
              className="fd-btn fd-btn-green"
              onClick={() => {
                todayPlans
                  .filter((p) => p.status === 'planned')
                  .forEach((p) => updatePlanStatus(p.id, 'shopping_done'))
              }}
              disabled={todayPlans.length === 0}
            >
              标记采购完成
            </button>
          </div>
        </div>
        <div className="fd-side-card plan-summary-card">
          <h4>今日状态</h4>
          <div className="fd-list-item">
            <span>计划菜品</span>
            <strong>{displayPlans.length} 道</strong>
          </div>
          <div className="fd-list-item">
            <span>缺失食材</span>
            <strong>{displayMissingTotal} 项</strong>
          </div>
          <div className="fd-list-item">
            <span>采购完成</span>
            <strong>{displayDoneCount} / {displayPlans.length}</strong>
          </div>
          <div className="fd-list-item">
            <span>饭团副本</span>
            <strong>2 / 4</strong>
          </div>
        </div>
      </div>

      <div className="plan-flow">
        <div className="flow-step active"><strong>1 选菜</strong><span>今晚想吃</span></div>
        <div className="flow-step active"><strong>2 查冰箱</strong><span>已有 / 缺少</span></div>
        <div className="flow-step active"><strong>3 购物</strong><span>按菜分组</span></div>
        <div className="flow-step"><strong>4 做完</strong><span>记录口味</span></div>
        <div className="flow-step"><strong>5 我家版</strong><span>自动沉淀</span></div>
      </div>

      {/* 快速加菜 */}
      {showAdd && (
        <div id="quick-add-panel" className="fd-panel quick-add-panel" ref={quickAddRef}>
          <h3>快速加菜到 {dateLabel(selectedDate)}</h3>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-picker"
          />
          <div className="quick-dish-toolbar">
            <input
              className="quick-dish-search"
              value={quickDishQuery}
              onChange={(event) => setQuickDishQuery(event.target.value)}
              ref={quickSearchRef}
              placeholder={`搜索 ${DISHES.length} 道菜品…`}
              aria-label="搜索可加入计划的菜品"
            />
            <span>显示 {quickDishes.length} / {DISHES.length} 道</span>
          </div>
          <div className="quick-dishes">
            {quickDishes.map((dish) => (
              <button
                key={dish.id}
                className="quick-dish-btn"
                onClick={() => addMealPlan(dish.id, selectedDate)}
              >
                + {dish.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="plan-workspace">
        <div>
          <section className="fd-panel">
            <div className="day-tabs">
              <button
                className={`fd-tab ${selectedDate === todayStr() ? 'active' : ''}`}
                onClick={() => setSelectedDate(todayStr())}
              >今天</button>
              <button
                className={`fd-tab ${selectedDate === tomorrowStr() ? 'active' : ''}`}
                onClick={() => setSelectedDate(tomorrowStr())}
              >明天</button>
              <button
                className={`fd-tab ${selectedDate === dayAfterTomorrowStr() ? 'active' : ''}`}
                onClick={() => setSelectedDate(dayAfterTomorrowStr())}
              >后天</button>
            </div>
            <h3>今日计划</h3>
            <div className="meal-grid">
              <article className="meal-card">
                <div className="meal-head">
                  <div>
                    <h4>晚餐 · 日常一起吃</h4>
                    <span className="match-info">2 人 · 预计 35 分钟</span>
                  </div>
                  <span className="fd-badge gold">采购中</span>
                </div>
                {displayPlans.map((plan) => {
                  const dish = getDishById(plan.dishId)
                  if (!dish) return null
                  const match = getMatchForDish(plan.dishId)
                  return (
                    <div key={plan.id} className="meal-dish-row">
                      <div>
                        <Link to={`/recipes/${dish.id}`} className="plan-dish-name">{dish.name}</Link>
                        <span>已有 {match.have}/{match.have + match.missing}{match.missing > 0 ? ` · 缺 ${match.missing} 项` : ' · 可直接做'}</span>
                      </div>
                      <span className={`fd-badge ${match.missing > 0 ? 'red' : 'green'}`}>{match.missing > 0 ? '需采购' : '可做'}</span>
                    </div>
                  )
                })}
                <div className="dish-actions">
                  <Link to="/">查看菜品</Link>
                  <button onClick={openQuickAdd}>调整计划</button>
                  <button className="done" onClick={() => {
                    const targetPlan = todayPlans[0] ?? displayPlans[0]
                    if (targetPlan) handleMarkDone(targetPlan.id, targetPlan.dishId)
                  }}>标记做过</button>
                </div>
              </article>
              <article className="meal-card">
                <div className="meal-head">
                  <div>
                    <h4>明日午餐 · 顺手带饭</h4>
                    <span className="match-info">
                      {tomorrowPlans.length > 0
                        ? `已计划 ${tomorrowPlans.length} 道菜`
                        : '还没排明日午餐，去计划页加一道吧'}
                    </span>
                  </div>
                  <span className={`fd-badge ${tomorrowPlans.length > 0 ? 'green' : ''}`}>
                    {tomorrowPlans.length > 0 ? '可调整' : '待规划'}
                  </span>
                </div>
                {tomorrowPlans.length > 0 ? (
                  tomorrowPlans.map((plan) => {
                    const dish = getDishById(plan.dishId)
                    if (!dish) return null
                    const match = getMatchForDish(plan.dishId)
                    return (
                      <div key={plan.id} className="meal-dish-row">
                        <div>
                          <Link to={`/recipes/${dish.id}`} className="plan-dish-name">{dish.name}</Link>
                          <span>已有 {match.have}/{match.have + match.missing}{match.missing > 0 ? ` · 缺 ${match.missing} 项` : ' · 可直接做'}</span>
                        </div>
                        <span className={`fd-badge ${match.missing > 0 ? 'red' : 'green'}`}>{match.missing > 0 ? '需采购' : '可做'}</span>
                      </div>
                    )
                  })
                ) : (
                  <div className="meal-dish-row">
                    <div>
                      <strong>明日午餐待规划</strong>
                      <span>从今晚剩余食材里顺手安排，减少浪费</span>
                    </div>
                    <button
                      className="fd-btn fd-btn-secondary"
                      onClick={() => {
                        const t = tomorrowStr()
                        setSelectedDate(t)
                        openQuickAdd()
                      }}
                    >
                      去加菜
                    </button>
                  </div>
                )}
                {tomorrowPlans.length > 0 && (
                  <div className="dish-actions">
                    <button onClick={() => {
                      setSelectedDate(tomorrowStr())
                      openQuickAdd()
                    }}>调整计划</button>
                  </div>
                )}
              </article>
            </div>
          </section>
        </div>

        <aside>
          <section className="fd-side-card pantry-shopping-note">
            <h4>🛒 购物补齐</h4>
            <div className="sticky-note-list">
              {displayPlans.slice(0, 3).map((plan) => {
                const dish = getDishById(plan.dishId)
                const match = getMatchForDish(plan.dishId)
                if (!dish) return null
                return (
                  <div key={plan.id} className="fd-list-item sticky-note-item">
                    <span>{dish.name}</span>
                    <strong>{match.missing > 0 ? `缺 ${match.missing} 项` : '可做'}</strong>
                  </div>
                )
              })}
            </div>
          </section>
        </aside>
      </div>

      {/* 后续计划 */}
      {upcomingPlans.length > 0 && (
        <div className="fd-panel">
          <h3>后续计划</h3>
          {upcomingPlans.map((plan) => {
            const dish = getDishById(plan.dishId)
            if (!dish) return null
            return (
              <div key={plan.id} className="plan-row fd-list-item">
                <div className="plan-row-info">
                  <span className="plan-date-label">{dateLabel(plan.planDate)}</span>
                  <Link to={`/recipes/${dish.id}`} className="plan-dish-name">{dish.name}</Link>
                </div>
                <span className={`fd-badge ${STATUS_INFO[plan.status].cls}`}>
                  {STATUS_INFO[plan.status].text}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 口味反馈弹窗 */}
      {feedbackPlan && (
        <div className="feedback-overlay" onClick={() => handleSkipFeedback()}>
          <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
            <div className="feedback-bubble">
              <h4><FantuanIcon name="chat" size={22} /> 饭团问一下</h4>
              <p className="feedback-dish-name">{feedbackPlan.dishName} 做好了吗？</p>
              <p className="feedback-question">今天这道菜味道怎么样？</p>
              <div className="feedback-ratings">
                <button
                  className={rating === 'good' ? 'fd-btn fd-btn-green active' : 'fd-btn fd-btn-secondary'}
                  onClick={() => setRating('good')}
                >😋 好吃</button>
                <button
                  className={rating === 'ok' ? 'fd-btn fd-btn-green active' : 'fd-btn fd-btn-secondary'}
                  onClick={() => setRating('ok')}
                >😐 还行</button>
                <button
                  className={rating === 'bad' ? 'fd-btn fd-btn-green active' : 'fd-btn fd-btn-secondary'}
                  onClick={() => setRating('bad')}
                >🤔 一般</button>
              </div>
              <textarea
                className="feedback-note"
                placeholder="有什么要调整的？比如盐少放点、番茄多一个…（可选）"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
              <div className="feedback-actions">
                <button className="fd-btn fd-btn-secondary" onClick={handleSkipFeedback}>跳过</button>
                <button className="fd-btn fd-btn-primary" onClick={handleSubmitFeedback}>
                  记下来 +🌾15
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
