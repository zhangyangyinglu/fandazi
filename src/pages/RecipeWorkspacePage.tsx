/**
 * 菜品工作区页面 — 默认入口
 * 对应渲染图：P1-1 菜品工作区 v6
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DISHES } from '@/data/dishes'
import type { Dish } from '@/types'
import { useFandaziStore } from '@/stores/fandaziStore'
import { readHealthProfiles, type HealthProfile } from '@/components/healthProfileStorage'
import { FANDAZI_SYNC_CONFIG_EVENT } from '@/lib/supabaseClient'
import { readBuddyGroup } from '@/data/familySharing'
import { humanizeHealthLabel } from '@/data/healthLabels'
import { DAILY_MEAL_SETTINGS_EVENT, getDailyMealRecommendation, readDailyMealSettings } from '@/data/dailyMeal'
import { getBeijingDateString, getBeijingTimeOfDay, getCurrentMealType, MEAL_TYPE_LABEL, type CurrentMealTime } from '@/data/mealTimeContext'
import { formatWeekDate, getWeekStart, readWeeklyPrepPlan, writeWeeklyPrepPlan, WEEKLY_PREP_CHANGE_EVENT, type WeeklyPrepPlan } from '@/data/weeklyPrepPlan'
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

type MealView = 'auto' | CurrentMealTime

function MealViewSwitcher({
  view,
  currentMeal,
  onChange,
}: {
  view: MealView
  currentMeal: CurrentMealTime
  onChange: (view: MealView) => void
}) {
  const currentLabel = MEAL_TYPE_LABEL[currentMeal]
  return (
    <div className="meal-view-switcher" aria-label="首页餐次选择">
      <div className="meal-view-copy">
        <strong>当前餐次：{view === 'auto' ? currentLabel : MEAL_TYPE_LABEL[view]}</strong>
        <span>{view === 'auto' ? '跟随北京时间自动切换' : '已手动选择，不随时间自动切换'}</span>
      </div>
      <div className="meal-view-options">
        <button type="button" className={view === 'auto' ? 'active' : ''} aria-pressed={view === 'auto'} onClick={() => onChange('auto')}>
          跟随时间
        </button>
        <button type="button" className={view === 'breakfast' ? 'active' : ''} aria-pressed={view === 'breakfast'} onClick={() => onChange('breakfast')}>
          早餐
        </button>
        <button type="button" className={view === 'lunch' ? 'active' : ''} aria-pressed={view === 'lunch'} onClick={() => onChange('lunch')}>
          午餐
        </button>
        <button type="button" className={view === 'dinner' ? 'active' : ''} aria-pressed={view === 'dinner'} onClick={() => onChange('dinner')}>
          晚餐
        </button>
        <Link to="/catalog" className="meal-view-browse">随便看看</Link>
      </div>
    </div>
  )
}

function WeeklyPrepHomeCard({ plan }: { plan: WeeklyPrepPlan | null }) {
  const weekStart = plan?.weekStart ?? getWeekStart()
  const weekEnd = plan?.weekEnd ?? weekStart
  const statusLabel = plan?.status === 'confirmed' ? '已确认' : plan ? '草案待确认' : '尚未生成'
  const batchLabel = plan ? `已安排 ${plan.batches.length} 批备餐` : '给自己安排一周备餐'
  const description = plan
    ? `${plan.mealsPerDay === 2 ? '每天两餐' : '每天一餐'} · ${plan.servings}人份 · 打开查看每天怎么组合`
    : '一次规划 2～3 天的量，分批做好，平时直接搭配。'

  return (
    <section className="home-weekly-prep-card" aria-label="本周备餐计划">
      <div className="home-weekly-prep-head">
        <div>
          <div className="hero-label">本周备餐 · {formatWeekDate(weekStart)}～{formatWeekDate(weekEnd)}</div>
          <div className="home-weekly-prep-title-row">
            <h2>{batchLabel}</h2>
            <span className={`home-weekly-prep-status ${plan?.status === 'confirmed' ? 'confirmed' : ''}`}>{statusLabel}</span>
          </div>
          <p>{description}</p>
        </div>
        <Link className="fd-btn fd-btn-primary home-weekly-prep-link" to="/weekly-prep">
          {plan ? '查看周计划' : '生成周计划'}
        </Link>
      </div>

      {plan ? (
        <div className="home-weekly-prep-batches">
          {plan.batches.map((batch) => {
            const dishNames = batch.dishIds
              .map((dishId) => DISHES.find((dish) => dish.id === dishId)?.name)
              .filter(Boolean)
            return (
              <div className="home-weekly-prep-batch" key={batch.id}>
                <strong>{batch.title}</strong>
                <span>{batch.rangeLabel}</span>
                <p>{dishNames.length > 0 ? dishNames.join('、') : '待生成菜品组合'}</p>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="home-weekly-prep-empty">还没有本周草案，点“生成周计划”后，饭团会按 2～3 天一批帮你安排。</div>
      )}
    </section>
  )
}

/** 推荐引擎未返回结果时的兜底（避免首页空白） */
const FALLBACK_RECOMMENDATION_IDS = [
  'steamed-bass-shanghai-greens',
  'water-spinach-lean-pork',
  'winter-melon-egg-soup',
  'brown-rice-chicken-veg-bowl',
]

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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeFilter, setActiveFilter] = useState('全部')
  const [activeCuisine, setActiveCuisine] = useState('')
  const [activeTaste, setActiveTaste] = useState('')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '')
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(catalogMode)
  const [healthProfiles, setHealthProfiles] = useState<HealthProfile[]>([])
  const [isSharedMode, setIsSharedMode] = useState(() => Boolean(localStorage.getItem('fandazi.householdId')))
  const filtersRef = useRef<HTMLDivElement | null>(null)
  const catalogRef = useRef<HTMLElement | null>(null)

  const pantry = useFandaziStore((s) => s.pantry)
  const myDishVersions = useFandaziStore((s) => s.myDishVersions)
  const mealPlans = useFandaziStore((s) => s.mealPlans)
  const addMealPlan = useFandaziStore((s) => s.addMealPlan)
  const cookingLogs = useFandaziStore((s) => s.cookingLogs)
  const [dailySettings, setDailySettings] = useState(readDailyMealSettings)
  const [mealRevision, setMealRevision] = useState(0)
  const [mealView, setMealView] = useState<MealView>('auto')
  const [now, setNow] = useState(() => new Date())
  const [weeklyPrepPlan, setWeeklyPrepPlan] = useState<WeeklyPrepPlan | null>(() => readWeeklyPrepPlan(getWeekStart()))

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

  useEffect(() => {
    const refresh = () => setWeeklyPrepPlan(readWeeklyPrepPlan(getWeekStart()))
    window.addEventListener(WEEKLY_PREP_CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    // 云端周备餐变更（其他设备同步过来）
    const onCloudWeeklyPrep = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail) {
        writeWeeklyPrepPlan(detail)
        refresh()
      }
    }
    window.addEventListener('fandazi:weekly-prep-cloud', onCloudWeeklyPrep)
    return () => {
      window.removeEventListener(WEEKLY_PREP_CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('fandazi:weekly-prep-cloud', onCloudWeeklyPrep)
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const buddyGroup = useMemo(() => readBuddyGroup(), [])
  const homeModeLabel = isSharedMode ? '家庭共享' : '本机使用'
  const currentMealTime = getCurrentMealType(getBeijingTimeOfDay(now))
  const selectedMealTime: CurrentMealTime = mealView === 'auto' ? currentMealTime : mealView
  const selectedMealLabel = MEAL_TYPE_LABEL[selectedMealTime]
  const today = getBeijingDateString(now)

  const pantryNames = useMemo(() => new Set(pantry.map((p) => p.ingredientName)), [pantry])
  const myDishIds = useMemo(() => new Set(myDishVersions.map((v) => v.dishId)), [myDishVersions])

  // 今日安排：同一日期稳定、已计划优先、近期做过避重；健康与冰箱只参与排序。
  const recommendationResult = useMemo(() => {
    return getDailyMealRecommendation({
      date: today, dishes: DISHES, pantryItems: Array.from(pantryNames), mealPlans, cookingLogs,
      settings: dailySettings, buddyGroup, healthProfiles, mealTime: selectedMealTime, revision: mealRevision,
    })
  }, [today, selectedMealTime, pantryNames, healthProfiles, mealPlans, cookingLogs, dailySettings, buddyGroup, mealRevision])

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

  const isFiltering = searchQuery.trim() !== '' || activeFilter !== '全部' || activeCuisine !== '' || activeTaste !== ''

  const recommendationIngredients = useMemo(
    () => [...new Set(recommendationDishes.flatMap((dish) => dish.ingredients.map((ingredient) => ingredient.name)))],
    [recommendationDishes],
  )
  const availableRecommendationIngredients = recommendationIngredients.filter((name) => pantryNames.has(name))
  const missingRecommendationIngredients = recommendationIngredients.filter((name) => !pantryNames.has(name))
  const healthPlanLabels = useMemo(() => {
    const labels = healthProfiles.flatMap((profile) => [
      ...profile.priorityGoals,
      ...profile.nutritionFocus,
      ...profile.healthStatuses,
    ])
    return [...new Set(labels.filter(Boolean))].slice(0, 3).map(humanizeHealthLabel)
  }, [healthProfiles])
  const mobileHealthReason = recommendationResult.healthReasons?.slice(0, 2).join('；')
    || (healthProfiles.length > 0 ? '饭团已参考你确认的需求和冰箱库存，但这道菜没有命中更具体的健康标签。' : '建立健康计划后，饭团会按你的身体需求定制推荐。')

  const handleConfirmRecommendation = () => {
    if (!recommendationResult.persisted) {
      recommendationDishes.forEach((dish) => addMealPlan(dish.id, today))
    }
    if (missingRecommendationIngredients.length > 0) {
      navigate('/shopping')
      return
    }
    const firstDish = recommendationDishes[0]
    navigate(firstDish ? `/recipes/${firstDish.id}` : '/plan')
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
          <p>首页会按北京时间和你的选择推荐一餐；想自己找菜时，可以在这里筛选、搜索、进详情、加入计划。</p>
        </div>
      ) : (
        <>
        <WeeklyPrepHomeCard plan={weeklyPrepPlan} />
        <section className="today-meal-card">
          <MealViewSwitcher view={mealView} currentMeal={currentMealTime} onChange={setMealView} />
          <div className="today-meal-header">
            <div>
              <div className="hero-label">{selectedMealLabel} · {homeModeLabel} · {recommendationResult.persisted ? '已确认计划' : '系统推荐'}</div>
              <h1>{recommendationDishes.map((dish) => dish.name).join(' + ')}</h1>
              <p>{recommendationResult.reason || '饭团已经替你安排好了。'}</p>
              {healthProfiles.length > 0 && recommendationResult.healthReasons?.length > 0 && (
                <div className="today-health-reason">健康依据：{recommendationResult.healthReasons.slice(0, 2).join('；')}</div>
              )}
            </div>
            <div className={`today-ready-state ${missingRecommendationIngredients.length === 0 ? 'ready' : ''}`}>
              <strong>{missingRecommendationIngredients.length === 0 ? '可以直接做' : `还缺 ${missingRecommendationIngredients.length} 样`}</strong>
              <span>已有 {availableRecommendationIngredients.length}/{recommendationIngredients.length} 样食材</span>
            </div>
          </div>

          <div className="today-dish-list">
            {recommendationDishes.map((dish) => {
              const missing = dish.ingredients.filter((ingredient) => !pantryNames.has(ingredient.name)).length
              return (
                <Link key={dish.id} to={`/recipes/${dish.id}`} className="today-dish-row">
                  <div className="today-dish-image"><DishImage dish={dish} /></div>
                  <div className="today-dish-copy">
                    <strong>{dish.name}</strong>
                    <span>{dish.category} · {dish.cookTime}</span>
                  </div>
                  <span className={`fd-badge ${missing === 0 ? 'green' : 'red'}`}>{missing === 0 ? '冰箱可做' : `缺 ${missing} 样`}</span>
                </Link>
              )
            })}
          </div>

          {missingRecommendationIngredients.length > 0 && (
            <p className="today-missing-copy">缺少：{missingRecommendationIngredients.slice(0, 6).join('、')}{missingRecommendationIngredients.length > 6 ? `等 ${missingRecommendationIngredients.length} 样` : ''}</p>
          )}

          <div className="today-meal-actions">
            <button className="fd-btn fd-btn-primary" onClick={handleConfirmRecommendation}>
              {missingRecommendationIngredients.length > 0 ? `确认并补齐 ${missingRecommendationIngredients.length} 样` : '确认并开始做'}
            </button>
            {recommendationResult.persisted ? (
              <Link className="fd-btn fd-btn-secondary" to="/plan">调整计划</Link>
            ) : (
              <button className="fd-btn fd-btn-secondary" onClick={() => setMealRevision((value) => value + 1)}>换一份</button>
            )}
            <Link className="fd-btn fd-btn-text" to="/catalog">今天特别想吃什么？</Link>
          </div>
        </section>
        <section className="mobile-today-hero" aria-label="开饭推荐">
          <MealViewSwitcher view={mealView} currentMeal={currentMealTime} onChange={setMealView} />
          <div className="mobile-today-kicker">{today} · {selectedMealLabel} · {recommendationResult.persisted ? '已确认安排' : '系统推荐'}</div>
          <div className="mobile-today-title-row">
            <h1>{selectedMealLabel}吃什么？</h1>
            <span className="mobile-today-seal">01</span>
          </div>
          <p className="mobile-today-intro">不是任务，是一顿刚好适合今天的饭。</p>
          {recommendationDishes[0] && (
            <article className="mobile-meal-scene">
              <Link to={`/recipes/${recommendationDishes[0].id}`} className="mobile-today-dish-image" aria-label={`查看${recommendationDishes[0].name}`}>
                <DishImage dish={recommendationDishes[0]} />
              </Link>
              <div className="mobile-meal-copy">
                <h2>{recommendationDishes[0].name}</h2>
                <p>{recommendationDishes[0].flavorDescription || recommendationDishes[0].intro || '家常好吃，今天刚刚好。'}</p>
                <div className="mobile-meal-meta"><span>时间<strong>{recommendationDishes[0].cookTime.replace('分钟', ' min')}</strong></span><span>难度<strong>家常</strong></span><span>份量<strong>{dailySettings.people} 人</strong></span></div>
              </div>
            </article>
          )}
          <div className="mobile-today-status">
            <div><span>这顿饭的准备状态</span><strong>{availableRecommendationIngredients.length} / {recommendationIngredients.length} 样食材已有</strong></div>
            <em>{missingRecommendationIngredients.length === 0 ? '食材齐了' : `还缺 ${missingRecommendationIngredients.length} 样`}</em>
          </div>
          <div className="mobile-health-strip">
            <span className="mobile-health-icon">✦</span>
            <div>
              <strong>{healthProfiles.length > 0 ? '为什么这样推荐' : '饭团推荐依据'}</strong>
              <p>{mobileHealthReason}</p>
              {healthPlanLabels.length > 0 && <div className="mobile-health-tags">{healthPlanLabels.map((label) => <span key={label}>{label}</span>)}</div>}
            </div>
          </div>
          <div className="mobile-today-actions">
            <button className="fd-btn fd-btn-primary" onClick={handleConfirmRecommendation}>
              {missingRecommendationIngredients.length > 0 ? '补齐食材' : '打开这顿饭'}
            </button>
            <button className="fd-btn fd-btn-secondary" onClick={() => setMealRevision((value) => value + 1)}>换一份</button>
          </div>
        <p className="mobile-today-more">{recommendationDishes.length > 1 ? `还有 ${recommendationDishes.length - 1} 道搭配已为你准备` : '想从已有食材开始？去冰箱试试逆向食谱'}</p>
        </section>
        </>
      )}

      {catalogMode && renderFilters()}

      {catalogMode && <section className="dish-section dish-catalog-section" ref={catalogRef}>
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
      </section>}
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
  const addMealPlan = useFandaziStore((s) => s.addMealPlan)
  const pantry = useFandaziStore((s) => s.pantry)
  const [added, setAdded] = useState(false)

  const pantryNames = new Set(pantry.map((p) => p.ingredientName))
  const missingCount = dish.ingredients.filter((ing) => !pantryNames.has(ing.name)).length
  const displayName = dish.name
  const note = dish.flavorDescription ?? dish.intro ?? `适合${dish.mealType?.includes('dinner') ? '晚餐' : '日常'}的一道${dish.category}。`
  const meta = `已有 ${Math.max(0, dish.ingredients.length - missingCount)}/${dish.ingredients.length} · ${missingCount === 0 ? '冰箱可做' : `缺${missingCount}样`}`

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
              <span className="fd-badge green">{dish.category}</span>
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
          <Link to={`/recipes/${dish.id}`} className="fd-btn fd-btn-secondary">详情</Link>
        </div>
      </div>
    </article>
  )
}
