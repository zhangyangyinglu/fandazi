/**
 * 购物清单页 — P2-4
 * 对应渲染图：P1-1d 计划+购物联动页 v6
 * 从计划中缺失食材自动生成购物清单
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFandaziStore } from '@/stores/fandaziStore'
import './ShoppingPage.css'

export function ShoppingPage() {
  const mealPlans = useFandaziStore((s) => s.mealPlans)
  const pantry = useFandaziStore((s) => s.pantry)
  const shoppingList = useFandaziStore((s) => s.shoppingList)
  const toggleShoppingItem = useFandaziStore((s) => s.toggleShoppingItem)
  const getDishById = useFandaziStore((s) => s.getDishById)

  // 自动项的勾选状态（本地 state，不持久化）
  const [checkedAuto, setCheckedAuto] = useState<Set<string>>(new Set())

  // 自动从计划中缺失食材生成购物清单；公开 Demo 首屏没有用户 localStorage 时也要展示示例链路
  const autoItems = useMemo(() => {
    const pantryNames = new Set(pantry.map((p) => p.ingredientName))
    const items: { name: string; amount: string; source: string; key: string }[] = []
    const sourcePlans = mealPlans.length > 0
      ? mealPlans
      : [
          { dishId: 'broccoli-chicken-egg', status: 'planned' },
          { dishId: 'tomato-tofu-shrimp-soup', status: 'planned' },
          { dishId: 'asparagus-shrimp-mushroom', status: 'shopping_done' },
        ]
    for (const plan of sourcePlans) {
      if (plan.status === 'done' || plan.status === 'skipped') continue
      const dish = getDishById(plan.dishId)
      if (!dish) continue
      for (const ing of dish.ingredients) {
        if (!pantryNames.has(ing.name)) {
          items.push({ name: ing.name, amount: ing.amount, source: dish.name, key: `${dish.name}-${ing.name}` })
        }
      }
    }
    return items
  }, [mealPlans, pantry, getDishById])

  // 按菜品来源分组
  const grouped = useMemo(() => {
    const groups: Record<string, typeof autoItems> = {}
    for (const item of autoItems) {
      if (!groups[item.source]) groups[item.source] = []
      groups[item.source].push(item)
    }
    return groups
  }, [autoItems])

  const toggleAuto = (key: string) => {
    setCheckedAuto((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const autoCheckedCount = checkedAuto.size
  const autoTotal = autoItems.length
  const manualCheckedCount = shoppingList.filter((i) => i.checked).length
  const manualTotal = shoppingList.length

  return (
    <div className="shopping-page">
      {/* Hero */}
      <div className="shopping-hero">
        <div className="fd-hero-card">
          <div className="hero-label">购物清单 · DEMO</div>
          <h2>
            {autoItems.length > 0
              ? `要买 ${autoItems.length} 样食材`
              : '购物清单是空的'}
          </h2>
          <p>
            {autoItems.length > 0
              ? '从计划中缺失食材自动生成，按菜品来源分组。'
              : '加入计划后，缺失食材会自动出现在这里。'}
          </p>
          <div className="cta-row">
            <Link to="/plan"><button className="fd-btn fd-btn-secondary">看计划</button></Link>
            <Link to="/pantry"><button className="fd-btn fd-btn-secondary">看冰箱</button></Link>
          </div>
        </div>
        <div className="fd-side-card">
          <h4>🛒 清单状态</h4>
          <div className="fd-list-item">
            <span>自动生成</span>
            <strong>{autoTotal} 项</strong>
          </div>
          <div className="fd-list-item">
            <span>已勾选</span>
            <strong>{autoCheckedCount + manualCheckedCount} 项</strong>
          </div>
          <div className="fd-list-item">
            <span>手动添加</span>
            <strong>{manualTotal} 项</strong>
          </div>
          {autoCheckedCount > 0 && (
            <button
              className="fd-btn fd-btn-green fd-btn-sm"
              onClick={() => setCheckedAuto(new Set())}
              style={{ marginTop: '10px', width: '100%' }}
            >
              重置勾选
            </button>
          )}
        </div>
      </div>

      {/* 饭团提醒 */}
      {autoItems.length > 0 && (
        <div className="fd-panel fantuan-reminder">
          <h4>🍙 饭团提醒</h4>
          <div className="fd-bubble">
            买完这些，今晚计划就完整了！采购完记得回来标记"做完了"拿米粒～
          </div>
        </div>
      )}

      {/* 自动生成的购物清单（按菜品分组） */}
      {Object.keys(grouped).length > 0 && (
        <div className="fd-panel">
          <h3>按菜品分组</h3>
          {Object.entries(grouped).map(([dishName, items]) => (
            <div key={dishName} className="shopping-group">
              <div className="shopping-group-title">📋 {dishName}</div>
              {items.map((item) => {
                const isChecked = checkedAuto.has(item.key)
                return (
                  <div key={item.key} className="shopping-item fd-list-item">
                    <input
                      type="checkbox"
                      className="shopping-check"
                      checked={isChecked}
                      onChange={() => toggleAuto(item.key)}
                    />
                    <span className={isChecked ? 'shopping-item-name checked' : 'shopping-item-name'}>
                      {item.name}
                    </span>
                    <span className="shopping-item-amount">{item.amount}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* 手动添加的购物清单 */}
      {shoppingList.length > 0 && (
        <div className="fd-panel">
          <h3>手动添加</h3>
          {shoppingList.map((item) => (
            <div key={item.id} className="shopping-item fd-list-item">
              <input
                type="checkbox"
                className="shopping-check"
                checked={item.checked}
                onChange={() => toggleShoppingItem(item.id)}
              />
              <span className={item.checked ? 'shopping-item-name checked' : 'shopping-item-name'}>
                {item.name}
              </span>
              <span className="shopping-item-amount">{item.amount}</span>
            </div>
          ))}
        </div>
      )}

      {/* 空状态 */}
      {autoItems.length === 0 && shoppingList.length === 0 && (
        <div className="fd-panel">
          <p className="empty-text">
            购物清单是空的。<br />
            去<Link to="/">菜品页</Link>选菜加入计划，缺失食材会自动出现在这里。
          </p>
        </div>
      )}
    </div>
  )
}
