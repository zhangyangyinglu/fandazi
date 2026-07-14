import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { FloatingFantuan } from '@/components/FloatingFantuan'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { OnboardingHint } from '@/components/OnboardingHint'
import { FantuanPetImage } from '@/components/FantuanPetImage'
import { AppAccessGate } from '@/components/AppAccessGate'
import { RecipeWorkspacePage } from '@/pages/RecipeWorkspacePage'
import { RecipeDetailPage } from '@/pages/RecipeDetailPage'
import { useFamilySync } from '@/lib/useFamilySync'
import '@/components/TopNav.css'
import './AppLazyFallback.css'

// 代码分割：非首屏页面全部 lazy load
const PantryPage = lazy(() => import('@/pages/PantryPage').then(m => ({ default: m.PantryPage })))
const PlanPage = lazy(() => import('@/pages/PlanPage').then(m => ({ default: m.PlanPage })))
const ShoppingPage = lazy(() => import('@/pages/ShoppingPage').then(m => ({ default: m.ShoppingPage })))
const MinePage = lazy(() => import('@/pages/MinePage').then(m => ({ default: m.MinePage })))
const FantuanPage = lazy(() => import('@/pages/FantuanPage').then(m => ({ default: m.FantuanPage })))
const AIKitchenPage = lazy(() => import('@/pages/AIKitchenPage').then(m => ({ default: m.AIKitchenPage })))
const HealthPage = lazy(() => import('@/pages/HealthPage').then(m => ({ default: m.HealthPage })))
const FamilyPage = lazy(() => import('@/pages/FamilyPage').then(m => ({ default: m.FamilyPage })))
const SyncSettingsPage = lazy(() => import('@/pages/SyncSettingsPage').then(m => ({ default: m.SyncSettingsPage })))
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })))
const FirstUsePage = lazy(() => import('@/pages/FirstUsePage').then(m => ({ default: m.FirstUsePage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

function PageFallback() {
  return (
    <div className="lazy-fallback">
      <div className="lazy-spinner"><FantuanPetImage state="thinking" /></div>
      <p>正在打开饭搭子页面，请稍候…</p>
    </div>
  )
}

const MOBILE_NAV_ITEMS = [
  { to: '/', label: '菜品', end: true },
  { to: '/pantry', label: '冰箱', end: false },
  { to: '/plan', label: '计划', end: false },
  { to: '/fantuan', label: '饭团', end: false },
]

function MobileBottomNav() {
  return (
    <nav className="fd-mobile-bottom" role="navigation" aria-label="底部导航">
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
  useFamilySync()

  useEffect(() => {
    const isLocalPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
    if (!isLocalPreview || !('serviceWorker' in navigator)) return

    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => void registration.unregister())
    })
    if ('caches' in window) {
      void caches.keys().then((names) => names.forEach((name) => void caches.delete(name)))
    }
  }, [])

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppAccessGate>
          <div className="fd-desktop-shell">
            <TopNav />
            <main className="fd-main">
              <Routes>
            <Route path="/" element={<RecipeWorkspacePage />} />
            <Route path="/catalog" element={<RecipeWorkspacePage catalogMode />} />
            <Route path="/recipes/:id" element={<RecipeDetailPage />} />
            <Route path="/pantry" element={<Suspense fallback={<PageFallback />}><PantryPage /></Suspense>} />
            <Route path="/plan" element={<Suspense fallback={<PageFallback />}><PlanPage /></Suspense>} />
            <Route path="/shopping" element={<Suspense fallback={<PageFallback />}><ShoppingPage /></Suspense>} />
            <Route path="/mine" element={<Suspense fallback={<PageFallback />}><MinePage /></Suspense>} />
            <Route path="/fantuan" element={<Suspense fallback={<PageFallback />}><FantuanPage /></Suspense>} />
            <Route path="/ai-kitchen" element={<Suspense fallback={<PageFallback />}><AIKitchenPage /></Suspense>} />
            <Route path="/health" element={<Suspense fallback={<PageFallback />}><HealthPage /></Suspense>} />
            <Route path="/family" element={<Suspense fallback={<PageFallback />}><FamilyPage /></Suspense>} />
            <Route path="/sync" element={<Suspense fallback={<PageFallback />}><SyncSettingsPage /></Suspense>} />
            <Route path="/welcome" element={<Suspense fallback={<PageFallback />}><FirstUsePage /></Suspense>} />
            <Route path="/privacy" element={<Suspense fallback={<PageFallback />}><PrivacyPage /></Suspense>} />
            <Route path="*" element={<Suspense fallback={<PageFallback />}><NotFoundPage /></Suspense>} />
              </Routes>
            </main>
          </div>
        </AppAccessGate>
      </ErrorBoundary>
      <OnboardingHint />
      <FloatingFantuan />
      <MobileBottomNav />
    </BrowserRouter>
  )
}
