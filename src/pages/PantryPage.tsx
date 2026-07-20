/** 冰箱页：首次为空，支持手动录入和从采购清单确认入库。 */
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DISHES } from '@/data/dishes'
import { getIngredientImage } from '@/data/ingredientImages'
import { useFandaziStore } from '@/stores/fandaziStore'
import type { IngredientGroup, PantryItem, PantryStorage } from '@/types'
import './PantryPage.css'

const FILTERS = [
  { key: 'all', label: '全部' }, { key: 'fridge', label: '冷藏' }, { key: 'freezer', label: '冷冻' },
  { key: 'room', label: '常温' }, { key: 'vegetable', label: '蔬菜' }, { key: 'protein', label: '蛋奶豆' },
] as const
type FilterKey = typeof FILTERS[number]['key']
const STORAGE_LABELS: Record<PantryStorage, string> = { room: '常温', fridge: '冷藏', freezer: '冷冻' }

function createId() { return crypto.randomUUID() }

export function PantryPage() {
  const [searchParams] = useSearchParams()
  const pantry = useFandaziStore((s) => s.pantry)
  const addPantryItem = useFandaziStore((s) => s.addPantryItem)
  const removePantryItem = useFandaziStore((s) => s.removePantryItem)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState<IngredientGroup>('蔬菜')
  const [storage, setStorage] = useState<PantryStorage>('fridge')
  const [bestBeforeAt, setBestBeforeAt] = useState('')
  const [note, setNote] = useState('')
  const searchQuery = searchParams.get('q')?.trim().toLowerCase() ?? ''

  const filtered = useMemo(() => pantry.filter((item) => {
    const matchesFilter = filter === 'all' || item.storage === filter ||
      (filter === 'vegetable' && item.category === '蔬菜') ||
      (filter === 'protein' && item.category === '肉蛋')
    const haystack = `${item.ingredientName} ${item.quantity} ${item.unit} ${item.note ?? ''}`.toLowerCase()
    return matchesFilter && (!searchQuery || haystack.includes(searchQuery))
  }), [filter, pantry, searchQuery])
  const useSoonItems = pantry.filter((item) => item.status === 'use_soon' || item.status === 'past_best')
  const pantryNames = new Set(pantry.map((item) => item.ingredientName))
  const canCookDishes = DISHES.filter((dish) => dish.ingredients.every((ing) => pantryNames.has(ing.name))).slice(0, 3)

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !quantity.trim() || !unit.trim()) return
    const item: PantryItem = {
      id: createId(), ingredientName: name.trim(), category, quantity: Number(quantity) || 1, unit: unit.trim(),
      storage, boughtAt: new Date().toISOString().slice(0, 10), bestBeforeAt: bestBeforeAt.trim(),
      source: 'manual_add', status: 'fresh', note: note.trim() || undefined,
    }
    addPantryItem(item)
    setName(''); setQuantity(''); setUnit(''); setBestBeforeAt(''); setNote('')
  }

  return (
    <div className="pantry-page">
      <div className="pantry-hero">
        <div className="pantry-hero-main">
          <div className="fd-hero-card pantry-hero-card">
            <div className="hero-label">家庭空间 · 当前冰箱</div>
            <h2>{pantry.length === 0 ? '冰箱还是空的' : `冰箱里有 ${pantry.length} 种食材`}</h2>
            <p>{pantry.length === 0 ? '可以先跳过，收到家人赠送或临时买菜后，再从下方添加。' : `${canCookDishes.length} 道菜可以直接做。`}</p>
            <div className="cta-row"><a className="fd-btn fd-btn-primary" href="#add-pantry">添加冰箱食材</a><Link to="/shopping" className="fd-btn fd-btn-secondary">去采购</Link></div>
          </div>
          <div className="pantry-quick">
            <div className="pantry-stat"><strong>{pantry.length}</strong><span>🥬 库存食材</span></div>
            <div className="pantry-stat warn"><strong>{useSoonItems.length}</strong><span>⏰ 快过期</span></div>
            <div className="pantry-stat green"><strong>{canCookDishes.length}</strong><span>🍳 冰箱可做</span></div>
            <div className="pantry-stat"><strong>—</strong><span>🛒 待采购</span></div>
          </div>
        </div>
        <div className="fd-side-card pantry-summary"><div className="hero-label">冰箱状态</div><div className="pantry-line"><span>库存食材</span><strong>{pantry.length} 项</strong></div><div className="pantry-line"><span>快过期</span><strong>{useSoonItems.length} 项</strong></div><div className="pantry-line"><span>今晚可做</span><strong>{canCookDishes.length} 道菜</strong></div></div>
      </div>

      <section id="add-pantry" className="fd-panel pantry-add-panel">
        <div className="hero-label">长期入口</div><h3>添加冰箱食材</h3><p className="pantry-form-hint">手动录入不依赖采购流程，只有你确认放入冰箱的采购项才会进入库存。</p>
        <form className="pantry-form" onSubmit={handleAdd}>
          <input aria-label="食材名称" placeholder="食材名称，例如：鸡蛋" value={name} onChange={(e) => setName(e.target.value)} />
          <input aria-label="数量" placeholder="数量，例如：6" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <input aria-label="单位" placeholder="单位，例如：个、克、包" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <select aria-label="分类" value={category} onChange={(e) => setCategory(e.target.value as IngredientGroup)}>{(['蔬菜', '肉蛋', '主食', '调味', '干货'] as IngredientGroup[]).map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="存放方式" value={storage} onChange={(e) => setStorage(e.target.value as PantryStorage)}><option value="fridge">冷藏</option><option value="freezer">冷冻</option><option value="room">常温</option></select>
          <input aria-label="保质期" placeholder="保质期/到期日（可选）" value={bestBeforeAt} onChange={(e) => setBestBeforeAt(e.target.value)} />
          <input aria-label="备注" placeholder="备注（可选）" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="fd-btn fd-btn-primary" type="submit">添加到冰箱</button>
        </form>
      </section>

      <div className="pantry-filters"><div className="hero-label">筛选食材</div><div className="pantry-filter-row">{FILTERS.map((item) => <button key={item.key} className={`pantry-chip ${filter === item.key ? 'active' : ''}`} onClick={() => setFilter(item.key)}>{item.label}</button>)}</div></div>
      <section className="fd-panel pantry-panel"><h3>{searchQuery ? `食材库存 · 搜索「${searchParams.get('q')?.trim()}」` : '食材库存'}</h3>
        {filtered.length === 0 ? <div className="empty-text"><p>{pantry.length === 0 ? '还没有食材。上方添加入口一直保留。' : '没有找到符合条件的食材。'}</p></div> : <div className="pantry-grid">{filtered.map((item) => { const image = getIngredientImage(item.ingredientName); return <article key={item.id} className="pantry-item-card"><div className="pantry-item-media" aria-hidden="true">{image ? <img src={image} alt="" width={120} height={120} /> : <span className="pantry-item-emoji">🥬</span>}</div><div className="pantry-item-body"><h4>{item.ingredientName}</h4><div className="pantry-tags"><span className="pantry-tag">{item.category}</span><span className="pantry-tag green">{STORAGE_LABELS[item.storage]}</span></div><div className="pantry-meta-row"><span>{item.bestBeforeAt ? `到期 ${item.bestBeforeAt}` : '未设置保质期'}</span><strong>{item.quantity} {item.unit}</strong></div>{item.note && <p className="pantry-form-hint">{item.note}</p>}<div className="pantry-item-actions"><button onClick={() => removePantryItem(item.id)}>从冰箱移除</button></div></div></article> })}</div>}
      </section>
    </div>
  )
}
