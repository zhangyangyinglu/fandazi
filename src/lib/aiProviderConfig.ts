/**
 * AI Provider 配置层
 *
 * 管理 provider/baseURL/model/apiKey 的读取和保存。
 *
 * 存储策略（双层）：
 * 1. 家庭共享（优先）：当 Supabase 已配置且用户已加入家庭组时，
 *    Key 存在 household_settings.ai_config，家庭组内所有成员共享。
 *    任意成员添加 Key，整个家庭组都可用。
 * 2. 本机兜底：未配置 Supabase 或未加入家庭组时，Key 存 localStorage。
 *
 * 安全边界：
 * - Key 不进仓库、不进公开 Demo
 * - 无 Key 时上层应走本地 fallback，不假装已调用模型
 */

import { getSupabase } from '@/lib/supabaseClient'
import { getHouseholdId } from '@/lib/familyCloudSync'

export type AiProvider = 'deepseek' | 'openai' | 'custom'

export interface AiProviderConfig {
  provider: AiProvider
  baseURL: string
  model: string
  apiKey: string
  /** 是否已测试连接成功 */
  tested: boolean
}

const STORAGE_KEY = 'fandazi_ai_config'

/** 各 provider 默认配置 */
export const PROVIDER_DEFAULTS: Record<AiProvider, { baseURL: string; model: string }> = {
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  custom: {
    baseURL: '',
    model: '',
  },
}

/** 当前存储模式 */
export type AiConfigSource = 'cloud' | 'local'

/** 检查是否可以使用家庭共享云端存储 */
function canUseCloudSync(): boolean {
  return !!getSupabase() && !!getHouseholdId()
}

/**
 * 从云端（Supabase household_settings）读取 AI 配置
 * 返回 null 表示云端没有配置或不可用
 */
async function readAiConfigFromCloud(): Promise<AiProviderConfig | null> {
  const supabase = getSupabase()
  const householdId = getHouseholdId()
  if (!supabase || !householdId) return null

  try {
    const { data, error } = await supabase
      .from('household_settings')
      .select('ai_config')
      .eq('household_id', householdId)
      .maybeSingle()

    if (error || !data?.ai_config) return null

    const cfg = data.ai_config as AiProviderConfig
    if (!cfg.apiKey || !cfg.baseURL || !cfg.model) return null
    return cfg
  } catch {
    return null
  }
}

/**
 * 写入 AI 配置到云端（家庭共享）
 */
async function writeAiConfigToCloud(config: AiProviderConfig): Promise<void> {
  const supabase = getSupabase()
  const householdId = getHouseholdId()
  if (!supabase || !householdId) return

  const { error } = await supabase
    .from('household_settings')
    .upsert({
      household_id: householdId,
      ai_config: config,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    console.warn('[aiProviderConfig] 云端写入失败，回退到本地', error.message)
  }
}

/**
 * 从云端清除 AI 配置
 */
async function clearAiConfigFromCloud(): Promise<void> {
  const supabase = getSupabase()
  const householdId = getHouseholdId()
  if (!supabase || !householdId) return

  await supabase
    .from('household_settings')
    .update({ ai_config: null, updated_at: new Date().toISOString() })
    .eq('household_id', householdId)
}

/** 从 localStorage 读取 AI 配置，未配置时返回 null */
function readAiConfigFromLocal(): AiProviderConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AiProviderConfig
    if (!parsed.apiKey || !parsed.baseURL || !parsed.model) return null
    return parsed
  } catch {
    return null
  }
}

/** 保存 AI 配置到 localStorage */
function writeAiConfigToLocal(config: AiProviderConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

/** 从 localStorage 清除 AI 配置 */
function clearAiConfigFromLocal(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * 同步读取 AI 配置（优先本地缓存，云端需异步拉取）
 * 未配置时返回 null。
 *
 * 注意：此函数是同步的，只读本地缓存。
 * 首次加载时请调用 refreshAiConfigFromCloud() 拉取云端配置。
 */
export function readAiConfig(): AiProviderConfig | null {
  // 本地缓存优先（无论云端还是本地，都会缓存到 localStorage 作为离线兜底）
  return readAiConfigFromLocal()
}

/**
 * 异步从云端拉取 AI 配置并更新本地缓存。
 * 如果云端有配置且与本地不同，覆盖本地。
 * 如果云端无配置，保持本地不变。
 *
 * 应在应用启动或家庭组变更时调用。
 */
export async function refreshAiConfigFromCloud(): Promise<void> {
  if (!canUseCloudSync()) return

  const cloudConfig = await readAiConfigFromCloud()
  if (cloudConfig) {
    // 云端有配置，更新本地缓存
    writeAiConfigToLocal(cloudConfig)
  }
}

/**
 * 保存 AI 配置。
 * - 已配置 Supabase + 家庭组：同时写入云端（家庭共享）和本地缓存
 * - 未配置 Supabase：只写入 localStorage
 */
export async function writeAiConfig(config: AiProviderConfig): Promise<void> {
  // 始终写入本地缓存（离线兜底）
  writeAiConfigToLocal(config)

  // 如果可用，同步到云端（家庭共享）
  if (canUseCloudSync()) {
    await writeAiConfigToCloud(config)
  }
}

/**
 * 清除 AI 配置。
 * - 同时清除本地缓存和云端配置
 */
export async function clearAiConfig(): Promise<void> {
  clearAiConfigFromLocal()
  if (canUseCloudSync()) {
    await clearAiConfigFromCloud()
  }
}

/** 是否已配置有效 Key */
export function hasAiKey(): boolean {
  return readAiConfig() !== null
}

/** 当前存储模式：cloud=家庭共享，local=仅本机 */
export function getAiConfigSource(): AiConfigSource {
  return canUseCloudSync() ? 'cloud' : 'local'
}
