/** 采购页：生成清单、调整规格、确认购买，再确认放入冰箱。 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFandaziStore } from '@/stores/fandaziStore'
import { DISHES } from '@/data/dishes'
import './ShoppingPage.css'

export function ShoppingPage() {
  const mealPlans = useFandaziStore((s) => s.mealPlans)
  const pantry = useFandaziStore((s) => s.pantry)
  const shoppingList = useFandaziStore((s) => s.shoppingList)
  const addShoppingItem = useFandaziStore((s) => s.addShoppingItem)
  const updateShoppingItem = useFandaziStore((s) => s.updateShoppingItem)
  const markShoppingPurchased = useFandaziStore((s) => s.markShoppingPurchased)
  const storeShoppingItem = useFandaziStore((s) => s.storeShoppingItem)

  const candidates = useMemo(() => {
    const pantryNames = new Set(pantry.map((item) => item.ingredientName))
    const byName = new Map<string, { name: string; amount: string; source: string; category: typeof DISHES[number]['ingredients'][number]['group'] }>()
    for (const plan of mealPlans) {
      if (plan.status === 'done' || plan.status === 'skipped') continue
      const dish = DISHES.find((item) => item.id === plan.dishId)
      if (!dish) continue
      for (const ingredient of dish.ingredients) {
        if (pantryNames.has(ingredient.name)) continue
        const existing = byName.get(ingredient.name)
        byName.set(ingredient.name, {
          name: ingredient.name,
          amount: existing?.amount ?? ingredient.amount,
          source: existing ? `${existing.source}、${dish.name}` : dish.name,
          category: existing?.category ?? ingredient.group,
        })
      }
    }
    return [...byName.values()]
  }, [mealPlans, pantry])

  const pendingCandidates = candidates.filter((candidate) => !shoppingList.some((item) => item.name === candidate.name))
  const pendingCount = shoppingList.filter((item) => item.status !== 'stored').length

  function generateShoppingList() {
    pendingCandidates.forEach((candidate) => addShoppingItem({
      id: crypto.randomUUID(), name: candidate.name, amount: candidate.amount, source: candidate.source,
      checked: false, category: candidate.category, status: 'pending',
    }))
  }

  return (
    <div className="shopping-page">
      <div className="shopping-hero"><div className="fd-hero-card"><div className="hero-label">采购清单 · 家庭共享</div><h2>{shoppingList.length ? `本次采购 ${pendingCount} 项` : '还没有采购清单'}</h2><p>从计划生成后可以修改数量和规格。未确认放入冰箱前，不会写入库存。</p><div className="cta-row shopping-cta-row"><button className="fd-btn fd-btn-primary" onClick={generateShoppingList} disabled={pendingCandidates.length === 0}>{pendingCandidates.length ? '去采购（生成清单）' : shoppingList.length ? '清单已生成' : '先去计划选菜'}</button><Link to="/plan" className="fd-btn fd-btn-secondary">返回计划</Link><Link to="/pantry" className="fd-btn fd-btn-secondary">看冰箱</Link></div></div><div className="fd-side-card"><h4>🛒 清单状态</h4><div className="fd-list-item"><span>待购买</span><strong>{shoppingList.filter((item) => !item.checked).length} 项</strong></div><div className="fd-list-item"><span>已买待入库</span><strong>{shoppingList.filter((item) => item.status === 'purchased').length} 项</strong></div><div className="fd-list-item"><span>已入库</span><strong>{shoppingList.filter((item) => item.status === 'stored').length} 项</strong></div></div></div>

      {shoppingList.length > 0 ? <div className="fd-panel"><h3>本次采购清单</h3>{shoppingList.map((item) => <div key={item.id} className="shopping-item fd-list-item"><div className="shopping-item-main"><strong className={item.status === 'stored' ? 'shopping-item-name checked' : 'shopping-item-name'}>{item.name}</strong><small>{item.source} · {item.status === 'pending' ? '待购买' : item.status === 'purchased' ? '已买，待入库' : '已入库'}</small><div className="shopping-edit-row"><input aria-label={`${item.name}数量规格`} value={item.amount} onChange={(e) => updateShoppingItem(item.id, { amount: e.target.value })} placeholder="数量/重量" /><input aria-label={`${item.name}包装规格`} value={item.packageSpec ?? ''} onChange={(e) => updateShoppingItem(item.id, { packageSpec: e.target.value })} placeholder="包装规格（可选）" /></div></div>{item.status === 'pending' && <button className="fd-btn fd-btn-secondary fd-btn-sm" onClick={() => markShoppingPurchased(item.id)}>已买</button>}{item.status === 'purchased' && <button className="fd-btn fd-btn-green fd-btn-sm" onClick={() => storeShoppingItem(item.id)}>放入冰箱</button>}</div>)}</div> : null}

      {candidates.length > 0 && pendingCandidates.length > 0 ? <div className="fd-panel"><h3>计划里缺少的食材</h3><p className="empty-text">点击上方“去采购”后才会生成正式清单：</p>{candidates.map((item) => <div className="fd-list-item" key={item.name}><span>{item.name}</span><strong>{item.amount}</strong></div>)}</div> : null}
      {!shoppingList.length && !candidates.length ? <div className="fd-panel"><p className="empty-text">购物清单是空的。先去<Link to="/plan">计划</Link>添加菜品。</p></div> : null}
    </div>
  )
}
