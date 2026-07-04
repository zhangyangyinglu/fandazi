import { Link } from 'react-router-dom'
import './NotFoundPage.css'

export function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-emoji">🍚</div>
      <h2>这个页面好像被饭团吃掉了</h2>
      <p>找不到你要找的页面，可能链接已过期或输入有误。</p>
      <Link to="/" className="not-found-back">回到首页</Link>
    </div>
  )
}
