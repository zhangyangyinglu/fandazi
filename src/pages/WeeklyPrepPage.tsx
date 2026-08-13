import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DISHES } from '@/data/dishes'
import type { Dish } from '@/types'
import { readBuddyGroup } from '@/data/familySharing'
import { readHealthProfiles } from '@/components/healthProfileStorage'
import { readDailyMealSettings } from '@/data/dailyMeal'
import { useFandaziStore } from '@/stores/fandaziStore'
import {
  buildWeeklyPrepPlan,
  formatWeekDate,
  getPrepAdvice,
  getWeekStart,
  readWeeklyPrepPlan,
  WEEKLY_PREP_CHANGE_EVENT,
  writeWeeklyPrepPlan,
  type WeeklyPrepPlan,
} from '@/data/weeklyPrepPlan'
import './WeeklyPrepPage.css'

function todayWeekStart(): string {
  return getWeekStart(new Date())
}

export function WeeklyPrepPage() {
  const pantry = useFandaziStore((state) => state.pantry)
  const mealPlans = useFandaziStore((state) => state.mealPlans)
  const cookingLogs = useFandaziStore((state) => state.cookingLogs)
  const addMealPlan = useFandaziStore((state) => state.addMealPlan)
  const dailySettings = useMemo(() => readDailyMealSettings(), [])
  const [weekStart, setWeekStart] = useState(todayWeekStart)
  const [plan, setPlan] = useState<WeeklyPrepPlan | null>(() => readWeeklyPrepPlan(todayWeekStart()))
  const [mealsPerDay, setMealsPerDay] = useState<1 | 2>(() => (dailySettings.mealsPerDay === 2 ? 2 : 1))
  const [servings, setServings] = useState(() => Math.max(1, Math.min(3, dailySettings.people)))
  const [message, setMessage] = useState('')

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setPlan(readWeeklyPrepPlan(weekStart))
    setMessage('')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [weekStart])

  // 监听周备餐变更（本机操作 + 云端其他设备同步）
  useEffect(() => {
    const refresh = () => setPlan(readWeeklyPrepPlan(weekStart))
    window.addEventListener(WEEKLY_PREP_CHANGE_EVENT, refresh)
    const onCloud = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail) {
        writeWeeklyPrepPlan(detail)
      }
      refresh()
    }
    window.addEventListener('fandazi:weekly-prep-cloud', onCloud)
    return () => {
      window.removeEventListener(WEEKLY_PREP_CHANGE_EVENT, refresh)
      window.removeEventListener('fandazi:weekly-prep-cloud', onCloud)
    }
  }, [weekStart])

  const dishById = useMemo(() => new Map(DISHES.map((dish) => [dish.id, dish])), [])

  // 换菜功能：记录当前正在替换的位置
  // targetKey 格式: `day:{date}:{mealLabel}:{dishIndex}` 或 `batch:{batchId}:{dishIndex}`
  const [swapTarget, setSwapTarget] = useState<string | null>(null)
  const [swapSearch, setSwapSearch] = useState('')

  const swapDishes = useMemo(() => {
    const usedIds = new Set<string>()
    if (plan) {
      plan.days.forEach((d) => d.meals.forEach((m) => m.dishIds.forEach((id) => usedIds.add(id))))
      plan.batches.forEach((b) => b.dishIds.forEach((id) => usedIds.add(id)))
    }
    const query = swapSearch.trim().toLowerCase()
    return DISHES.filter((dish) => {
      if (swapTarget && usedIds.has(dish.id)) return false
      if (!query) return true
      return dish.name.toLowerCase().includes(query)
        || dish.tags.some((t) => t.toLowerCase().includes(query))
        || dish.category.toLowerCase().includes(query)
    }).slice(0, 24)
  }, [plan, swapTarget, swapSearch])

  const handleSwapDish = (dish: Dish) => {
    if (!plan || !swapTarget) return
    const [scope, ...rest] = swapTarget.split(':')
    const updated: WeeklyPrepPlan = { ...plan, days: [...plan.days], batches: [...plan.batches] }

    if (scope === 'day') {
      const [date, mealLabel, idxStr] = rest
      const dayIndex = updated.days.findIndex((d) => d.date === date)
      if (dayIndex < 0) return
      const day = { ...updated.days[dayIndex], meals: [...updated.days[dayIndex].meals] }
      const mealIndex = day.meals.findIndex((m) => m.label === mealLabel)
      if (mealIndex < 0) return
      const meal = { ...day.meals[mealIndex], dishIds: [...day.meals[mealIndex].dishIds] }
      const idx = Number.parseInt(idxStr, 10)
      meal.dishIds[idx] = dish.id
      day.meals[mealIndex] = meal
      updated.days[dayIndex] = day
    } else if (scope === 'batch') {
      const [batchId, idxStr] = rest
      const batchIndex = updated.batches.findIndex((b) => b.id === batchId)
      if (batchIndex < 0) return
      const batch = { ...updated.batches[batchIndex], dishIds: [...updated.batches[batchIndex].dishIds] }
      const idx = Number.parseInt(idxStr, 10)
      batch.dishIds[idx] = dish.id
      updated.batches[batchIndex] = batch
      // 同步更新该批次对应日期的菜品
      batch.dates.forEach((date) => {
        const dayIndex = updated.days.findIndex((d) => d.date === date)
        if (dayIndex < 0) return
        const day = { ...updated.days[dayIndex], meals: [...updated.days[dayIndex].meals] }
        day.meals.forEach((meal, mealIndex) => {
          meal.dishIds.forEach((oldId, dishIdx) => {
            const oldBatchIndex = plan.batches.findIndex((b) => b.dishIds.includes(oldId) && b.id === batchId)
            if (oldBatchIndex >= 0) {
              const oldDishIdx = plan.batches[oldBatchIndex].dishIds.indexOf(oldId)
              if (oldDishIdx === idx) {
                const newMeal = { ...day.meals[mealIndex], dishIds: [...day.meals[mealIndex].dishIds] }
                newMeal.dishIds[dishIdx] = dish.id
                day.meals[mealIndex] = newMeal
              }
            }
          })
        })
        updated.days[dayIndex] = day
      })
    }

    writeWeeklyPrepPlan(updated)
    setPlan(updated)
    setSwapTarget(null)
    setSwapSearch('')
  }

  // 删菜：从计划中移除当前选中位置的菜品
  const handleRemoveDish = () => {
    if (!plan || !swapTarget) return
    const [scope, ...rest] = swapTarget.split(':')
    const updated: WeeklyPrepPlan = { ...plan, days: [...plan.days], batches: [...plan.batches] }

    if (scope === 'day') {
      const [date, mealLabel, idxStr] = rest
      const dayIndex = updated.days.findIndex((d) => d.date === date)
      if (dayIndex < 0) return
      const day = { ...updated.days[dayIndex], meals: [...updated.days[dayIndex].meals] }
      const mealIndex = day.meals.findIndex((m) => m.label === mealLabel)
      if (mealIndex < 0) return
      const meal = { ...day.meals[mealIndex], dishIds: [...day.meals[mealIndex].dishIds] }
      const idx = Number.parseInt(idxStr, 10)
      meal.dishIds.splice(idx, 1)
      day.meals[mealIndex] = meal
      updated.days[dayIndex] = day
    } else if (scope === 'batch') {
      const [batchId, idxStr] = rest
      const batchIndex = updated.batches.findIndex((b) => b.id === batchId)
      if (batchIndex < 0) return
      const batch = { ...updated.batches[batchIndex], dishIds: [...updated.batches[batchIndex].dishIds] }
      const idx = Number.parseInt(idxStr, 10)
      const removedId = batch.dishIds[idx]
      batch.dishIds.splice(idx, 1)
      updated.batches[batchIndex] = batch
      // 同步删除该批次对应日期里的同一道菜
      if (removedId) {
        batch.dates.forEach((date) => {
          const dIndex = updated.days.findIndex((d) => d.date === date)
          if (dIndex < 0) return
          const day = { ...updated.days[dIndex], meals: [...updated.days[dIndex].meals] }
          day.meals.forEach((meal, mealIndex) => {
            const newIds = meal.dishIds.filter((id) => id !== removedId)
            if (newIds.length !== meal.dishIds.length) {
              day.meals[mealIndex] = { ...meal, dishIds: newIds }
            }
          })
          updated.days[dIndex] = day
        })
      }
    }

    writeWeeklyPrepPlan(updated)
    setPlan(updated)
    setSwapTarget(null)
    setSwapSearch('')
  }

  const generatePlan = () => {
    const nextPlan = buildWeeklyPrepPlan({
      weekStart,
      dishes: DISHES,
      pantryItems: pantry.map((item) => item.ingredientName),
      mealPlans,
      cookingLogs,
      dailySettings,
      mealsPerDay,
      servings,
      buddyGroup: readBuddyGroup(),
      healthProfiles: readHealthProfiles(),
    })
    writeWeeklyPrepPlan(nextPlan)
    setPlan(nextPlan)
    setMessage('本周草案已生成。现在只是在看安排，还没有写入每日计划。')
  }

  const confirmPlan = () => {
    if (!plan) return
    plan.days.forEach((day) => day.meals.forEach((meal) => meal.dishIds.forEach((dishId) => addMealPlan(dishId, day.date))))
    const confirmed = { ...plan, status: 'confirmed' as const }
    writeWeeklyPrepPlan(confirmed)
    setPlan(confirmed)
    setMessage('本周安排已写入每日计划；之后仍可在“今晚计划”里调整单天安排。')
  }

  return (
    <div className="weekly-prep-page">
      <section className="weekly-prep-hero">
        <div className="fd-hero-card">
          <div className="hero-label">周备餐计划</div>
          <h1>先把这周的饭定下来</h1>
          <p>每周规划一次，按 2～3 天分批准备；每天从已有备餐里自由组合，不再临时想今天吃什么。</p>
          <div className="weekly-prep-controls" aria-label="周备餐设置">
            <label>
              <span>本周从</span>
              <input
                type="date"
                value={weekStart}
                onChange={(event) => setWeekStart(getWeekStart(event.target.value))}
              />
            </label>
            <label>
              <span>每天</span>
              <select value={mealsPerDay} onChange={(event) => setMealsPerDay(Number(event.target.value) as 1 | 2)}>
                <option value="1">1 餐</option>
                <option value="2">2 餐</option>
              </select>
            </label>
            <label>
              <span>按</span>
              <select value={servings} onChange={(event) => setServings(Number(event.target.value))}>
                <option value="1">1 人份</option>
                <option value="2">2 人份</option>
                <option value="3">3 人份</option>
              </select>
            </label>
            <button type="button" className="fd-btn fd-btn-primary" onClick={generatePlan}>
              {plan ? '重新生成草案' : '生成本周草案'}
            </button>
          </div>
          {message && <p className="weekly-prep-message" role="status">{message}</p>}
        </div>
        <aside className="fd-side-card weekly-prep-side-note">
          <h3>这不是另一套菜谱</h3>
          <p>周计划负责提前安排；“今晚计划”负责当天查冰箱、采购、开做和记录。</p>
          <div className="weekly-prep-mini-flow">
            <span>① 定一周</span><b>→</b><span>② 分批做</span><b>→</b><span>③ 自由吃</span>
          </div>
          <Link to="/plan" className="fd-btn fd-btn-secondary">看今晚计划</Link>
        </aside>
      </section>

      {!plan ? (
        <section className="fd-panel weekly-prep-empty">
          <div className="weekly-prep-empty-mark">▦</div>
          <h2>本周还没有备餐安排</h2>
          <p>先生成一份草案，确认前不会改动每日计划，也不会写入购物清单。</p>
          <button type="button" className="fd-btn fd-btn-primary" onClick={generatePlan}>生成本周草案</button>
        </section>
      ) : (
        <>
          <section className="fd-panel weekly-prep-section">
            <div className="weekly-prep-section-head">
              <div>
                <div className="hero-label">{formatWeekDate(plan.weekStart)}～{formatWeekDate(plan.weekEnd)}</div>
                <h2>本周怎么吃</h2>
              </div>
              <span className={`fd-badge ${plan.status === 'confirmed' ? 'green' : 'gold'}`}>
                {plan.status === 'confirmed' ? '已写入每日计划' : '草案，待确认'}
              </span>
            </div>
            <div className="weekly-prep-days">
              {plan.days.map((day) => (
                <article className="weekly-prep-day" key={day.date}>
                  <div className="weekly-prep-day-head">
                    <strong>{day.weekday}</strong>
                    <span>{formatWeekDate(day.date)}</span>
                  </div>
                  {day.meals.map((meal) => (
                    <div className="weekly-prep-meal" key={`${day.date}-${meal.label}`}>
                      <span className="weekly-prep-meal-label">{meal.label}</span>
                      {meal.dishIds.length === 0 ? <em>暂时没有合适安排</em> : meal.dishIds.map((dishId, dishIdx) => {
                        const dish = dishById.get(dishId)
                        if (!dish) return null
                        const advice = getPrepAdvice(dish)
                        const swapKey = `day:${day.date}:${meal.label}:${dishIdx}`
                        return (
                          <div className="weekly-prep-dish" key={dish.id}>
                            <div className="weekly-prep-dish-row">
                              <Link to={`/recipes/${dish.id}`} state={{ from: '/weekly-prep' }}>{dish.name}</Link>
                              <button
                                type="button"
                                className="weekly-prep-swap-btn"
                                aria-label={`替换${dish.name}`}
                                onClick={() => { setSwapTarget(swapKey); setSwapSearch('') }}
                              >换一道</button>
                            </div>
                            <small className={advice.mode === 'fresh' ? 'fresh' : 'batch'}>{advice.label}</small>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </section>

          <section className="weekly-prep-batch-grid">
            {plan.batches.map((batch) => (
              <article className="fd-panel weekly-prep-batch" key={batch.id}>
                <div className="hero-label">{batch.rangeLabel}</div>
                <h3>{batch.title}</h3>
                <p>{batch.note}</p>
                <div className="weekly-prep-batch-dishes">
                  {batch.dishIds.length === 0 ? <span>这一批暂时没有菜</span> : batch.dishIds.map((dishId, dishIdx) => {
                    const dish = dishById.get(dishId)
                    if (!dish) return null
                    const swapKey = `batch:${batch.id}:${dishIdx}`
                    return (
                      <div className="weekly-prep-batch-dish" key={dish.id}>
                        <Link to={`/recipes/${dish.id}`} state={{ from: '/weekly-prep' }}>{dish.name}</Link>
                        <button
                          type="button"
                          className="weekly-prep-swap-btn"
                          aria-label={`替换${dish.name}`}
                          onClick={() => { setSwapTarget(swapKey); setSwapSearch('') }}
                        >换</button>
                      </div>
                    )
                  })}
                </div>
              </article>
            ))}
          </section>

          {swapTarget && (
            <>
              {/* 遮罩层 */}
              <div className="weekly-prep-swap-overlay" onClick={() => { setSwapTarget(null); setSwapSearch('') }} />
              {/* 浮层弹窗 */}
              <section className="fd-panel weekly-prep-swap-panel" role="dialog" aria-label="选择替换菜品">
                <div className="weekly-prep-swap-head">
                  <h3>选一道菜替换</h3>
                  <button type="button" className="weekly-prep-swap-close" aria-label="取消替换" onClick={() => { setSwapTarget(null); setSwapSearch('') }}>✕</button>
                </div>
                <input
                  type="search"
                  className="weekly-prep-swap-search"
                  placeholder="搜菜名、标签、分类…"
                  value={swapSearch}
                  onChange={(e) => setSwapSearch(e.target.value)}
                  autoFocus
                />
                <div className="weekly-prep-swap-list">
                  {swapDishes.length === 0 ? (
                    <p className="weekly-prep-swap-empty">没有可选的菜了，试试搜索别的名字。</p>
                  ) : swapDishes.map((dish) => {
                    const advice = getPrepAdvice(dish)
                    return (
                      <button
                        key={dish.id}
                        type="button"
                        className="weekly-prep-swap-item"
                        onClick={() => handleSwapDish(dish)}
                      >
                        <strong>{dish.name}</strong>
                        <span>{dish.category} · {dish.cookTime} · {advice.label}</span>
                      </button>
                    )
                  })}
                </div>
                {/* 删菜：不要这道菜 */}
                <button
                  type="button"
                  className="weekly-prep-swap-remove"
                  onClick={() => handleRemoveDish()}
                >
                  不要这道菜
                </button>
              </section>
            </>
          )}

          <section className="fd-panel weekly-prep-confirm">
            <div>
              <h3>确认后会发生什么</h3>
              <p>只会把这份草案里的菜写入对应日期的每日计划，不会删除你已经存在的安排；确认后仍可按天调整。</p>
            </div>
            <button type="button" className="fd-btn fd-btn-primary" onClick={confirmPlan} disabled={plan.status === 'confirmed'}>
              {plan.status === 'confirmed' ? '本周已确认' : '确认并写入每日计划'}
            </button>
          </section>
        </>
      )}
    </div>
  )
}
