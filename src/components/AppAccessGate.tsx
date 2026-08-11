import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { FANDAZI_SYNC_CONFIG_EVENT, isSupabaseConfigured } from '@/lib/supabaseClient'
import { getCurrentUser, getMyHousehold } from '@/lib/familyAuth'
import { HEALTH_PROFILES_STORAGE_KEY } from '@/components/healthProfileStorage'
import { hasAuthHandoffAccess } from '@/lib/authHandoff'

export const LOCAL_MODE_CONFIRMED_KEY = 'fandazi.localModeConfirmed'
export const FIRST_USE_COMPLETED_KEY = 'fandazi.firstUseCompleted'
export const FIRST_USE_COMPLETED_EVENT = 'fandazi-first-use-completed'

type GateState = 'checking' | 'configuration' | 'auth' | 'household' | 'first-use' | 'ready' | 'local'

function hasConfirmedLocalMode(): boolean {
  try {
    return localStorage.getItem(LOCAL_MODE_CONFIRMED_KEY) === 'true'
  } catch {
    return false
  }
}

function hasCompletedFirstUse(): boolean {
  try {
    if (localStorage.getItem(FIRST_USE_COMPLETED_KEY) !== 'true') return false
    const rawProfiles = localStorage.getItem(HEALTH_PROFILES_STORAGE_KEY)
    const profiles = rawProfiles ? JSON.parse(rawProfiles) : []
    return Array.isArray(profiles) && profiles.length > 0
  } catch {
    return false
  }
}

export function AppAccessGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [state, setState] = useState<GateState>('checking')

  const checkAccess = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setState(hasConfirmedLocalMode()
        ? (hasCompletedFirstUse() ? 'local' : 'first-use')
        : 'configuration')
      return
    }

    const user = await getCurrentUser()
    if (!user) {
      setState('auth')
      return
    }

    const household = await getMyHousehold(user.id)
    if (!household) {
      setState('household')
      return
    }

    setState(hasCompletedFirstUse() ? 'ready' : 'first-use')
  }, [])

  useEffect(() => {
    queueMicrotask(() => void checkAccess())
    const handleChange = () => void checkAccess()
    window.addEventListener(FANDAZI_SYNC_CONFIG_EVENT, handleChange)
    window.addEventListener(FIRST_USE_COMPLETED_EVENT, handleChange)
    return () => {
      window.removeEventListener(FANDAZI_SYNC_CONFIG_EVENT, handleChange)
      window.removeEventListener(FIRST_USE_COMPLETED_EVENT, handleChange)
    }
  }, [checkAccess])

  if (state === 'checking') {
    return <div className="access-loading">正在检查家庭空间…</div>
  }

  // 同步页承担配置、登录、注册和创建/加入家庭流程，必须允许未完成用户进入。
  if (location.pathname === '/sync') return <>{children}</>

  // 保存问卷后，事件和路由更新可能先后到达；以本地事实源为准，避免刚完成就被门禁送回问卷页。
  if (state === 'first-use' && hasCompletedFirstUse()) {
    return location.pathname === '/welcome' || location.pathname === '/health'
      ? <Navigate to="/" replace />
      : <>{children}</>
  }
  // 已从另一台设备接力登录的老用户不需要在新设备重复首次问卷，直接进入主界面。
  if (state === 'first-use' && hasAuthHandoffAccess()) return <>{children}</>
  if ((location.pathname === '/welcome' || location.pathname === '/health') && state === 'first-use') return <>{children}</>

  if (state === 'configuration') {
    return <Navigate to="/sync" replace />
  }
  if (state === 'auth' || state === 'household') {
    return <Navigate to="/sync" replace />
  }
  if (state === 'first-use') {
    return <Navigate to="/welcome" replace />
  }

  return <>{children}</>
}
