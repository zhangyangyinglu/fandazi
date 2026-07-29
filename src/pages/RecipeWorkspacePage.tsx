/**
 * 菜品工作区页面 — 默认入口
 * 对应渲染图：P1-1 菜品工作区 v6
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { DISHES } from '@/data/dishes'
import type { Dish } from '@/types'
import { useFandaziStore } from '@/stores/fandaziStore'
import { readHealthProfiles, type HealthProfile } from '@/components/healthProfileStorage'
import { FANDAZI_SYNC_CONFIG_EVENT } from '@/lib/supabaseClient'
import { readBuddyGroup } from '@/data/familySharing'
import { checkPlateStructure } from '@/data/healthRecommend'
import { DAILY_MEAL_SETTINGS_EVENT, getDailyMealRecommendation, readDailyMealSettings, writeDailyMealSettings } from '@/data/dailyMeal'
import './RecipeWorkspacePage.css'

const QUICK_FILTERS = [
  '全部',
  '冰箱可做',
  '少油少盐',
  '有汤/粥',
  '适合带饭',
  '我家版',
]

const EXTRA_FILTERS = [
  '30 分钟内',
  '一荤一素',
  '主食一起搭',
]

const CUISINE_FILTERS = [
  '川菜',
  '粤菜',
  '苏菜',
  '湘菜',
  '京菜',
  '闽菜',
  '家常',
  '西式',
]

const TASTE_FILTERS = [
  '清淡',
  '鲜香',
  '酸辣',
  '咸甜',
  '下饭',
]

const FILTER_HELP = '先用最常用的找菜条件缩小范围；需要菜系或口味时，再点"更多筛选"。'

/** 推荐引擎未返回结果时的兜底（避免首页空白） */
const FALLBACK_RECOMMENDATION_IDS = [
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
    case '30 分钟内':
      return /分钟/.test(dish.cookTime) ? Number.parseInt(dish.cookTime, 10) <= 30 : tags.some((t) => ['快手', '省时', '简单'].includes(t))
    case '一荤一素':
      return tags.some((t) => ['家常', '家常菜', '国民菜', '经典', '蔬菜', '清淡'].includes(t))
    case '有汤/粥':
      return /汤|羹|粥|煲/.test(`${dish.name} ${dish.category} ${tags.join(' ')}`)
    case '主食一起搭':
      return /饭|面|粉|粥|饼|包子|馒头|花卷|饺子|馄饨|主食/.test(`${dish.name} ${dish.category} ${tags.join(' ')}`)
    case '适合带饭':
      return tags.some((t) => ['便当', '适合便当', '饱腹'].includes(t))
    case '少油少盐':
      return tags.some((t) => ['少油', '低油', '少盐', '低钠', '清淡', '低脂', '低热量'].includes(t))
    default:
      return true
  }
}

export function RecipeWorkspacePage({ catalogMode = false }: { catalogMode?: boolean }) {
  const [searchParams] = useSearchParams()
  const [activeFilter, setActiveFilter] = useState('全部')
  const [activeCuisine, setActiveCuisine] = useState('')
  const [activeTaste, setActiveTaste] = useState('')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '')
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(catalogMode)
  const [healthProfiles, setHealthProfiles] = useState<HealthProfile[]>([])
  const [isSharedMode, setIsSharedMode] = useState(() => Boolean(localStorage.getItem('fandazi.householdId')))
  const recommendationRef = useRef<HTMLElement | null>(null)
  const filtersRef = useRef<HTMLDivElement | null>(null)
  const catalogRef = useRef<HTMLElement | null>(null)

  const pantry = useFandaziStore((s) => s.pantry)
  const myDishVersions = useFandaziStore((s) => s.myDishVersions)
  const mealPlans = useFandaziStore((s) => s.mealPlans)
  const cookingLogs = useFandaziStore((s) => s.cookingLogs)
  const [dailySettings, setDailySettings] = useState(readDailyMealSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSearchQuery(searchParams.get('q') ?? '')
    setHealthProfiles(readHealthProfiles())
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [searchParams])

  useEffect(() => {
    const refreshMode = () => setIsSharedMode(Boolean(localStorage.getItem('fandazi.householdId')))
    window.addEventListener(FANDAZI_SYNC_CONFIG_EVENT, refreshMode)
    return () => window.removeEventListener(FANDAZI_SYNC_CONFIG_EVENT, refreshMode)
  }, [])

  useEffect(() => {
    const refresh = () => setDailySettings(readDailyMealSettings())
    window.addEventListener(DAILY_MEAL_SETTINGS_EVENT, refresh)
    return () => window.removeEventListener(DAILY_MEAL_SETTINGS_EVENT, refresh)
  }, [])

  const buddyGroup = useMemo(() => readBuddyGroup(), [])
  const homeModeLabel = isSharedMode ? '家庭共享' : '本机使用'

  const pantryNames = useMemo(() => new Set(pantry.map((p) => p.ingredientName)), [pantry])
  const myDishIds = useMemo(() => new Set(myDishVersions.map((v) => v.dishId)), [myDishVersions])

  // 今日安排：同一日期稳定、已计划优先、近期做过避重；健康与冰箱只参与排序。
  const recommendationResult = useMemo(() => {
    return getDailyMealRecommendation({
      date: new Date().toISOString().slice(0, 10), dishes: DISHES, pantryItems: Array.from(pantryNames), mealPlans, cookingLogs,
      settings: dailySettings, buddyGroup, healthProfiles,
    })
  }, [pantryNames, healthProfiles, mealPlans, cookingLogs, dailySettings, buddyGroup])

  // 推荐引擎返回的菜品；未返回时用兜底 ID
  const recommendationDishes = useMemo(() => {
    if (recommendationResult?.dishes?.length) {
      return recommendationResult.dishes
    }
    return FALLBACK_RECOMMENDATION_IDS
      .map((id) => DISHES.find((dish) => dish.id === id))
      .filter(Boolean) as Dish[]
  }, [recommendationResult])

  const recommendationIds = useMemo(
    () => new Set(recommendationDishes.map((d) => d.id)),
    [recommendationDishes],
  )

  const plateStatus = useMemo(() => checkPlateStructure(recommendationDishes), [recommendationDishes])
  const isFiltering = searchQuery.trim() !== '' || activeFilter !== '全部' || activeCuisine !== '' || activeTaste !== ''
  const hasHealthProfiles = healthProfiles.length > 0
  const combinedRestrictions = useMemo(() => (
    Array.from(new Set(healthProfiles.flatMap((p) => p.restrictions)))
  ), [healthProfiles])

  const scrollTo = (node: HTMLElement | null) => {
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const updateDailySettings = (patch: Partial<typeof dailySettings>) => {
    const next = { ...dailySettings, ...patch }
    setDailySettings(next)
    writeDailyMealSettings(next)
  }

  const displayDishes = useMemo(() => {
    const browseAllDishes = catalogMode || isFiltering
    let result = browseAllDishes ? DISHES : DISHES.slice(0, 24)

    if (activeFilter !== '全部') {
      result = result.filter((dish) => matchFilter(dish, activeFilter, pantryNames, myDishIds))
    }

    if (activeCuisine) {
      result = result.filter((dish) => dish.tags.includes(activeCuisine))
    }

    if (activeTaste) {
      result = result.filter((dish) => {
        const tags = dish.tags
        if (activeTaste === '清淡') return tags.some((t) => ['清淡', '少油', '少盐', '低脂', '原汁原味'].includes(t))
        if (activeTaste === '鲜香') return tags.some((t) => ['鲜香', '鲜美', '鲜', '香'].includes(t))
        if (activeTaste === '酸辣') return tags.some((t) => ['酸辣', '辣', '酸', '麻辣'].includes(t))
        if (activeTaste === '咸甜') return tags.some((t) => ['咸甜', '甜', '咸鲜'].includes(t))
        if (activeTaste === '下饭') return tags.some((t) => ['下饭', '下饭菜', '重口', '浓酱'].includes(t))
        return false
      })
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

    if (!catalogMode && !isFiltering) {
      result = result.filter((dish) => !recommendationIds.has(dish.id))
    }
    return browseAllDishes ? result : result.slice(0, 10)
  }, [activeFilter, activeCuisine, activeTaste, searchQuery, pantryNames, myDishIds, catalogMode, recommendationIds, isFiltering])

  const catalogTitle = catalogMode
    ? (searchQuery || activeFilter !== '全部' || activeCuisine || activeTaste ? '全部菜品库 · 筛选结果' : `全部 ${DISHES.length} 道菜`)
    : (searchQuery || activeFilter !== '全部' || activeCuisine || activeTaste ? '筛选结果' : '更多可选菜品')

  const catalogCountText = searchQuery || activeFilter !== '全部' || activeCuisine || activeTaste
    ? `找到 ${displayDishes.length} 道`
    : (catalogMode ? `当前菜品库共 ${DISHES.length} 道，已全部接入图片` : `首页仅展示 10 道，完整菜品库共 ${DISHES.length} 道`)

  const renderFilters = () => (
    <div className="filters-section" ref={filtersRef}>
      <span className="filter-label">快速筛选</span>
      <p className="filter-help">{FILTER_HELP}</p>
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
        {!catalogMode && (
          <button
            type="button"
            className={moreFiltersOpen || activeCuisine || activeTaste ? 'fd-tab more-filter-toggle active' : 'fd-tab more-filter-toggle'}
            onClick={() => setMoreFiltersOpen((value) => !value)}
            aria-expanded={moreFiltersOpen}
          >
            更多筛选 ▾
          </button>
        )}
      </div>
      {(moreFiltersOpen || catalogMode) && (
        <div className="more-filter-panel" aria-label="更多筛选">
          {EXTRA_FILTERS.length > 0 && (
            <div className="filter-tabs filter-tabs-extra">
              <span className="filter-group-label">更多</span>
              {EXTRA_FILTERS.map((filter) => (
                <button
                  key={filter}
                  className={filter === activeFilter ? 'fd-tab active' : 'fd-tab'}
                  onClick={() => { setActiveFilter(filter) }}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}
          <div className="filter-tabs filter-tabs-cuisine">
            <span className="filter-group-label">菜系</span>
            {CUISINE_FILTERS.map((cuisine) => (
              <button
                key={cuisine}
                className={cuisine === activeCuisine ? 'fd-tab active' : 'fd-tab'}
                onClick={() => setActiveCuisine(cuisine === activeCuisine ? '' : cuisine)}
              >
                {cuisine}
              </button>
            ))}
          </div>
          <div className="filter-tabs filter-tabs-taste">
            <span className="filter-group-label">口味</span>
            {TASTE_FILTERS.map((taste) => (
              <button
                key={taste}
                className={taste === activeTaste ? 'fd-tab active' : 'fd-tab'}
                onClick={() => setActiveTaste(taste === activeTaste ? '' : taste)}
              >
                {taste}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className={`recipe-workspace ${catalogMode ? 'catalog-mode' : 'home-mode'}`}>
      {catalogMode ? (
        <div className="catalog-hero fd-hero-card">
          <div className="hero-label">完整菜品库</div>
          <h2>这里能看到全部 {DISHES.length} 道菜</h2>
          <p>首页只放晚餐推荐和少量展示；完整菜品库在这里，可筛选、搜索、进详情、加入计划。</p>
        </div>
      ) : (
        <div className="hero-section">
          <div className="hero-main-stack">
            <div className="fd-hero-card hero-main">
              <div className="hero-label">今天晚餐 · {homeModeLabel}</div>
              <h2>饭团先帮你搭一版，不合适再改一下</h2>
              <p>{recommendationResult.reason || '饭团已经按你家的日常设置安排好了。'}</p>
              <div className="cta-row hero-cta-row">
                <button className="fd-btn fd-btn-primary" onClick={() => scrollTo(recommendationRef.current)}>看看推荐</button>
                <button className="fd-btn fd-btn-secondary" onClick={() => { setActiveFilter('全部'); setSearchQuery(''); setMoreFiltersOpen(true); scrollTo(filtersRef.current) }}>我今天想吃别的</button>
                <button className="fd-btn fd-btn-secondary" onClick={() => { setActiveFilter('冰箱可做'); setSearchQuery(''); scrollTo(catalogRef.current) }}>冰箱可做</button>
                <button className="fd-btn fd-btn-secondary" onClick={() => setSettingsOpen((open) => !open)}>安排设置</button>
              </div>
              {settingsOpen && <div className="daily-settings" aria-label="日常安排设置">
                <label>人数<select value={dailySettings.people} onChange={(e) => updateDailySettings({ people: Number(e.target.value) })}>{[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n} 人</option>)}</select></label>
                <label>每天<select value={dailySettings.mealsPerDay} onChange={(e) => updateDailySettings({ mealsPerDay: Number(e.target.value) as 1|2|3 })}>{[1,2,3].map((n) => <option key={n} value={n}>{n} 餐</option>)}</select></label>
                <label>每餐<select value={dailySettings.dishesPerMeal} onChange={(e) => updateDailySettings({ dishesPerMeal: e.target.value === 'auto' ? 'auto' : Number(e.target.value) as 1|2|3 })}><option value="auto">自动安排</option><option value="1">1 道</option><option value="2">2 道</option><option value="3">3 道</option></select></label>
                <label>主食<select value={dailySettings.carb} onChange={(e) => updateDailySettings({ carb: e.target.value as typeof dailySettings.carb })}><option value="optional">可选</option><option value="required">必配</option><option value="none">不安排</option></select></label>
                <label>避重<select value={dailySettings.repeatWindowDays} onChange={(e) => updateDailySettings({ repeatWindowDays: Number(e.target.value) as 7|14 })}><option value="7">7 天</option><option value="14">14 天</option></select></label>
              </div>}
            </div>
            <div className="home-filters-panel">
              {renderFilters()}
            </div>
          </div>
          <div className="fd-side-card summary-card">
            <div className="hero-label">家庭空间状态</div>
            <div className="fd-list-item"><span>当前模式</span><strong>{homeModeLabel}</strong></div>
            <div className="fd-list-item"><span>家庭成员</span><strong>{buddyGroup.members.length} 人已设置</strong></div>
            <div className="fd-list-item"><span>快过期</span><strong>{pantry.filter((p) => p.status === 'use_soon').slice(0, 3).map((p) => p.ingredientName).join(' · ') || '暂无'}</strong></div>
            <div className="fd-list-item"><span>近期避开</span><strong>{dailySettings.repeatWindowDays} 天重复菜</strong></div>
          </div>
        </div>
      )}

      {catalogMode && renderFilters()}

      {!catalogMode && !isFiltering && (
        <section className="dish-section" ref={recommendationRef}>
          <div className="dish-header">
            <div>
              <div className="hero-label">今日安排 · {recommendationDishes.length} 道</div>
              <h3>今天就吃这个</h3>
            </div>
            <span className="dish-count">{dailySettings.people} 人 · 每天 {dailySettings.mealsPerDay} 餐 · 主食{dailySettings.carb === 'optional' ? '可选' : dailySettings.carb === 'required' ? '必配' : '不安排'} · {dailySettings.repeatWindowDays} 天避重</span>
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
      )}

      <section className="dish-section dish-catalog-section" ref={catalogRef}>
        <div className="dish-header">
          <div>
            <div className="hero-label">菜品展示</div>
            <h3>{catalogTitle}</h3>
          </div>
          <div className="dish-header-actions">
            <span className="dish-count">{catalogCountText}</span>
            {!catalogMode && <Link className="fd-btn fd-btn-secondary" to="/catalog">查看全部 {DISHES.length} 道菜</Link>}
          </div>
        </div>
        {displayDishes.length === 0 ? (
          <div className="empty-dishes">
            {activeFilter === '冰箱可做' && pantryNames.size === 0 ? (
              <>
                <p>冰箱还是空的，先去添加食材吧。</p>
                <Link className="fd-btn fd-btn-primary" to="/pantry">去冰箱添加</Link>
              </>
            ) : (
              <>
                <p>没有找到符合条件的菜。</p>
                <button className="fd-btn fd-btn-secondary" onClick={() => { setActiveFilter('全部'); setSearchQuery('') }}>
                  清除筛选
                </button>
              </>
            )}
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

function getTagClass(tag: string): string {
  if (['少油', '低油', '少盐', '低钠', '清淡', '低脂', '低热量'].includes(tag)) return 'tag-health'
  if (['减脂', '轻食', '高蛋白', '控糖友好', '低GI', '低碳水'].includes(tag)) return 'tag-goal'
  if (['家常', '家常菜', '国民菜', '经典', '快手'].includes(tag)) return 'tag-daily'
  if (['便当', '适合便当', '饱腹', '适合午餐'].includes(tag)) return 'tag-bento'
  if (['素食', '蔬菜', '菌菇', '豆制品'].includes(tag)) return 'tag-veggie'
  return 'tag-neutral'
}

function getDishEmoji(dish: Dish): string {
  const text = `${dish.name} ${dish.category} ${dish.tags.join(' ')}`
  if (/汤|羹|煲/.test(text)) return '🍲'
  if (/粥/.test(text)) return '🥣'
  if (/虾/.test(text)) return '🦐'
  if (/鱼|三文鱼|鲈|带鱼|黄鱼/.test(text)) return '🐟'
  if (/蟹/.test(text)) return '🦀'
  if (/豆腐|豆干|腐竹/.test(text)) return '🧈'
  if (/蛋/.test(text)) return '🥚'
  if (/鸡|鸭/.test(text)) return '🍗'
  if (/牛|排/.test(text)) return '🥩'
  if (/猪|肉|排骨|五花/.test(text)) return '🥓'
  if (/面|粉|河粉|意面/.test(text)) return '🍜'
  if (/饭|炒饭|盖浇|拌饭/.test(text)) return '🍚'
  if (/饼|煎饼|葱油饼|千层/.test(text)) return '🫓'
  if (/包子|馒头|花卷/.test(text)) return '🥟'
  if (/饺子|锅贴|馄饨/.test(text)) return '🥟'
  if (/红薯|地瓜|紫薯/.test(text)) return '🍠'
  if (/玉米/.test(text)) return '🌽'
  if (/土豆|马铃薯/.test(text)) return '🥔'
  if (/番茄|西红柿/.test(text)) return '🍅'
  if (/西兰花|花菜/.test(text)) return '🥦'
  if (/黄瓜|瓜/.test(text)) return '🥒'
  if (/生菜|菠菜|空心菜|菜|蔬菜|绿叶/.test(text)) return '🥬'
  if (/蘑菇|香菇|菌/.test(text)) return '🍄'
  if (/辣椒|辣/.test(text)) return '🌶️'
  if (/甜|糕|饼|汤圆|红豆|银耳|枣/.test(text)) return '🍮'
  if (/凉拌|凉菜|小菜/.test(text)) return '🥗'
  return '🍽️'
}

function DishImage({ dish }: { dish: Dish }) {
  const [failed, setFailed] = useState(false)

  if (!failed && dish.image) {
    return <img src={dish.image} alt={dish.name} width={400} height={300} loading="lazy" decoding="async" onError={() => setFailed(true)} />
  }

  return (
    <div className="dish-image-placeholder" style={{ background: `linear-gradient(135deg, ${dish.color}, #fff7e9)` }}>
      <span>{getDishEmoji(dish)}</span>
    </div>
  )
}

function DishCard({ dish, compact = false, recommendation = false }: { dish: Dish; compact?: boolean; recommendation?: boolean }) {
  const location = useLocation()
  const addMealPlan = useFandaziStore((s) => s.addMealPlan)
  const pantry = useFandaziStore((s) => s.pantry)
  const [added, setAdded] = useState(false)
  const returnState = { from: `${location.pathname}${location.search}`, label: location.pathname.startsWith('/catalog') ? '返回菜品库' : '返回菜品' }

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
      <Link to={`/recipes/${dish.id}`} state={returnState} className="dish-image-link" aria-label={displayName}>
        <DishImage dish={dish} />
      </Link>
      <div className="dish-body">
        <h4><Link to={`/recipes/${dish.id}`} state={returnState}>{displayName}</Link></h4>
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
              {missingCount === 0 ? <span className="fd-badge green tag-match">冰箱可做</span> : <span className="fd-badge red tag-missing">缺{missingCount}样</span>}
              {dish.tags.slice(0, 2).map((tag) => <span key={tag} className={`fd-badge ${getTagClass(tag)}`}>{tag}</span>)}
            </>
          )}
        </div>
        <div className="dish-meta">{meta}</div>
        <div className="dish-actions">
          <button className={added ? 'fd-btn fd-btn-green' : 'fd-btn fd-btn-primary'} onClick={handleAddToPlan}>
            {added ? '✓ 已加入' : '加入计划'}
          </button>
          <Link to={`/recipes/${dish.id}`} state={returnState} className="fd-btn fd-btn-secondary">详情</Link>
        </div>
      </div>
    </article>
  )
}
