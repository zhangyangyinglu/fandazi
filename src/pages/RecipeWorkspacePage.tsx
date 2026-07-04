/**
 * 菜品工作区页面 — 默认入口
 * 对应渲染图：P1-1 菜品工作区 v6
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DISHES } from '@/data/dishes'
import type { Dish } from '@/types'
import { useFandaziStore } from '@/stores/fandaziStore'
import { readHealthProfiles, type HealthProfile } from '@/components/healthProfileStorage'
import { checkPlateStructure } from '@/data/healthRecommend'
import './RecipeWorkspacePage.css'

const QUICK_FILTERS = [
  '全部',
  '冰箱可做',
  '日常一起吃',
  '单人简餐',
  '顺手多做',
  '出门带饭',
  '控糖友好',
  '少油少盐',
  '我家版',
  '搭子偏好',
]

const RECOMMENDATION_IDS = [
  'steamed-bass-shanghai-greens',
  'water-spinach-lean-pork',
  'winter-melon-egg-soup',
  'brown-rice-chicken-veg-bowl',
]

type RecommendationCopy = {
  displayName?: string
  note: string
  meta: string
  role: '主蛋白' | '绿叶菜' | '汤羹' | '主食'
}

const RECOMMENDATION_COPY: Record<string, RecommendationCopy> = {
  'steamed-bass-shanghai-greens': {
    note: '清蒸鱼做主蛋白，口味干净，搭配绿叶菜不厚重。',
    meta: '主蛋白｜缺：鲈鱼、上海青',
    role: '主蛋白',
  },
  'water-spinach-lean-pork': {
    displayName: '空心菜炒瘦肉',
    note: '补一盘绿叶菜，快炒出锅，和清蒸主菜错开做法。',
    meta: '绿叶菜｜已有：蒜｜缺：空心菜、瘦猪肉',
    role: '绿叶菜',
  },
  'winter-melon-egg-soup': {
    note: '汤菜用冬瓜打底，避开番茄重复，晚餐更清爽。',
    meta: '汤羹｜已有：鸡蛋｜缺：冬瓜、虾皮',
    role: '汤羹',
  },
  'brown-rice-chicken-veg-bowl': {
    note: '少量糙米饭补主食，搭配蔬菜和鸡肉，晚餐更稳。',
    meta: '主食｜缺：糙米饭、鸡胸肉、胡萝卜',
    role: '主食',
  },
}

function matchFilter(dish: Dish, filter: string, pantryNames: Set<string>, myDishIds: Set<string>): boolean {
  if (filter === '全部') return true

  if (filter === '冰箱可做') {
    return dish.ingredients.every((ing) => pantryNames.has(ing.name))
  }

  if (filter === '我家版') {
    return myDishIds.has(dish.id)
  }

  const tags = dish.tags
  switch (filter) {
    case '日常一起吃':
      return tags.some((t) => ['家常', '家常菜', '国民菜', '经典'].includes(t))
    case '单人简餐':
      return tags.some((t) => ['一人份', '快手', '轻食', '早餐'].includes(t))
    case '顺手多做':
      return tags.some((t) => ['便当', '适合便当', '饱腹', '适合午餐'].includes(t))
    case '出门带饭':
      return tags.some((t) => ['便当', '适合便当', '饱腹'].includes(t))
    case '控糖友好':
      return tags.some((t) => ['控糖友好', '控糖主食', '低GI', '低碳水', '优质碳水'].includes(t))
    case '少油少盐':
      return tags.some((t) => ['少油', '低油', '清淡', '低脂', '低热量'].includes(t))
    case '搭子偏好':
      return tags.some((t) => ['清淡', '鲜香', '清蒸', '汤品', '炖汤', '暖胃'].includes(t))
    default:
      return true
  }
}

export function RecipeWorkspacePage() {
  const [searchParams] = useSearchParams()
  const [activeFilter, setActiveFilter] = useState('全部')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '')
  const [healthProfiles, setHealthProfiles] = useState<HealthProfile[]>([])

  const pantry = useFandaziStore((s) => s.pantry)
  const myDishVersions = useFandaziStore((s) => s.myDishVersions)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSearchQuery(searchParams.get('q') ?? '')
    setHealthProfiles(readHealthProfiles())
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [searchParams])

  const pantryNames = useMemo(() => new Set(pantry.map((p) => p.ingredientName)), [pantry])
  const myDishIds = useMemo(() => new Set(myDishVersions.map((v) => v.dishId)), [myDishVersions])

  const recommendationDishes = useMemo(() => (
    RECOMMENDATION_IDS.map((id) => DISHES.find((dish) => dish.id === id)).filter(Boolean) as Dish[]
  ), [])

  const plateStatus = useMemo(() => checkPlateStructure(recommendationDishes), [recommendationDishes])
  const hasHealthProfiles = healthProfiles.length > 0
  const combinedRestrictions = useMemo(() => (
    Array.from(new Set(healthProfiles.flatMap((p) => p.restrictions)))
  ), [healthProfiles])

  const displayDishes = useMemo(() => {
    let result = DISHES.slice(0, 24)

    if (activeFilter !== '全部') {
      result = result.filter((dish) => matchFilter(dish, activeFilter, pantryNames, myDishIds))
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      result = result.filter(
        (dish) =>
          dish.name.toLowerCase().includes(query) ||
          dish.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          dish.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(query)) ||
          dish.category.toLowerCase().includes(query),
      )
    }

    return result.filter((dish) => !RECOMMENDATION_IDS.includes(dish.id)).slice(0, 10)
  }, [activeFilter, searchQuery, pantryNames, myDishIds])

  return (
    <div className="recipe-workspace">
      <div className="hero-section">
        <div className="fd-hero-card hero-main">
          <div className="hero-label">今天晚餐 · 示例家庭 Demo</div>
          <h2>饭团先帮你搭一版，不合适再改一下</h2>
          <p>优先用冰箱里的番茄、鸡蛋和豆腐；避开高油重辣，给 2 人晚餐安排。</p>
          <div className="cta-row">
            <button className="fd-btn fd-btn-primary" onClick={() => setActiveFilter('冰箱可做')}>看看推荐</button>
            <button className="fd-btn fd-btn-secondary" onClick={() => { setActiveFilter('全部'); setSearchQuery('') }}>改一下</button>
            <button className="fd-btn fd-btn-secondary" onClick={() => setActiveFilter('冰箱可做')}>查看冰箱可做</button>
          </div>
        </div>
        <div className="fd-side-card summary-card">
          <div className="hero-label">家庭空间状态</div>
          <div className="fd-list-item"><span>当前模式</span><strong>公开 Demo</strong></div>
          <div className="fd-list-item"><span>搭子</span><strong>小夏 + 阿川</strong></div>
          <div className="fd-list-item"><span>快过期</span><strong>番茄 · 豆腐</strong></div>
          <div className="fd-list-item"><span>缺少食材</span><strong>葱 / 虾仁</strong></div>
        </div>
      </div>

      <div className="filters-section">
        <span className="filter-label">快速筛选</span>
        <div className="filter-tabs">
          {QUICK_FILTERS.map((filter) => (
            <button
              key={filter}
              className={filter === activeFilter ? 'fd-tab active' : 'fd-tab'}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <section className="dish-section">
        <div className="dish-header">
          <div>
            <div className="hero-label">晚餐推荐 · 4 道</div>
            <h3>今天可以这样吃</h3>
          </div>
          <span className="dish-count">按 2026 膳食指南、冰箱匹配、健康标签、家庭习惯排序</span>
        </div>
        <div className="meal-logic-strip">
          <span><strong>蛋白</strong> {plateStatus.hasProtein ? '✅ 已覆盖' : '⚠️ 缺优质蛋白'}</span>
          <span><strong>蔬菜</strong> {plateStatus.hasVegetable ? '✅ 已覆盖' : '⚠️ 缺蔬菜'}</span>
          <span><strong>主食</strong> {plateStatus.hasStaple ? '✅ 已覆盖' : '晚餐少量，可按活动量补全谷物'}</span>
          <span><strong>健康约束</strong> {hasHealthProfiles ? `${combinedRestrictions.length} 条限制已生效` : '未填健康问卷，仅按 2026 指南默认推荐'}</span>
        </div>
        {plateStatus.gaps.length > 0 && (
          <div className="plate-gap-warning">
            ⚠️ 餐盘结构缺口：{plateStatus.gaps.join('、')}。建议从菜品库补一道。
          </div>
        )}
        <div className="dish-grid recommended-grid">
          {recommendationDishes.map((dish) => (
            <DishCard key={dish.id} dish={dish} compact recommendation />
          ))}
        </div>
      </section>

      <section className="dish-section dish-catalog-section">
        <div className="dish-header">
          <div>
            <div className="hero-label">菜品展示</div>
            <h3>{searchQuery || activeFilter !== '全部' ? '筛选结果' : '更多可选菜品'}</h3>
          </div>
          <span className="dish-count">
            {searchQuery || activeFilter !== '全部' ? `找到 ${displayDishes.length} 道` : '不是今日一餐，只是菜品库展示'}
          </span>
        </div>
        {displayDishes.length === 0 ? (
          <div className="empty-dishes">
            <p>没有找到符合条件的菜。</p>
            <button className="fd-btn fd-btn-secondary" onClick={() => { setActiveFilter('全部'); setSearchQuery('') }}>
              清除筛选
            </button>
          </div>
        ) : (
          <div className="dish-grid catalog-grid">
            {displayDishes.map((dish) => (
              <DishCard key={dish.id} dish={dish} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function getDishEmoji(dish: Dish): string {
  const text = `${dish.name} ${dish.category} ${dish.tags.join(' ')}`
  if (/汤|羹|煲/.test(text)) return '🥣'
  if (/虾|鱼|海|三文鱼|鲈/.test(text)) return '🦐'
  if (/鸡|蛋/.test(text)) return '🥚'
  if (/牛|肉/.test(text)) return '🍗'
  if (/面|饭|主食|糙米|荞麦/.test(text)) return '🍚'
  if (/菜|生菜|菠菜|空心菜|西兰花|芦笋|黄瓜/.test(text)) return '🥬'
  if (/番茄|彩椒/.test(text)) return '🍅'
  return '🍽️'
}

function DishImage({ dish }: { dish: Dish }) {
  const [failed, setFailed] = useState(false)

  if (!failed && dish.image) {
    return <img src={dish.image} alt={dish.name} onError={() => setFailed(true)} />
  }

  return (
    <div className="dish-image-placeholder" style={{ background: `linear-gradient(135deg, ${dish.color}, #fff7e9)` }}>
      <span>{getDishEmoji(dish)}</span>
    </div>
  )
}

function DishCard({ dish, compact = false, recommendation = false }: { dish: Dish; compact?: boolean; recommendation?: boolean }) {
  const addMealPlan = useFandaziStore((s) => s.addMealPlan)
  const pantry = useFandaziStore((s) => s.pantry)
  const [added, setAdded] = useState(false)

  const pantryNames = new Set(pantry.map((p) => p.ingredientName))
  const missingCount = dish.ingredients.filter((ing) => !pantryNames.has(ing.name)).length
  const copy = RECOMMENDATION_COPY[dish.id]
  const displayName = copy?.displayName ?? dish.name
  const note = copy?.note ?? dish.flavorDescription ?? dish.intro ?? `适合${dish.mealType?.includes('dinner') ? '晚餐' : '日常'}的一道${dish.category}。`
  const meta = copy?.meta ?? `已有 ${Math.max(0, dish.ingredients.length - missingCount)}/${dish.ingredients.length} · ${missingCount === 0 ? '冰箱可做' : `缺${missingCount}样`}`
  const role = copy?.role

  const handleAddToPlan = () => {
    const today = new Date().toISOString().slice(0, 10)
    addMealPlan(dish.id, today)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <article className={`dish-card ${compact ? 'compact' : ''} ${recommendation ? 'recommendation' : ''}`.trim()}>
      <Link to={`/recipes/${dish.id}`} className="dish-image-link" aria-label={displayName}>
        <DishImage dish={dish} />
      </Link>
      <div className="dish-body">
        <h4><Link to={`/recipes/${dish.id}`}>{displayName}</Link></h4>
        <p className="dish-note">{note}</p>
        <div className="dish-tags">
          {recommendation ? (
            <>
              {role && <span className="fd-badge green">{role}</span>}
              {dish.tags.includes('低油') || dish.tags.includes('少油') ? <span className="fd-badge">少油</span> : null}
              {dish.tags.includes('控糖友好') || dish.tags.includes('控糖主食') ? <span className="fd-badge gold">控糖友好</span> : null}
              <span className="fd-badge">{dish.cookTime}</span>
            </>
          ) : (
            <>
              {missingCount === 0 ? <span className="fd-badge green">冰箱可做</span> : <span className="fd-badge">缺{missingCount}样</span>}
              {dish.tags.slice(0, 2).map((tag) => <span key={tag} className="fd-badge">{tag}</span>)}
            </>
          )}
        </div>
        <div className="dish-meta">{meta}</div>
        <div className="dish-actions">
          <button className={added ? 'fd-btn fd-btn-green' : 'fd-btn fd-btn-primary'} onClick={handleAddToPlan}>
            {added ? '✓ 已加入' : '加入计划'}
          </button>
          <Link to={`/recipes/${dish.id}`}><button className="fd-btn fd-btn-secondary">详情</button></Link>
        </div>
      </div>
    </article>
  )
}
