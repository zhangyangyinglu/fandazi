import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import '@/components/TopNav.css'

function MobileBottomNav() {
  return (
    <nav className="fd-mobile-bottom">
      <span>菜品</span>
      <span>冰箱</span>
      <span>计划</span>
      <span>饭团</span>
      <span className="active">我的</span>
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
            <Route path="/family" element={
              <PlaceholderPage icon="👨‍👩‍👧" title="家庭空间" description="邀请一起吃饭的人、共享冰箱/计划/记录——P3 Supabase 阶段实现。" />
            } />
          </Routes>
        </main>
      </div>
      <FloatingFantuan />
      <MobileBottomNav />
    </BrowserRouter>
  )
}
