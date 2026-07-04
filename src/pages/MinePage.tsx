/**
 * 我家版+做饭记录页 — P2-5
 * 对应渲染图：P1-1e 我家版+做饭记录页 v6
 */
import { Link } from 'react-router-dom'
import { useFandaziStore } from '@/stores/fandaziStore'
import { DISHES } from '@/data/dishes'
import './MinePage.css'

export function MinePage() {
  const cookingLogs = useFandaziStore((s) => s.cookingLogs)
  const myDishVersions = useFandaziStore((s) => s.myDishVersions)
  const fantuan = useFandaziStore((s) => s.fantuan)
  const getDishById = useFandaziStore((s) => s.getDishById)

  // 做过的菜（去重）
  const cookedDishIds = new Set(cookingLogs.map((log) => log.dishId))
  const cookedDishes = Array.from(cookedDishIds)
    .map((id) => getDishById(id))
    .filter(Boolean)
  const demoDishes = ['broccoli-chicken-egg', 'tomato-tofu-shrimp-soup', 'asparagus-shrimp-mushroom']
    .map((id) => DISHES.find((dish) => dish.id === id))
    .filter(Boolean)
  const displayDishes = cookedDishes.length > 0 ? cookedDishes : demoDishes
  const displayLogs = cookingLogs.length > 0
    ? cookingLogs
    : [
        { id: 'demo-log-1', dishId: 'broccoli-chicken-egg', dishName: '西兰花鸡胸肉炒蛋', date: '2026-07-04', note: '鸡胸肉切小一点，阿川觉得更入味。', miliReward: 15 },
        { id: 'demo-log-2', dishId: 'tomato-tofu-shrimp-soup', dishName: '番茄豆腐虾仁汤', date: '2026-07-03', note: '番茄可以多炒一会儿，汤底更浓。', miliReward: 20 },
        { id: 'demo-log-3', dishId: 'asparagus-shrimp-mushroom', dishName: '芦笋虾仁炒口蘑', date: '2026-07-01', note: '口蘑别切太薄，保留汁水。', miliReward: 15 },
      ]
  const displayCookedCount = cookingLogs.length > 0 ? cookedDishes.length : 23
  const displayTotalCooked = fantuan.totalCooked > 0 ? fantuan.totalCooked : 12

  return (
    <div className="mine-page">
      {/* Hero */}
      <div className="mine-hero">
        <div className="fd-hero-card">
          <div className="hero-label">示例家庭 · 小夏 + 阿川</div>
          <h2>你家做过 {displayCookedCount} 道菜，饭团帮你记着每次口味调整</h2>
          <p>
            每次标记“做过”后，饭团会问你一句口味反馈，沉淀成你家独有版本。下次做同一道菜，自动带上你的调整。
          </p>
          <div className="cta-row">
            <button className="fd-btn fd-btn-primary">看我家菜品</button>
            <button className="fd-btn fd-btn-secondary">看做饭记录</button>
            <button className="fd-btn fd-btn-green">导出我家菜谱</button>
          </div>
        </div>
        <div className="fd-side-card">
          <h4>🌾 饭团状态</h4>
          <div className="fd-list-item">
            <span>米粒</span>
            <strong>🌾 {fantuan.mili}</strong>
          </div>
          <div className="fd-list-item">
            <span>等级</span>
            <strong>Lv.{fantuan.level}</strong>
          </div>
          <div className="fd-list-item">
            <span>累计做菜</span>
            <strong>{displayTotalCooked} 次</strong>
          </div>
        </div>
      </div>

      <div className="mine-workspace">
        <main className="mine-main">
          {/* 我家菜品 */}
          <section className="fd-panel">
            <div className="tab-row">
              <button className="fd-tab active">我家菜品</button>
              <button className="fd-tab">做饭记录</button>
              <button className="fd-tab">口味偏好</button>
              <button className="fd-tab">搭子偏好</button>
            </div>
            <h3>我家菜品</h3>
            {displayDishes.map((dish) => {
                if (!dish) return null
                const myVersion = myDishVersions.find((v) => v.dishId === dish.id)
                const logCount = cookingLogs.length > 0
                  ? cookingLogs.filter((l) => l.dishId === dish.id).length
                  : dish.id === 'broccoli-chicken-egg' ? 8 : dish.id === 'tomato-tofu-shrimp-soup' ? 5 : 3
                const tweak = myVersion?.myNote ?? (dish.id === 'broccoli-chicken-egg'
                  ? '鸡胸肉切小一点，阿川觉得更入味'
                  : dish.id === 'tomato-tofu-shrimp-soup'
                    ? '番茄多炒一会儿，汤底更浓'
                    : '口蘑别切太薄，保留汁水')
                return (
                  <div key={dish.id} className="mine-dish fd-list-item">
                    <div className="mine-dish-info">
                      <Link to={`/recipes/${dish.id}`} className="mine-dish-name">{dish.name}</Link>
                      <div className="mine-dish-meta">
                        <span>做过 {logCount} 次</span>
                        <span className="fd-badge gold">我家版</span>
                      </div>
                      <div className="mine-dish-note">
                        <span className="tweak-tag">📝 {tweak}</span>
                      </div>
                    </div>
                    <Link to={`/recipes/${dish.id}`} className="fd-btn fd-btn-secondary fd-btn-sm">查看</Link>
                  </div>
                )
              })}
          </section>

          {/* 做饭记录 */}
          <section className="fd-panel">
            <h3>做饭记录</h3>
            <div className="mine-timeline">
              {displayLogs.slice(0, 20).map((log) => (
                  <div key={log.id} className="record-row fd-list-item">
                    <span className="record-dot">🍳</span>
                    <div className="record-info">
                      <span className="record-date">{log.date}</span>
                      <Link to={`/recipes/${log.dishId}`} className="record-dish-name">
                        {log.dishName}
                      </Link>
                      {log.note && <span className="record-note">💬 {log.note}</span>}
                    </div>
                    <div className="record-reward">+{log.miliReward} 🌾</div>
                  </div>
                ))}
              </div>
          </section>
        </main>

        <aside className="mine-aside">
          <section className="fd-side-card fantuan-reminder">
            <h4>🍙 饭团说</h4>
            <div className="fd-bubble">
              {displayLogs.length >= 5
                ? `已经做了 ${displayLogs.length} 次饭了！继续保持，你的家庭口味档案越来越丰富了～`
                : '饭团已经记下几次口味反馈：下次做同一道菜，会自动带上你家的调整。'}
            </div>
          </section>

          {/* 口味偏好沉淀说明 */}
          <section className="fd-side-card">
            <h4>口味偏好怎么沉淀</h4>
            <div className="preference-flow">
              <div className="fd-list-item">
                <strong>① 做完标记</strong>
                <span className="flow-desc">计划页点“做完了”</span>
              </div>
              <div className="fd-list-item">
                <strong>② 口味反馈</strong>
                <span className="flow-desc">饭团问一句</span>
              </div>
              <div className="fd-list-item">
                <strong>③ 沉淀我家版</strong>
                <span className="flow-desc">调整记到菜谱</span>
              </div>
              <div className="fd-list-item">
                <strong>④ 下次自动带</strong>
                <span className="flow-desc">少踩坑</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
