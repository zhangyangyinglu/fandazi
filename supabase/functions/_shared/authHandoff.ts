import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.110.0'

export const HANDOFF_TTL_SECONDS = 120

const ALLOWED_ORIGINS = new Set([
  'https://fandazi-mobile-preview.vercel.app',
  'https://fandazi-web-tool.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

function readKeyContainer(raw: string | undefined): string | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const candidate = parsed.default ?? Object.values(parsed)[0]
    if (typeof candidate === 'string') {
      // 新版 Supabase 可能把命名 key 作为环境变量名返回；兼容两种格式。
      return Deno.env.get(candidate) ?? candidate
    }
  } catch {
    // 兼容旧版单值环境变量。
  }

  return raw
}

function getPublishableKey(): string {
  const key = readKeyContainer(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'))
    ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
    ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!key) throw new Error('publishable key is not configured')
  return key
}

function getSecretKey(): string {
  const key = readKeyContainer(Deno.env.get('SUPABASE_SECRET_KEYS'))
    ?? Deno.env.get('SUPABASE_SECRET_KEY')
    ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) throw new Error('secret key is not configured')
  return key
}

function getSupabaseUrl(): string {
  const url = Deno.env.get('SUPABASE_URL')
  if (!url) throw new Error('Supabase URL is not configured')
  return url
}

export function getAdminClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

export async function getAuthenticatedUser(request: Request) {
  const accessToken = getBearerToken(request)
  if (!accessToken) return null

  const client = createClient(getSupabaseUrl(), getPublishableKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.auth.getUser(accessToken)
  if (error || !data.user) return null
  return data.user
}

export function createHandoffToken(): string {
  return `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`
}

export async function hashHandoffToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function isAllowedOrigin(origin: string | null): boolean {
  return !origin || ALLOWED_ORIGINS.has(origin)
}

export function jsonResponse(request: Request, body: Record<string, unknown>, status = 200): Response {
  const origin = request.headers.get('origin')
  const allowOrigin = !origin ? '*' : isAllowedOrigin(origin) ? origin : 'null'
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': allowOrigin,
      'Content-Type': 'application/json',
      Vary: 'Origin',
    },
  })
}

export function isOptions(request: Request): boolean {
  return request.method.toUpperCase() === 'OPTIONS'
}

export function isPost(request: Request): boolean {
  return request.method.toUpperCase() === 'POST'
}
