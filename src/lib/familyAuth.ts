/**
 * 家庭认证模块
 *
 * 流程：
 *   1. 用户注册/登录（邮箱+密码）
 *   2. 创建家庭 → 生成 6 位邀请码
 *   3. 家人输入邀请码加入
 *   4. 登录后缓存 householdId 到 localStorage
 */
import { getSupabase } from '@/lib/supabaseClient'

function generateInviteCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
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
}

/** 获取当前登录用户 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data } = await supabase.auth.getUser()
  if (data.user) {
    return { id: data.user.id, email: data.user.email! }
  }
  return null
}

/** 创建家庭空间 */
export async function createHousehold(name: string, creatorId: string): Promise<{ household: Household | null; error: string | null }> {
  const supabase = getSupabase()
  if (!supabase) return { household: null, error: 'Supabase 未配置' }

  const inviteCode = generateInviteCode()

  const { data: house, error: houseErr } = await supabase
    .from('households')
    .insert({ name, invite_code: inviteCode, created_by: creatorId })
    .select()
    .single()

  if (houseErr || !house) return { household: null, error: houseErr?.message ?? '创建失败' }

  // 添加创建者为 owner
  await supabase.from('household_members').insert({
    household_id: house.id,
    user_id: creatorId,
    display_name: '我',
    role: 'owner',
  })

  // 初始化饭团状态
  await supabase.from('fantuan_state').insert({
    household_id: house.id,
    mili: 0,
    level: 1,
  })

  localStorage.setItem('fandazi.householdId', house.id)

  return {
    household: { id: house.id, name: house.name, inviteCode: house.invite_code },
    error: null,
  }
}

/** 通过邀请码加入家庭 */
export async function joinHousehold(inviteCode: string, userId: string, displayName: string): Promise<{ household: Household | null; error: string | null }> {
  const supabase = getSupabase()
  if (!supabase) return { household: null, error: 'Supabase 未配置' }

  const { data: house, error: findErr } = await supabase
    .from('households')
    .select()
    .eq('invite_code', inviteCode.toUpperCase())
    .single()

  if (findErr || !house) return { household: null, error: '邀请码无效' }

  await supabase.from('household_members').insert({
    household_id: house.id,
    user_id: userId,
    display_name: displayName,
    role: 'member',
  })

  localStorage.setItem('fandazi.householdId', house.id)

  return {
    household: { id: house.id, name: house.name, inviteCode: house.invite_code },
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
      return { id: h.id, name: h.name, inviteCode: h.invite_code }
    }
  }
  return null
}
