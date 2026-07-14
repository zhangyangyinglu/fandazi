/**
 * 家庭认证模块
 *
 * 流程：
 *   1. 用户注册/登录（邮箱+密码）
 *   2. 创建家庭 → 生成 6 位邀请码
 *   3. 家人输入邀请码加入
 *   4. 登录后缓存 householdId 到 localStorage
 */
import { FANDAZI_SYNC_CONFIG_EVENT, getSupabase } from '@/lib/supabaseClient'

const LAST_ACTIVE_KEY = 'fandazi.auth.lastActiveAt'
const INACTIVITY_LIMIT_MS = 30 * 24 * 60 * 60 * 1000

function notifySyncConfigChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FANDAZI_SYNC_CONFIG_EVENT))
  }
}

function markActive(): void {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
  } catch {
    // 隐私模式或 localStorage 不可用时，交给 Supabase 会话继续管理。
  }
}

function hasExpiredByInactivity(): boolean {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_KEY)
    if (!raw) return false
    const lastActiveAt = Number(raw)
    return Number.isFinite(lastActiveAt) && Date.now() - lastActiveAt > INACTIVITY_LIMIT_MS
  } catch {
    return false
  }
}

export interface AuthUser {
  id: string
  email: string
}

export interface Household {
  id: string
  name: string
  inviteCode: string
}

/** 注册新用户 */
export async function signUp(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
  const supabase = getSupabase()
  if (!supabase) return { user: null, error: 'Supabase 未配置' }

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { user: null, error: error.message }

  if (data.user) {
    markActive()
    notifySyncConfigChanged()
    return { user: { id: data.user.id, email: data.user.email! }, error: null }
  }
  return { user: null, error: '注册失败' }
}

/** 登录 */
export async function signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
  const supabase = getSupabase()
  if (!supabase) return { user: null, error: 'Supabase 未配置' }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { user: null, error: error.message }

  if (data.user) {
    markActive()
    notifySyncConfigChanged()
    return { user: { id: data.user.id, email: data.user.email! }, error: null }
  }
  return { user: null, error: '登录失败' }
}

/** 退出登录 */
export async function signOut(): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  await supabase.auth.signOut()
  localStorage.removeItem('fandazi.householdId')
  localStorage.removeItem(LAST_ACTIVE_KEY)
  notifySyncConfigChanged()
}

/** 获取当前登录用户 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data } = await supabase.auth.getUser()
  if (data.user && hasExpiredByInactivity()) {
    await signOut()
    return null
  }
  if (data.user) {
    markActive()
    return { id: data.user.id, email: data.user.email! }
  }
  return null
}

/** 创建家庭空间。
 * 走 security definer RPC，避免前端分三次 insert 时被 RLS / 未刷新 schema 状态卡住。
 */
export async function createHousehold(name: string, creatorId: string): Promise<{ household: Household | null; error: string | null }> {
  void creatorId
  const supabase = getSupabase()
  if (!supabase) return { household: null, error: 'Supabase 未配置' }

  const { data: house, error } = await supabase
    .rpc('create_household_with_owner', { household_name: name })
    .single()

  if (error || !house) return { household: null, error: error?.message ?? '创建失败' }

  const raw = house as { id: string; name: string; invite_code: string }
  localStorage.setItem('fandazi.householdId', raw.id)
  notifySyncConfigChanged()

  return {
    household: { id: raw.id, name: raw.name, inviteCode: raw.invite_code },
    error: null,
  }
}

/** 通过邀请码加入家庭。
 * 注意：非成员不能直接 select households（RLS 会拦截），必须走 schema.sql 中的
 * security definer RPC `join_household_by_invite`。
 */
export async function joinHousehold(inviteCode: string, _userId: string, displayName: string): Promise<{ household: Household | null; error: string | null }> {
  void _userId
  const supabase = getSupabase()
  if (!supabase) return { household: null, error: 'Supabase 未配置' }

  const { data: house, error } = await supabase
    .rpc('join_household_by_invite', {
      target_invite_code: inviteCode.toUpperCase(),
      member_display_name: displayName,
    })
    .single()

  if (error || !house) return { household: null, error: error?.message ?? '邀请码无效或加入失败' }

  const raw = house as { id: string; name: string; invite_code: string }
  localStorage.setItem('fandazi.householdId', raw.id)
  notifySyncConfigChanged()

  return {
    household: { id: raw.id, name: raw.name, inviteCode: raw.invite_code },
    error: null,
  }
}

/** 获取用户当前所属家庭 */
export async function getMyHousehold(userId: string): Promise<Household | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id, households(id, name, invite_code)')
    .eq('user_id', userId)
    .single()

  if (member) {
    const raw = member as unknown as {
      household_id: string
      households: { id: string; name: string; invite_code: string }[] | { id: string; name: string; invite_code: string }
    }
    const h = Array.isArray(raw.households) ? raw.households[0] : raw.households
    if (h) {
      localStorage.setItem('fandazi.householdId', h.id)
      notifySyncConfigChanged()
      return { id: h.id, name: h.name, inviteCode: h.invite_code }
    }
  }
  return null
}
