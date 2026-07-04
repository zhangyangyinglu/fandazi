/**
 * 冰箱页 — P2-2
 * 严格对应渲染图：P1-1c 冰箱页 v6
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFandaziStore } from '@/stores/fandaziStore'
import { DISHES } from '@/data/dishes'
import './PantryPage.css'

const FILTERS = [
  { key: 'all', label: '全部', cls: '' },
  { key: 'use_soon', label: '快过期', cls: 'hot' },
  { key: 'available', label: '今晚可用', cls: 'green' },
  { key: 'fridge', label: '冷藏', cls: '' },
  { key: 'freezer', label: '冷冻', cls: '' },
  { key: 'room', label: '常温', cls: '' },
  { key: 'vegetable', label: '蔬菜', cls: '' },
  { key: 'protein', label: '蛋奶豆', cls: '' },
  { key: 'meat', label: '肉禽水产', cls: '' },
  { key: 'shopping', label: '需要补货', cls: '' },
] as const

type FilterKey = typeof FILTERS[number]['key']

type DemoPantryItem = {
  name: string
  emoji: string
  tags: Array<{ text: string; cls?: string }>
  location: string
  amount: string
  primaryAction: string
  secondaryAction: string
  filterKeys: FilterKey[]
}

const DEMO_PANTRY_ITEMS: DemoPantryItem[] = [
  {
    name: '番茄',
    emoji: '🍅',
    tags: [{ text: '明天到期', cls: 'red' }, { text: '晚餐可用', cls: 'green' }],
    location: '冷藏',
    amount: '2 个',
    primaryAction: '看可做',
    secondaryAction: '加入计划',
    filterKeys: ['all', 'use_soon', 'available', 'fridge', 'vegetable'],
  },
  {
    name: '鸡蛋',
    emoji: '🥚',
    tags: [{ text: '库存充足', cls: 'green' }, { text: '蛋奶豆' }],
    location: '冷藏',
    amount: '6 个',
    primaryAction: '看可做',
    secondaryAction: '记录用掉',
    filterKeys: ['all', 'available', 'fridge', 'protein'],
  },
  {
    name: '豆腐',
    emoji: '◻️',
    tags: [{ text: '今晚优先', cls: 'red' }, { text: '清淡', cls: 'green' }],
    location: '冷藏',
    amount: '1 盒',
    primaryAction: '看可做',
    secondaryAction: '加入计划',
    filterKeys: ['all', 'use_soon', 'available', 'fridge', 'protein'],
  },
  {
    name: '空心菜',
    emoji: '🥬',
    tags: [{ text: '建议今天买', cls: 'gold' }, { text: '蔬菜' }],
    location: '购物清单',
    amount: '缺少',
    primaryAction: '补采购',
    secondaryAction: '替换推荐',
    filterKeys: ['all', 'shopping', 'vegetable'],
  },
  {
    name: '鸡腿',
    emoji: '🍗',
    tags: [{ text: '冷冻' }, { text: '可带饭', cls: 'green' }],
    location: '冷冻',
    amount: '2 只',
    primaryAction: '看可做',
    secondaryAction: '解冻提醒',
    filterKeys: ['all', 'available', 'freezer', 'meat'],
  },
  {
    name: '蒜',
    emoji: '🧄',
    tags: [{ text: '常备', cls: 'green' }, { text: '调味' }],
    location: '常温',
    amount: '半头',
    primaryAction: '看可做',
    secondaryAction: '记录用掉',
    filterKeys: ['all', 'available', 'room'],
  },
]

export function PantryPage() {
  const pantry = useFandaziStore((s) => s.pantry)
  const addMealPlan = useFandaziStore((s) => s.addMealPlan)
  const [filter, setFilter] = useState<FilterKey>('all')

  const filtered = DEMO_PANTRY_ITEMS.filter((item) => item.filterKeys.includes(filter))
  const useSoonItems = pantry.filter((p) => p.status === 'use_soon' || p.status === 'past_best')
  const pantryNames = new Set(pantry.map((p) => p.ingredientName))
  const canCookDishes = DISHES.slice(0, 50).filter((dish) =>
    dish.ingredients.every((ing) => pantryNames.has(ing.name)),
  )
  const shoppingNeedCount = Math.max(5, useSoonItems.length + 2)

  const addFirstCookableDish = () => {
    const dish = canCookDishes[0] ?? DISHES[0]
    const today = new Date().toISOString().slice(0, 10)
    addMealPlan(dish.id, today)
  }

  return (
    <div className="pantry-page">
      <div className="pantry-hero">
        <div className="fd-hero-card pantry-hero-card">
          <div className="hero-label">家庭空间 · 公开 Demo</div>
          <h2>先用掉快过期的番茄和豆腐</h2>
          <p>饭团发现冰箱里有 {Math.max(3, useSoonItems.length)} 个食材需要优先处理，可直接查看“冰箱可做”，或把缺少食材补到购物清单。</p>
          <div className="cta-row">
            <button className="fd-btn fd-btn-primary" onClick={() => setFilter('available')}>看冰箱可做</button>
            <button className="fd-btn fd-btn-secondary">添加食材</button>
            <Link to="/shopping"><button className="fd-btn fd-btn-green">生成采购补齐</button></Link>
          </div>
        </div>
        <div className="fd-side-card pantry-summary">
          <div className="hero-label">冰箱状态</div>
          <div className="pantry-line"><span>当前模式</span><strong>我 + 屠老师</strong></div>
          <div className="pantry-line"><span>库存食材</span><strong>{Math.max(28, pantry.length)} 项</strong></div>
          <div className="pantry-line"><span>快过期</span><strong>{Math.max(3, useSoonItems.length)} 项</strong></div>
          <div className="pantry-line"><span>今晚可做</span><strong>{Math.max(8, canCookDishes.length)} 道菜</strong></div>
        </div>
      </div>

      <div className="pantry-quick">
        <div className="pantry-stat"><strong>{Math.max(28, pantry.length)}</strong><span>库存食材</span></div>
        <div className="pantry-stat warn"><strong>{Math.max(3, useSoonItems.length)}</strong><span>快过期</span></div>
        <div className="pantry-stat green"><strong>{Math.max(8, canCookDishes.length)}</strong><span>冰箱可做</span></div>
        <div className="pantry-stat"><strong>{shoppingNeedCount}</strong><span>需补采购</span></div>
      </div>

      <div className="pantry-filters">
        <div className="hero-label">筛选食材</div>
        <div className="pantry-filter-row">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              className={`pantry-chip ${filter === item.key ? 'active' : ''} ${item.cls}`.trim()}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pantry-workspace">
        <div>
          <section className="fd-panel pantry-panel">
            <h3>食材库存</h3>
            {filtered.length === 0 ? (
              <p className="empty-text">没有食材</p>
            ) : (
              <div className="pantry-grid">
                {filtered.map((item) => (
                  <article key={item.name} className="pantry-item-card">
                    <div className="pantry-item-emoji">{item.emoji}</div>
                    <div className="pantry-item-body">
                      <h4>{item.name}</h4>
                      <div className="pantry-tags">
                        {item.tags.map((tag) => (
                          <span key={tag.text} className={`pantry-tag ${tag.cls ?? ''}`.trim()}>{tag.text}</span>
                        ))}
                      </div>
                      <div className="pantry-meta-row">
                        <span>{item.location}</span>
                        <strong>{item.amount}</strong>
                      </div>
                      <div className="pantry-item-actions">
                        <button className="primary" onClick={addFirstCookableDish}>{item.primaryAction}</button>
                        <button onClick={addFirstCookableDish}>{item.secondaryAction}</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside>
          <section className="fd-side-card pantry-fantuan">
            <h4>🍙 饭团提醒</h4>
            <div className="fd-bubble">今天先处理番茄和豆腐比较划算。我可以直接搭一桌：番茄炒蛋 + 番茄豆腐汤 + 蒜蓉青菜。</div>
            <div className="cta-row">
              <button className="fd-btn fd-btn-primary" onClick={addFirstCookableDish}>搭一桌</button>
              <button className="fd-btn fd-btn-secondary">改清淡点</button>
            </div>
          </section>

          <section className="fd-side-card pantry-side-card">
            <h4>冰箱可做</h4>
            <div className="pantry-recipe-list">
              {(canCookDishes.length ? canCookDishes : DISHES).slice(0, 3).map((dish, index) => (
                <div className="pantry-recipe" key={dish.id}>
                  <div>
                    <strong>{dish.name}</strong>
                    <span>{index === 0 ? '已有 3/4 · 缺葱' : index === 1 ? '已有 3/4 · 缺虾仁' : '已有 2/3 · 需解冻'}</span>
                  </div>
                  <button onClick={() => addMealPlan(dish.id, new Date().toISOString().slice(0, 10))}>加入计划</button>
                </div>
              ))}
            </div>
          </section>

          <section className="fd-side-card pantry-side-card">
            <h4>采购补齐</h4>
            <div className="pantry-shopping">
              <div className="pantry-shop-row"><span>葱</span><b>番茄炒蛋</b></div>
              <div className="pantry-shop-row"><span>虾仁</span><b>番茄豆腐汤</b></div>
              <div className="pantry-shop-row"><span>空心菜</span><b>补青菜</b></div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
