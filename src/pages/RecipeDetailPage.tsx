import { Link, useParams } from 'react-router-dom'
import { DISHES } from '@/data/dishes'
import { useFandaziStore } from '@/stores/fandaziStore'
import './RecipeDetailPage.css'

function getDishEmoji(name: string, category: string, tags: string[]): string {
  const text = `${name} ${category} ${tags.join(' ')}`
  if (/汤|羹|煲/.test(text)) return '🥣'
  if (/虾|鱼|海|三文鱼|鲈/.test(text)) return '🦐'
  if (/鸡|蛋/.test(text)) return '🍳'
  if (/牛|肉/.test(text)) return '🥩'
  if (/面|饭|主食|糙米|荞麦/.test(text)) return '🍚'
  if (/菜|生菜|菠菜|空心菜|西兰花|芦笋|黄瓜/.test(text)) return '🥬'
  if (/番茄|彩椒/.test(text)) return '🍅'
  return '🍽️'
}

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const dish = DISHES.find((d) => d.id === id)
  const addMealPlan = useFandaziStore((s) => s.addMealPlan)
  const pantry = useFandaziStore((s) => s.pantry)

  if (!dish) {
    return (
      <div className="fd-main">
        <p>菜品不存在</p>
        <Link to="/">返回菜品工作区</Link>
      </div>
    )
  }

  // 在 selector 外计算
  const pantryNames = new Set(pantry.map((p) => p.ingredientName))
  const match = {
    have: dish.ingredients.filter((ing) => pantryNames.has(ing.name)).length,
    missing: dish.ingredients.filter((ing) => !pantryNames.has(ing.name)).length,
    missingNames: dish.ingredients.filter((ing) => !pantryNames.has(ing.name)).map((ing) => ing.name),
  }

  const handleAddToPlan = () => {
    const today = new Date().toISOString().slice(0, 10)
    addMealPlan(dish.id, today)
  }

  return (
    <div className="recipe-detail">
      <div className="detail-breadcrumb">
        <Link to="/" className="back-link">← 返回菜品</Link>
        <span>菜品 / {dish.category} / {dish.name}</span>
      </div>

      {/* 标题区 */}
      <div className="detail-hero">
        <div className="detail-photo" style={{ background: `linear-gradient(135deg, ${dish.color}, #fff6e7)` }}>
          <span>{getDishEmoji(dish.name, dish.category, dish.tags)}</span>
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
            <button className="fd-btn fd-btn-primary" onClick={handleAddToPlan}>加入今晚计划</button>
            <Link to="/shopping"><button className="fd-btn fd-btn-secondary">加入购物清单</button></Link>
            <Link to="/mine"><button className="fd-btn fd-btn-green">标记做过</button></Link>
            <Link to="/mine"><button className="fd-btn fd-btn-secondary">改成我家版</button></Link>
          </div>
        </section>
      </div>

      {/* 工作区 */}
      <div className="detail-workspace">
        <div className="detail-main">
          {/* 食材 + 做法 */}
          <section className="fd-panel">
            <div className="tab-row">
              <button className="fd-tab active">标准版</button>
              <button className="fd-tab">我家版</button>
              <button className="fd-tab">搭子偏好</button>
            </div>
            <h3>食材清单</h3>
            <div className="ingredient-list">
              {dish.ingredients.map((ing) => {
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
            <h3>做法步骤</h3>
            <ol className="step-list">
              {dish.steps.map((step, i) => (
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
          <section className="fd-side-card fantuan-card">
            <h4>🍙 饭团建议</h4>
            <div className="fd-bubble">
              这道菜适合搭配一道绿叶蔬菜，饭团帮你看看冰箱里有什么？
            </div>
            <div className="cta-row" style={{ marginTop: '18px' }}>
              <button className="fd-btn fd-btn-primary">搭配一桌</button>
              <button className="fd-btn fd-btn-secondary">让饭团改一下</button>
            </div>
          </section>

          <section className="fd-side-card">
            <h4>冰箱匹配</h4>
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
            <h4>加入后会发生什么</h4>
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
