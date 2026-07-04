/**
 * Supabase 客户端配置
 *
 * 使用方式：
 * 1. 注册 Supabase 账号 → 创建新项目 → 获取 URL 和 anon key
 * 2. 在 supabase/schema.sql 执行数据库建表
 * 3. 在 .env.local 填入 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY
 * 4. 或在应用设置页面填入（存 localStorage，不进仓库）
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ENV_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const LS_URL_KEY = 'fandazi.supabase.url'
const LS_KEY_KEY = 'fandazi.supabase.anonKey'

/** 从 localStorage 读取用户自配的 Supabase 凭据 */
function getLocalConfig(): { url: string; key: string } | null {
  try {
    const url = localStorage.getItem(LS_URL_KEY)
    const key = localStorage.getItem(LS_KEY_KEY)
    if (url && key) return { url, key }
  } catch {
    // localStorage 不可用
  }
  return null
}

/** 是否已配置 Supabase（环境变量或 localStorage 任一可用） */
export function isSupabaseConfigured(): boolean {
  return !!(ENV_URL && ENV_KEY) || !!getLocalConfig()
}

/** 用户自配 Supabase 凭据（设置页面调用） */
export function setSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem(LS_URL_KEY, url.trim())
  localStorage.setItem(LS_KEY_KEY, anonKey.trim())
}

/** 清除用户自配凭据 */
export function clearSupabaseConfig(): void {
  localStorage.removeItem(LS_URL_KEY)
  localStorage.removeItem(LS_KEY_KEY)
}

let _client: SupabaseClient | null = null

/** 获取 Supabase 客户端（未配置时返回 null） */
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client

  const url = ENV_URL ?? getLocalConfig()?.url
  const key = ENV_KEY ?? getLocalConfig()?.key

  if (!url || !key) return null

  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: { eventsPerSecond: 2 },
    },
  })

  return _client
}

/** 重置客户端（配置变更后调用） */
export function resetSupabaseClient(): void {
  _client = null
}
