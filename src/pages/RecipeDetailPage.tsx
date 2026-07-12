import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { DISHES } from '@/data/dishes'
import { useFandaziStore } from '@/stores/fandaziStore'
import './RecipeDetailPage.css'

function getDishEmoji(name: string, category: string, tags: string[]): string {
  const text = `${name} ${category} ${tags.join(' ')}`
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

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const dish = DISHES.find((d) => d.id === id)
  const addMealPlan = useFandaziStore((s) => s.addMealPlan)
  const addCookingLog = useFandaziStore((s) => s.addCookingLog)
  const addMili = useFandaziStore((s) => s.addMili)
  const pantry = useFandaziStore((s) => s.pantry)
  const myDishVersions = useFandaziStore((s) => s.myDishVersions)
  const cookingLogs = useFandaziStore((s) => s.cookingLogs)
  const backState = location.state as { from?: string; label?: string } | null
  const backTo = backState?.from ?? '/'
  const backLabel = backState?.label ?? '返回菜品'
  const [recipeTab, setRecipeTab] = useState<'standard' | 'mine' | 'partner'>('standard')
  const [added, setAdded] = useState(false)

  if (!dish) {
    return (
      <div className="fd-main">
        <p>菜品不存在</p>
        <Link to={backTo}>{backLabel}</Link>
      </div>
    )
  }

  // 我家版数据
  const myVersion = myDishVersions.find((v) => v.dishId === dish.id)
  const hasMyVersion = !!myVersion
  const myCookingLogs = cookingLogs.filter((l) => l.dishId === dish.id)
  const cookCount = myCookingLogs.length

  // 在 selector 外计算
  const pantryNames = new Set(pantry.map((p) => p.ingredientName))
  const match = {
    have: dish.ingredients.filter((ing) => pantryNames.has(ing.name)).length,
    missing: dish.ingredients.filter((ing) => !pantryNames.has(ing.name)).length,
    missingNames: dish.ingredients.filter((ing) => !pantryNames.has(ing.name)).map((ing) => ing.name),
  }

  // 当前 tab 展示的食材和步骤
  const displayIngredients = recipeTab === 'mine' && myVersion ? myVersion.ingredients : dish.ingredients
  const displaySteps = recipeTab === 'mine' && myVersion ? myVersion.steps : dish.steps

  // 差异对比：标准版 vs 我家版
  const ingredientDiff = myVersion ? dish.ingredients.map((std) => {
    const mine = myVersion.ingredients.find((m) => m.name === std.name)
    if (!mine) return { name: std.name, std: std.amount, mine: '—', changed: 'removed' as const }
    if (mine.amount !== std.amount) return { name: std.name, std: std.amount, mine: mine.amount, changed: 'changed' as const }
    return { name: std.name, std: std.amount, mine: mine.amount, changed: 'same' as const }
  }) : []
  const addedByMe = myVersion ? myVersion.ingredients.filter((m) => !dish.ingredients.some((s) => s.name === m.name)) : []

  const handleAddToPlan = () => {
    const today = new Date().toISOString().slice(0, 10)
    addMealPlan(dish.id, today)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const handleMarkCooked = () => {
    addCookingLog({
      id: crypto.randomUUID(),
      dishId: dish.id,
      dishName: dish.name,
      date: new Date().toISOString().slice(0, 10),
      note: '从菜品详情页标记做过',
      miliReward: 15,
    })
    addMili(15)
  }

  return (
    <div className="recipe-detail">
      <div className="detail-breadcrumb">
        <Link to={backTo} className="back-link">← {backLabel}</Link>
        <span>菜品 / {dish.category} / {dish.name}</span>
      </div>

      {/* 标题区 */}
      <div className="detail-hero">
        <div className="detail-photo" style={dish.image ? undefined : { background: `linear-gradient(135deg, ${dish.color}, #fff6e7)` }}>
          {dish.image ? (
            <img src={dish.image} alt={dish.name} width={600} height={400} loading="lazy" decoding="async" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <span>{getDishEmoji(dish.name, dish.category, dish.tags)}</span>
          )}
          {hasMyVersion && <span className="my-version-badge">🏠 我家版</span>}
          {cookCount > 0 && <span className="cook-count-badge">做过 {cookCount} 次</span>}
        </div>
        <section className="detail-summary">
          <div className="detail-label">
            {dish.cookMethod} · {dish.cookTime} · 2 人份
          </div>
          <h2>{dish.name}</h2>
          <p className="flavor-desc">{dish.flavorDescription || dish.intro}</p>
          <div className="detail-tags">
            {dish.tags.map((tag) => (
              <span key={tag} className="fd-badge">{tag}</span>
            ))}
          </div>
          <div className="detail-meta">
            <div className="meta-item">
              <strong>预计用时</strong>
              <span>{dish.cookTime}</span>
            </div>
            <div className="meta-item">
              <strong>默认份量</strong>
              <span>2 人份</span>
            </div>
            <div className="meta-item">
              <strong>食材已有</strong>
              <span>{match.have}/{dish.ingredients.length}</span>
            </div>
            <div className="meta-item">
              <strong>健康负担</strong>
              <span>轻</span>
            </div>
          </div>
          <div className="cta-row">
            <button className={added ? 'fd-btn fd-btn-green' : 'fd-btn fd-btn-primary'} onClick={handleAddToPlan}>{added ? '✓ 已加入' : '加入今晚计划'}</button>
            <Link to="/shopping" className="fd-btn fd-btn-secondary">加入购物清单</Link>
            <button type="button" className="fd-btn fd-btn-green" onClick={handleMarkCooked}>标记做过</button>
            <button type="button" className="fd-btn fd-btn-secondary" onClick={() => setRecipeTab('mine')}>改成我家版</button>
          </div>
        </section>
      </div>

      {/* 工作区 */}
      <div className="detail-workspace">
        <div className="detail-main">
          {/* 食材 + 做法 */}
          <section className="fd-panel">
            <div className="tab-row">
              <button className={`fd-tab ${recipeTab === 'standard' ? 'active' : ''}`} onClick={() => setRecipeTab('standard')}>标准版</button>
              <button className={`fd-tab ${recipeTab === 'mine' ? 'active' : ''} ${!hasMyVersion ? 'fd-tab-muted' : ''}`} onClick={() => setRecipeTab('mine')}>
                我家版{hasMyVersion ? '' : '（未创建）'}
              </button>
              <button className={`fd-tab ${recipeTab === 'partner' ? 'active' : ''}`} onClick={() => setRecipeTab('partner')}>搭子偏好</button>
            </div>

            {/* 我家版差异对比 */}
            {recipeTab === 'mine' && hasMyVersion && (
              <div className="diff-panel">
                <h4>📋 与标准版的差异</h4>
                {ingredientDiff.filter((d) => d.changed !== 'same').length === 0 && addedByMe.length === 0 ? (
                  <p className="diff-same">食材与标准版一致，仅步骤/备注有调整。</p>
                ) : (
                  <div className="diff-list">
                    {ingredientDiff.filter((d) => d.changed === 'changed').map((d) => (
                      <div key={d.name} className="diff-row diff-changed">
                        <span>{d.name}</span>
                        <em>标准 {d.std} → 我家 {d.mine}</em>
                      </div>
                    ))}
                    {ingredientDiff.filter((d) => d.changed === 'removed').map((d) => (
                      <div key={d.name} className="diff-row diff-removed">
                        <span>{d.name}</span>
                        <em>我家版去掉了</em>
                      </div>
                    ))}
                    {addedByMe.map((d) => (
                      <div key={d.name} className="diff-row diff-added">
                        <span>{d.name}</span>
                        <em>我家版新增 {d.amount}</em>
                      </div>
                    ))}
                  </div>
                )}
                {myVersion.myNote && (
                  <div className="my-note-box">
                    <strong>📝 我家备注</strong>
                    <p>{myVersion.myNote}</p>
                  </div>
                )}
              </div>
            )}

            {/* 我家版未创建提示 */}
            {recipeTab === 'mine' && !hasMyVersion && (
              <div className="diff-panel">
                <p className="diff-empty">还没创建我家版。做完这道菜后点"标记做过"，饭团会帮你沉淀你家版调整。</p>
              </div>
            )}

            {/* 搭子偏好提示 */}
            {recipeTab === 'partner' && (
              <div className="diff-panel">
                <p className="diff-empty">搭子偏好将根据家庭成员口味自动调整食材份量和调味。请先在家庭空间中设置搭子信息。</p>
              </div>
            )}

            <h3>食材清单{recipeTab === 'mine' && hasMyVersion ? '（我家版）' : ''}</h3>
            <div className="ingredient-list">
              {displayIngredients.map((ing) => {
                const hasIngredient = pantryNames.has(ing.name)
                return (
                  <div key={ing.name} className={`ingredient-row ${hasIngredient ? 'ok' : 'miss'}`}>
                    <span>{ing.name} {ing.amount}</span>
                    <em>{hasIngredient ? '冰箱有' : '缺少'}</em>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="fd-panel">
            <h3>做法步骤{recipeTab === 'mine' && hasMyVersion ? '（我家版）' : ''}</h3>
            <ol className="step-list">
              {displaySteps.map((step, i) => (
                <li key={i}>
                  <span className="step-num">{i + 1}</span>
                  <span className="step-text">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="fd-panel">
            <h3>健康摘要</h3>
            <div className="health-summary">
              <div className="health-card">
                <strong>控油友好</strong>
                <span>建议少油先炒蛋，番茄出汁后再回锅。</span>
              </div>
              <div className="health-card">
                <strong>蛋白质适中</strong>
                <span>鸡蛋提供基础蛋白，适合家常晚餐。</span>
              </div>
              <div className="health-card">
                <strong>非医疗建议</strong>
                <span>仅作为饮食参考，不替代医学判断。</span>
              </div>
            </div>
          </section>
        </div>

        {/* 右侧 */}
        <aside className="detail-aside">
          <section className="fd-side-card">
            <h4>🧊 冰箱匹配</h4>
            <div className="fd-list-item">
              <span>已有食材</span>
              <strong>{match.have} 种</strong>
            </div>
            <div className="fd-list-item">
              <span>缺少食材</span>
              <strong>{match.missing} 种</strong>
            </div>
            {match.missingNames.length > 0 && (
              <div className="fd-list-item">
                <span>建议补充</span>
                <strong>{match.missingNames.join('、')}</strong>
              </div>
            )}
          </section>

          <section className="fd-side-card">
            <h4>📝 加入后会发生什么</h4>
            <div className="fd-list-item">
              <span>→ 加入今晚计划</span>
            </div>
            <div className="fd-list-item">
              <span>→ 检查冰箱匹配</span>
            </div>
            <div className="fd-list-item">
              <span>→ 生成购物清单</span>
            </div>
            <div className="fd-list-item">
              <span>→ 做完记录沉淀我家版</span>
            </div>
            <div className="fd-list-item">
              <span>→ 饭团奖励 +15 🌾</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
