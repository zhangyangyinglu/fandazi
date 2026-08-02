import { FormEvent, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import './TopNav.css'

const PRIMARY_NAV = [
  { to: '/', label: '今天', end: true },
  { to: '/pantry', label: '冰箱' },
  { to: '/mine', label: '我的' },
]

const MORE_NAV = [
  { to: '/plan', label: '计划' },
  { to: '/shopping', label: '购物清单' },
  { to: '/catalog', label: '完整菜品库' },
  { to: '/fantuan', label: '饭团' },
  { to: '/ai-kitchen', label: 'AI厨房' },
  { to: '/health', label: '健康' },
  { to: '/family', label: '家庭空间' },
  { to: '/sync', label: '同步' },
]

export function TopNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isPantry = location.pathname.startsWith('/pantry')
  const searchAvailable = isPantry || location.pathname.startsWith('/catalog')
  const [searchOpen, setSearchOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 点击外部关闭"更多"下拉
  useEffect(() => {
    if (!moreOpen) return
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [moreOpen])

  // 搜索展开时聚焦输入框
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen])

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const trimmed = String(formData.get('q') ?? '').trim()
    if (trimmed) {
      const targetPath = location.pathname.startsWith('/pantry')
        ? '/pantry'
        : location.pathname.startsWith('/catalog')
          ? '/catalog'
          : '/'
      navigate(`${targetPath}?q=${encodeURIComponent(trimmed)}`)
      setSearchOpen(false)
    } else if (location.pathname === '/' || location.pathname.startsWith('/catalog') || location.pathname.startsWith('/pantry')) {
      navigate(location.pathname)
      setSearchOpen(false)
    } else {
      navigate('/')
      setSearchOpen(false)
    }
  }

  const moreActive = MORE_NAV.some((item) => location.pathname.startsWith(item.to))

  return (
    <>
    <header className="fd-topbar">
      <div className="fd-brand">
        <img src="/brand-logo.png" alt="饭搭子" className="fd-logo" width={32} height={32} />
        <span>饭搭子</span>
      </div>
      <nav className="fd-nav" role="navigation" aria-label="主导航">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'fd-nav-link active' : 'fd-nav-link')}
          >
            {item.label}
          </NavLink>
        ))}
        <div className="fd-nav-more" ref={moreRef}>
          <button
            type="button"
            className={`fd-nav-link fd-nav-more-btn ${moreActive ? 'active' : ''}`}
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-label="更多功能"
          >
            更多 ▾
          </button>
          {moreOpen && (
            <div className="fd-nav-dropdown">
              {MORE_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'fd-dropdown-link active' : 'fd-dropdown-link')}
                  onClick={() => setMoreOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>
      <div className="fd-top-right">
        {searchAvailable && <form
          className={searchOpen ? 'fd-inline-search open' : 'fd-inline-search'}
          role="search"
          onSubmit={handleSearch}
        >
          {searchOpen && (
            <>
              <input
                key={location.pathname}
                ref={searchInputRef}
                type="search"
                name="q"
                defaultValue={searchParams.get('q') ?? ''}
                placeholder={isPantry ? '搜食材 / 菜品' : '搜菜名 / 食材 / 场景'}
                aria-label={isPantry ? '搜食材 / 菜品' : '搜菜名 / 食材 / 场景'}
              />
              {searchParams.get('q') && (
                <button
                  type="button"
                  className="fd-inline-search-clear"
                  aria-label="清除搜索"
                  onClick={() => {
                    if (searchInputRef.current) searchInputRef.current.value = ''
                    navigate(isPantry ? '/pantry' : '/catalog')
                    setSearchOpen(false)
                  }}
                >✕</button>
              )}
            </>
          )}
          <button
            type={searchOpen ? 'submit' : 'button'}
            className="fd-search-trigger"
            onMouseDown={(event) => {
              if (!searchOpen) {
                event.preventDefault()
                event.stopPropagation()
                setSearchOpen(true)
              }
            }}
            onClick={(event) => {
              if (!searchOpen) {
                event.preventDefault()
                event.stopPropagation()
                setSearchOpen(true)
              }
            }}
            aria-label={searchOpen ? '提交搜索' : '搜索'}
            aria-expanded={searchOpen}
          >
            🔍
          </button>
          {searchOpen && <button type="button" className="fd-inline-search-close" onClick={() => setSearchOpen(false)}>取消</button>}
        </form>}
      </div>
    </header>

    </>
  )
}
