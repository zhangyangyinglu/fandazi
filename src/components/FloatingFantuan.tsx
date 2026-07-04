import { useMemo, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useFandaziStore } from '@/stores/fandaziStore'
import './FloatingFantuan.css'

function routeMessage(pathname: string) {
  if (pathname.startsWith('/pantry')) return '我看到番茄和豆腐快过期了，可以优先搭一桌。'
  if (pathname.startsWith('/plan')) return '这桌先看蛋白、蔬菜、主食，再看谁今天更需要清淡。'
  if (pathname.startsWith('/shopping')) return '买清单不是 TODO，我会按菜品来源帮你补齐。'
  if (pathname.startsWith('/mine')) return '做过的口味反馈会沉淀成你家的版本。'
  if (pathname.startsWith('/health')) return '先填成员健康问卷，我再按 2026 膳食指南配餐。'
  if (pathname.startsWith('/ai-kitchen')) return 'AI Key 用你自己的，公开 Demo 不读取私人数据。'
  if (pathname.startsWith('/fantuan')) return '我一直在，不只是一个页面里的状态数字。'
  return '今天先按蛋白 + 蔬菜 + 主食的餐盘结构搭一版。'
}

export function FloatingFantuan() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const fantuan = useFandaziStore((s) => s.fantuan)
  const message = useMemo(() => routeMessage(location.pathname), [location.pathname])

  return (
    <aside className={open ? 'floating-fantuan open' : 'floating-fantuan'} aria-label="全局饭团助手">
      {open && (
        <div className="fantuan-popover">
          <div className="fantuan-popover-head">
            <strong>饭团在这里</strong>
            <span>Lv.{fantuan.level} · 🌾{fantuan.mili}</span>
          </div>
          <p>{message}</p>
          <div className="fantuan-actions">
            <Link to="/health">健康问卷</Link>
            <Link to="/plan">看计划</Link>
            <Link to="/fantuan">任务</Link>
          </div>
        </div>
      )}
      <button className="fantuan-float-button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="fantuan-face">🍙</span>
        <span className="fantuan-pulse" />
      </button>
    </aside>
  )
}
