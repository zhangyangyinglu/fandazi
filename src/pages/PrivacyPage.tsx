/**
 * 隐私政策页面
 */
import { Link, useNavigate } from 'react-router-dom'
import './PrivacyPage.css'

export function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <div className="privacy-page">
      <div className="privacy-container">
        <div className="privacy-header">
          <div className="hero-label">法律文档</div>
          <h1>隐私政策</h1>
          <p className="privacy-update-date">最后更新：2026 年 7 月 6 日</p>
        </div>

        <section className="privacy-section">
          <h2>1. 我们的原则</h2>
          <p>
            饭搭子是一个<strong>离线优先</strong>的家庭做饭助手。你的数据默认存储在<strong>你自己的浏览器本地</strong>（localStorage），
            不会自动上传到任何服务器。你可以完全控制数据的去向。
          </p>
        </section>

        <section className="privacy-section">
          <h2>2. 数据存储位置</h2>
          <table className="privacy-table">
            <thead>
              <tr><th>数据类型</th><th>默认存储</th><th>是否上传</th></tr>
            </thead>
            <tbody>
              <tr><td>冰箱食材</td><td>浏览器 localStorage</td><td>仅在你开启家庭同步时</td></tr>
              <tr><td>菜品计划</td><td>浏览器 localStorage</td><td>仅在你开启家庭同步时</td></tr>
              <tr><td>购物清单</td><td>浏览器 localStorage</td><td>仅在你开启家庭同步时</td></tr>
              <tr><td>做饭记录 / 我家版</td><td>浏览器 localStorage</td><td>仅在你开启家庭同步时</td></tr>
              <tr><td>饭团游戏数据</td><td>浏览器 localStorage</td><td>仅在你开启家庭同步时</td></tr>
              <tr><td>健康档案</td><td>浏览器 localStorage</td><td>家庭同步时家庭可见，各自编辑</td></tr>
              <tr><td>AI 服务密钥</td><td>浏览器 localStorage / 家庭云端</td><td>家庭同步开启时共享给家庭组，未开启时仅本机</td></tr>
              <tr><td>Supabase 账号密码</td><td>不存储（直接发给 Supabase）</td><td>由 Supabase 管理</td></tr>
            </tbody>
          </table>
        </section>

        <section className="privacy-section">
          <h2>3. 外部服务的处理</h2>
          <p>
            当前 AI 厨房已支持配置外部 AI 服务（DeepSeek / OpenAI / 自定义）。
            配置后，饭团会读取你允许的上下文（冰箱、计划、口味）发送给 AI 模型来生成建议。
            不配置时，饭团完全在本地运行，不会调用任何外部服务。
          </p>
          <ul>
            <li>❌ 不会上传到饭搭子的服务器（饭搭子没有自己的服务器）</li>
            <li>🔒 AI Key 在家庭同步开启时，保存在家庭组云端（Supabase），家庭组内任意成员添加后全组可用</li>
            <li>📱 未开启家庭同步时，AI Key 只保存在本机浏览器</li>
            <li>✅ 配置 AI 后，饭团会把你允许的上下文（冰箱、计划、口味）发给 AI 模型获取建议</li>
            <li>✅ 饭团的"加入计划""生成购物项"等操作需要你确认才会执行</li>
            <li>✅ 不配置 AI 时，饭团完全在本地运行，不调用任何外部服务</li>
          </ul>
          <p>清除浏览器数据或点击「清除 Supabase 配置」可删除本机保存的同步配置。</p>
        </section>

        <section className="privacy-section">
          <h2>4. 家庭同步（Supabase）</h2>
          <p>
            如果你选择开启家庭同步，数据将通过 <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">Supabase</a> 在家庭成员间共享。
          </p>
          <ul>
            <li>Supabase 项目由<strong>你自己创建</strong>，数据存储在你自己的 Supabase 实例中</li>
            <li>饭搭子团队不接触你的数据</li>
            <li>家庭组内的成员可以看到共享数据（冰箱、计划、购物清单等）</li>
            <li>健康档案家庭可见，但只能各自编辑自己的</li>
            <li>你可以随时在 Supabase 控制台删除所有数据</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>5. 默认数据与私人数据</h2>
          <p>
            初次打开时，饭搭子会展示默认菜品、默认家庭成员和默认冰箱内容，方便你马上试用。你保存的家庭、冰箱、计划、购物清单和做饭记录都以你的本机数据为准。
          </p>
        </section>

        <section className="privacy-section">
          <h2>6. 数据删除</h2>
          <p>你可以通过以下方式删除数据：</p>
          <ul>
            <li><strong>本地数据</strong>：清除浏览器 localStorage，或在同步页面点击「清除 Supabase 配置」</li>
            <li><strong>云端数据</strong>：登录 Supabase 控制台，删除对应表的数据或删除整个项目</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>7. Cookie 与追踪</h2>
          <p>
            饭搭子<strong>不使用 Cookie</strong>，不使用任何第三方分析或追踪工具（无 Google Analytics、无 Sentry 等）。
            你的使用行为不被追踪。
          </p>
        </section>

        <section className="privacy-section">
          <h2>8. 儿童隐私</h2>
          <p>
            饭搭子面向家庭使用。如果家庭成员包含未成年人，由家长负责创建和管理其健康档案。
            饭搭子不收集任何个人信息。
          </p>
        </section>

        <section className="privacy-section">
          <h2>9. 开源透明</h2>
          <p>
            饭搭子是开源软件（MIT License），源代码在 <a href="https://github.com/fandazi/fandazi-web-tool" target="_blank" rel="noopener noreferrer">GitHub</a> 公开。
            任何人可以审查代码，验证数据流向。
          </p>
        </section>

        <section className="privacy-section">
          <h2>10. 联系方式</h2>
          <p>如有隐私相关问题，请在 GitHub 仓库提 Issue。</p>
        </section>

        <div className="privacy-footer">
          <button type="button" className="fd-btn fd-btn-primary" onClick={() => navigate(-1)}>返回上一级</button>
          <Link to="/" className="fd-btn fd-btn-secondary">返回首页</Link>
          <Link to="/health" className="fd-btn fd-btn-secondary">查看健康档案</Link>
        </div>
      </div>
    </div>
  )
}
