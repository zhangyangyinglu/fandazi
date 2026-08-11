import { getSupabase } from '@/lib/supabaseClient'

export const AUTH_HANDOFF_QUERY_PARAM = 'auth_handoff'
export const AUTH_HANDOFF_ACCESS_KEY = 'fandazi.authHandoffAccess'
// 接力二维码必须进入当前对外可用的登录入口；不能跟随电脑端可能仍在使用的旧生产版本。
export const AUTH_HANDOFF_ENTRY_URL = 'https://fandazi-mobile-preview.vercel.app/sync'

export function grantAuthHandoffAccess(): void {
  try {
    localStorage.setItem(AUTH_HANDOFF_ACCESS_KEY, 'true')
  } catch {
    // 隐私模式下无法写入时，仍让当前页面继续完成跳转。
  }
}

export function hasAuthHandoffAccess(): boolean {
  try {
    return localStorage.getItem(AUTH_HANDOFF_ACCESS_KEY) === 'true'
  } catch {
    return false
  }
}

export function clearAuthHandoffAccess(): void {
  try {
    localStorage.removeItem(AUTH_HANDOFF_ACCESS_KEY)
  } catch {
    // localStorage 不可用时无需阻断退出登录。
  }
}

interface CreateHandoffResponse {
  token?: unknown
  expiresAt?: unknown
}

interface CompleteHandoffResponse {
  tokenHash?: unknown
}

function getFunctionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return '二维码登录服务暂时不可用'
}

export async function createAuthHandoff(): Promise<{
  token: string
  expiresAt: string
  error: string | null
}> {
  const supabase = getSupabase()
  if (!supabase) return { token: '', expiresAt: '', error: '当前没有配置家庭同步，无法生成接力二维码' }

  const { data, error } = await supabase.functions.invoke<CreateHandoffResponse>('create-auth-handoff', {
    body: {},
  })
  if (error) return { token: '', expiresAt: '', error: getFunctionErrorMessage(error) }

  if (typeof data?.token !== 'string' || typeof data.expiresAt !== 'string') {
    return { token: '', expiresAt: '', error: '二维码登录服务返回了无效结果' }
  }

  return { token: data.token, expiresAt: data.expiresAt, error: null }
}

export async function completeAuthHandoff(token: string): Promise<{ error: string | null }> {
  const supabase = getSupabase()
  if (!supabase) return { error: '当前没有配置家庭同步，无法接收登录' }

  const { data, error } = await supabase.functions.invoke<CompleteHandoffResponse>('complete-auth-handoff', {
    body: { token },
  })
  if (error) return { error: '二维码已过期、已使用，或当前网络暂时不可用' }

  if (typeof data?.tokenHash !== 'string' || data.tokenHash.length < 20) {
    return { error: '二维码登录服务返回了无效结果' }
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.tokenHash,
    type: 'email',
  })
  if (verifyError) return { error: getFunctionErrorMessage(verifyError) }

  return { error: null }
}

export function readAuthHandoffToken(): string | null {
  if (typeof window === 'undefined') return null
  return new URL(window.location.href).searchParams.get(AUTH_HANDOFF_QUERY_PARAM)
}

export function getUrlWithoutAuthHandoff(): string {
  const url = new URL(window.location.href)
  url.searchParams.delete(AUTH_HANDOFF_QUERY_PARAM)
  return `${url.pathname}${url.search}${url.hash}`
}
