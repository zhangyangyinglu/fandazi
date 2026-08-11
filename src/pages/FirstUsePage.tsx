import { useNavigate } from 'react-router-dom'
import './FirstUsePage.css'

export function FirstUsePage() {
  const navigate = useNavigate()

  return (
    <div className="first-use-page">
      <section className="first-use-hero">
        <div className="hero-label">饭搭子 · 第一次使用</div>
        <h1>先用 1–2 分钟告诉饭搭子你怎么吃</h1>
        <p>先写一句你希望饭团帮你解决的事情，再补充目标、人数、需要避开的内容和做饭节奏。保存前饭团会把你的需求整理成一份可回看的摘要。</p>
        <div className="first-use-product-note">
          <strong>饭搭子是什么？</strong>
          <span>你日常使用的是一个可以添加到主屏幕、像 App 一样打开的网页 App（PWA）；“饭搭子项目”只是我们开发它的代码项目，不是另一个需要你使用的东西。</span>
        </div>
        <button className="fd-btn fd-btn-primary first-use-start" type="button" onClick={() => navigate('/health')}>
          开始 1–2 分钟问卷
        </button>
      </section>

      <section className="first-use-panel">
        <div className="first-use-step"><span>1</span><div><h2>先填写自己的饮食需求</h2><p>先用自己的话写清想解决什么，再选 1–2 个方向，补充人数、忌口和做饭节奏。</p></div></div>
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
