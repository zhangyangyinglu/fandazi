import { useNavigate } from 'react-router-dom'
import './FirstUsePage.css'

export function FirstUsePage() {
  const navigate = useNavigate()

  return (
    <div className="first-use-page">
      <section className="first-use-hero">
        <div className="hero-label">第一次使用 · 只需几分钟</div>
        <h1>先把你的这一餐搭起来</h1>
        <p>先了解饭搭子会怎么工作。你的饮食目标和需要避开的内容，请统一在“健康”里填写，之后也可以随时修改。</p>
      </section>

      <section className="first-use-panel">
        <div className="first-use-step"><span>1</span><div><h2>先填写自己的健康问卷</h2><p>每个人填写自己的饮食目标和限制，家庭推荐会据此调整。</p></div></div>
      </section>

      <section className="first-use-panel">
        <div className="first-use-step"><span>2</span><div><h2>看看第一份推荐</h2><p>问卷保存后，饭搭子会根据你的设置、冰箱食材和餐盘结构排序菜品。</p></div></div>
      </section>

      <section className="first-use-panel">
        <div className="first-use-step"><span>3</span><div><h2>之后按需要继续使用</h2><p>加入计划会生成购物清单，做完饭后的反馈会慢慢沉淀成你们家的口味。</p></div></div>
      </section>

      <section className="first-use-logic">
        <h2>饭搭子接下来会自动做什么？</h2>
        <div className="logic-grid">
          <div><strong>推荐</strong><span>结合你们的偏好、约束和 2026 膳食指南排序</span></div>
          <div><strong>冰箱</strong><span>优先使用已有食材，并提示缺什么</span></div>
          <div><strong>计划</strong><span>选菜加入计划后，缺少的食材进入购物清单</span></div>
          <div><strong>反馈</strong><span>做完和吃完后反馈，慢慢沉淀成你们家的口味</span></div>
        </div>
      </section>

      <button className="fd-btn fd-btn-primary first-use-submit" type="button" onClick={() => navigate('/health')}>去健康页完成问卷</button>
      <p className="first-use-note">健康问卷不是医学诊断；特殊疾病、过敏和用药情况请以专业医嘱为准。</p>
    </div>
  )
}
