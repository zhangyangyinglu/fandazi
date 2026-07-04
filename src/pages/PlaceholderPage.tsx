/**
 * 通用页面占位 — P1-2 阶段其他页面先占位，后续 P2 填充
 */
import './PlaceholderPage.css'

export function PlaceholderPage({
  title,
  icon,
  description,
}: {
  title: string
  icon: string
  description: string
}) {
  return (
    <div className="placeholder-page">
      <div className="fd-hero-card">
        <div className="placeholder-icon">{icon}</div>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="cta-row">
          <button className="fd-btn fd-btn-secondary">即将开放</button>
        </div>
      </div>
    </div>
  )
}
