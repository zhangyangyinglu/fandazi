import { FormEvent, useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useFandaziStore } from '@/stores/fandaziStore'

const NAV_ITEMS = [
  { to: '/', label: '菜品', end: true },
  { to: '/pantry', label: '冰箱' },
  { to: '/plan', label: '计划' },
  { to: '/shopping', label: '购物清单' },
  { to: '/mine', label: '我家版' },
  { to: '/fantuan', label: '饭团' },
  { to: '/ai-kitchen', label: 'AI厨房' },
  { to: '/health', label: '健康' },
  { to: '/family', label: '家庭空间' },
]

export function TopNav() {
  const fantuan = useFandaziStore((s) => s.fantuan)
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isPantry = location.pathname.startsWith('/pantry')
  const [query, setQuery] = useState(searchParams.get('q') ?? '')

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '')
  }, [searchParams])

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      navigate(`/?q=${encodeURIComponent(trimmed)}`)
    } else if (location.pathname === '/') {
      navigate('/')
    } else {
      navigate('/')
    }
  }

  return (
    <header className="fd-topbar">
      <div className="fd-brand">
        <div className="fd-logo">饭</div>
        <span>饭搭子</span>
      </div>
      <nav className="fd-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'fd-nav-link active' : 'fd-nav-link')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <form className="fd-search" role="search" onSubmit={handleSearch}>
        <span aria-hidden="true">🔍</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={isPantry ? '搜食材 / 菜品' : '搜菜名 / 食材 / 场景'}
          aria-label={isPantry ? '搜食材 / 菜品' : '搜菜名 / 食材 / 场景'}
        />
      </form>
      <div className="fd-status">
        🍙 <b>Lv.{fantuan.level}</b> · 🌾{fantuan.mili}{isPantry ? ' · 副本2/4' : ''}
      </div>
    </header>
  )
}
