/**
 * 计划页 — P2-3
 * 对应渲染图：P1-1d 计划+购物联动页 v6
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFandaziStore } from '@/stores/fandaziStore'
import { DISHES } from '@/data/dishes'
import type { PlanStatus } from '@/types'
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

  const [showAdd, setShowAdd] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayStr())

  // 冰箱匹配计算（在 selector 外）
  const pantryNames = new Set(pantry.map((p) => p.ingredientName))
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
      id: Math.random().toString(36).slice(2, 10),
      dishId: feedbackPlan.dishId,
      dishName: feedbackPlan.dishName,
      date: todayStr(),
      rating,
      note: note.trim() || undefined,
      miliReward: 15,
    })
    addMili(15)

    // 如果有备注，沉淀到我家版
    if (note.trim()) {
      const dish = getDishById(feedbackPlan.dishId)
      if (dish) {
        const existing = useFandaziStore.getState().myDishVersions.find((v) => v.dishId === feedbackPlan.dishId)
        upsertMyDishVersion({
          dishId: feedbackPlan.dishId,
          ingredients: existing?.ingredients ?? dish.ingredients,
          steps: existing?.steps ?? dish.steps,
          cookTime: existing?.cookTime ?? dish.cookTime,
          myNote: note.trim(),
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
      id: Math.random().toString(36).slice(2, 10),
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
          <div className="hero-label">今晚 · 我 + 屠老师</div>
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
            <Link to="/shopping"><button className="fd-btn fd-btn-primary">打开购物清单</button></Link>
            <button className="fd-btn fd-btn-secondary" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? '收起加菜' : '让饭团重搭'}
            </button>
            <button className="fd-btn fd-btn-green">标记采购完成</button>
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
        <div className="fd-panel">
          <h3>快速加菜到 {dateLabel(selectedDate)}</h3>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-picker"
          />
          <div className="quick-dishes">
            {DISHES.slice(0, 12).map((dish) => (
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
              <button className="fd-tab active">今天</button>
              <button className="fd-tab">明天</button>
              <button className="fd-tab">本周</button>
              <button className="fd-tab">一起吃</button>
              <button className="fd-tab">带饭</button>
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
                  <Link to="/"><button>查看菜品</button></Link>
                  <button onClick={() => setShowAdd(true)}>调整计划</button>
                  <button className="done" onClick={() => {
                    const firstReal = todayPlans[0]
                    if (firstReal) handleMarkDone(firstReal.id, firstReal.dishId)
                  }}>标记做过</button>
                </div>
              </article>
              <article className="meal-card">
                <div className="meal-head">
                  <div>
                    <h4>明日午餐 · 顺手带饭</h4>
                    <span className="match-info">从今晚剩余食材里顺手安排</span>
                  </div>
                  <span className="fd-badge green">可调整</span>
                </div>
                <div className="meal-dish-row">
                  <div>
                    <strong>鸡胸肉蔬菜便当</strong>
                    <span>复用西兰花 / 鸡胸肉，减少浪费</span>
                  </div>
                  <span className="fd-badge green">省事</span>
                </div>
                <div className="dish-actions"><button>明天再定</button><button>换一道</button></div>
              </article>
            </div>
          </section>
        </div>

        <aside>
          <section className="fd-side-card fantuan-reminder">
            <h4>🍙 饭团提醒</h4>
            <div className="fd-bubble">
              有几道菜还缺食材，去购物清单看看要买什么吧～买完回来标记做过，可以沉淀到我家版。
            </div>
            <div className="cta-row" style={{ marginTop: '14px' }}>
              <Link to="/shopping"><button className="fd-btn fd-btn-primary">看购物清单</button></Link>
            </div>
          </section>
          <section className="fd-side-card">
            <h4>购物补齐</h4>
            {displayPlans.slice(0, 3).map((plan) => {
              const dish = getDishById(plan.dishId)
              const match = getMatchForDish(plan.dishId)
              if (!dish) return null
              return (
                <div key={plan.id} className="fd-list-item">
                  <span>{dish.name}</span>
                  <strong>{match.missing > 0 ? `缺 ${match.missing} 项` : '可做'}</strong>
                </div>
              )
            })}
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
              <h4>🍙 饭团问一下</h4>
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
