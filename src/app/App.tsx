import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { FloatingFantuan } from '@/components/FloatingFantuan'
import { RecipeWorkspacePage } from '@/pages/RecipeWorkspacePage'
import { RecipeDetailPage } from '@/pages/RecipeDetailPage'
import { PantryPage } from '@/pages/PantryPage'
import { PlanPage } from '@/pages/PlanPage'
import { ShoppingPage } from '@/pages/ShoppingPage'
import { MinePage } from '@/pages/MinePage'
import { FantuanPage } from '@/pages/FantuanPage'
import { AIKitchenPage } from '@/pages/AIKitchenPage'
import { HealthPage } from '@/pages/HealthPage'
import { FamilyPage } from '@/pages/FamilyPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '@/components/TopNav.css'

const MOBILE_NAV_ITEMS = [
  { to: '/', label: '菜品', end: true },
  { to: '/pantry', label: '冰箱', end: false },
  { to: '/plan', label: '计划', end: false },
  { to: '/fantuan', label: '饭团', end: false },
  { to: '/mine', label: '我的', end: false },
]

function MobileBottomNav() {
  return (
    <nav className="fd-mobile-bottom">
      {MOBILE_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <div className="fd-desktop-shell">
        <TopNav />
        <main className="fd-main">
          <Routes>
            <Route path="/" element={<RecipeWorkspacePage />} />
            <Route path="/recipes/:id" element={<RecipeDetailPage />} />
            <Route path="/pantry" element={<PantryPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/shopping" element={<ShoppingPage />} />
            <Route path="/mine" element={<MinePage />} />
            <Route path="/fantuan" element={<FantuanPage />} />
            <Route path="/ai-kitchen" element={<AIKitchenPage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/family" element={<FamilyPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
      <FloatingFantuan />
      <MobileBottomNav />
    </BrowserRouter>
  )
}
