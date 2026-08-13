import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { FANDAZI_SYNC_CONFIG_EVENT, isSupabaseConfigured } from '@/lib/supabaseClient'
import { getCurrentUser, getMyHousehold, markFirstUseCompletedInCloud } from '@/lib/familyAuth'
import { hasAuthHandoffAccess } from '@/lib/authHandoff'

export const LOCAL_MODE_CONFIRMED_KEY = 'fandazi.localModeConfirmed'
export const FIRST_USE_COMPLETED_KEY = 'fandazi.firstUseCompleted'
export const FIRST_USE_COMPLETED_EVENT = 'fandazi-first-use-completed'

type GateState = 'checking' | 'configuration' | 'auth' | 'household' | 'first-use' | 'ready' | 'local' | 'error'

/** 门禁检查整体超时：超过该时长仍未完成则进入错误态，不再无限转圈。 */
const CHECK_TIMEOUT_MS = 10000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      window.setTimeout(() => reject(new Error(`${label}超时`)), ms)
    }),
  ])
}

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
    // 健康档案仅存本地；清缓存后丢失不应阻断已登录用户进入主界面。
    // 只要本地标记为 true（可能由 getCurrentUser 从云端恢复），就视为已完成。
    return true
  } catch {
    return false
  }
}

export function AppAccessGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [state, setState] = useState<GateState>('checking')

  const checkAccessInner = async () => {
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

    // 已有家庭空间的登录用户必定已完成过首次使用；清缓存/换设备后本地标记丢失，
    // 不应再强制填问卷。直接放行，并在云端补标记（异步，不阻塞）。
    if (!hasCompletedFirstUse()) {
      try { localStorage.setItem(FIRST_USE_COMPLETED_KEY, 'true') } catch { /* ignore */ }
      void markFirstUseCompletedInCloud()
    }
    setState(hasCompletedFirstUse() ? 'ready' : 'first-use')
  }

  const checkAccess = useCallback(async () => {
    // 任何一步失败/超时都不能让用户永远卡在"正在检查"——进入错误态给出口。
    try {
      await withTimeout(checkAccessInner(), CHECK_TIMEOUT_MS, '加载')
    } catch (err) {
      console.error('[AppAccessGate] 门禁检查失败：', err)
      setState('error')
    }
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

  // 加载失败/超时：绝不让用户卡死。给三个出口——重试、深度修复（清 SW 缓存，不动数据）、回登录页。
  if (state === 'error') {
    return (
      <div className="access-loading" style={{ flexDirection: 'column', gap: '12px', padding: '24px', textAlign: 'center' }}>
        <div>加载有点慢，可能是缓存或网络的问题。</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="fd-btn fd-btn-primary" onClick={() => { setState('checking'); void checkAccess() }}>
            重试
          </button>
          <button
            className="fd-btn fd-btn-secondary"
            onClick={() => {
              // 深度修复：注销 SW + 清缓存（保留登录和全部本地数据），然后刷新。
              void (async () => {
                try {
                  if ('serviceWorker' in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations()
                    await Promise.all(regs.map((r) => r.unregister()))
                  }
                  if ('caches' in window) {
                    const names = await caches.keys()
                    await Promise.all(names.map((n) => caches.delete(n)))
                  }
                } finally {
                  window.location.reload()
                }
              })()
            }}
          >
            修复并刷新
          </button>
          <button className="fd-btn fd-btn-secondary" onClick={() => { window.location.href = '/sync' }}>
            去登录页
          </button>
        </div>
      </div>
    )
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
