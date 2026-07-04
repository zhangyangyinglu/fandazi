import { useEffect, useMemo, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useFandaziStore } from '@/stores/fandaziStore'
import { readHealthProfiles } from '@/components/healthProfileStorage'
import { checkPlateStructure } from '@/data/healthRecommend'
import { DISHES } from '@/data/dishes'
import './FloatingFantuan.css'

type FantuanInsight = {
  message: string
  link?: string
  linkLabel?: string
  priority: 'high' | 'medium' | 'low'
}

function useFantuanInsights() {
  const pantry = useFandaziStore((s) => s.pantry)
  const mealPlans = useFandaziStore((s) => s.mealPlans)
  const location = useLocation()
  const [healthProfileCount, setHealthProfileCount] = useState(0)

  useEffect(() => {
    setHealthProfileCount(readHealthProfiles().length)
  }, [location.pathname])

  return useMemo<FantuanInsight[]>(() => {
    const insights: FantuanInsight[] = []
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)

    // 1. 冰箱快过期食材
    const expiringSoon = pantry.filter((item) => {
      if (!item.bestBeforeAt) return false
      const diff = (new Date(item.bestBeforeAt).getTime() - today.getTime()) / 86_400_000
      return diff <= 2 && diff >= -1
    })
    if (expiringSoon.length > 0) {
      const names = expiringSoon.slice(0, 3).map((i) => i.ingredientName).join('、')
      insights.push({
        message: `${names}快过期了，优先搭一桌吧。`,
        link: '/pantry',
        linkLabel: '看冰箱',
        priority: 'high',
      })
    }

    // 2. 今日计划缺口
    const todayPlans = mealPlans.filter((p) => p.planDate === todayStr)
    if (todayPlans.length === 0) {
      insights.push({
        message: '今天还没安排计划，先搭一版？',
        link: '/plan',
        linkLabel: '去计划',
        priority: 'medium',
      })
    } else {
      const plannedDishes = todayPlans
        .map((p) => DISHES.find((d) => d.id === p.dishId))
        .filter(Boolean) as typeof DISHES
      const plate = checkPlateStructure(plannedDishes)
      if (plate.gaps.length > 0) {
        insights.push({
          message: `今天计划${plate.gaps.join('、')}，补一道？`,
          link: '/plan',
          linkLabel: '补缺口',
          priority: 'medium',
        })
      }
    }

    // 3. 健康问卷未填
    if (healthProfileCount === 0) {
      insights.push({
        message: '还没填健康问卷，推荐只按 2026 指南默认走。填了更精准。',
        link: '/health',
        linkLabel: '去填写',
        priority: 'low',
      })
    }

    // 4. 页面特定提示
    const path = location.pathname
    if (path.startsWith('/pantry') && insights.length === 0) {
      insights.push({ message: '冰箱里的食材够搭好几桌了。', priority: 'low' })
    }
    if (path.startsWith('/ai-kitchen') && insights.length === 0) {
      insights.push({ message: 'AI Key 用你自己的，公开 Demo 不读取私人数据。', priority: 'low' })
    }
    if (path.startsWith('/fantuan')) {
      insights.unshift({ message: '我一直在，不只是一个页面里的状态数字。', priority: 'low' })
    }

    // 按优先级排序
    const order = { high: 0, medium: 1, low: 2 }
    insights.sort((a, b) => order[a.priority] - order[b.priority])

    return insights.slice(0, 3)
  }, [pantry, mealPlans, location.pathname, healthProfileCount])
}

export function FloatingFantuan() {
  const [open, setOpen] = useState(false)
  const fantuan = useFandaziStore((s) => s.fantuan)
  const insights = useFantuanInsights()

  return (
    <aside className={open ? 'floating-fantuan open' : 'floating-fantuan'} aria-label="全局饭团助手">
      {open && (
        <div className="fantuan-popover">
          <div className="fantuan-popover-head">
            <strong>饭团在这里</strong>
            <span>Lv.{fantuan.level} · 🌾{fantuan.mili}</span>
          </div>
          {insights.length > 0 ? (
            insights.map((insight, idx) => (
              <div key={idx} className={`fantuan-insight ${insight.priority}`}>
                <p>{insight.message}</p>
                {insight.link && (
                  <Link to={insight.link} className="fantuan-insight-link">{insight.linkLabel}</Link>
                )}
              </div>
            ))
          ) : (
            <p>今天先按蛋白 + 蔬菜 + 主食的餐盘结构搭一版。</p>
          )}
          <div className="fantuan-actions">
            <Link to="/health">健康问卷</Link>
            <Link to="/plan">看计划</Link>
            <Link to="/fantuan">任务</Link>
          </div>
        </div>
      )}
      <button className="fantuan-float-button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="fantuan-face">🍙</span>
        {insights.some((i) => i.priority === 'high') && <span className="fantuan-pulse" />}
      </button>
    </aside>
  )
}
