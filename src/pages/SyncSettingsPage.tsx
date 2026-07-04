/**
 * 同步设置页面
 *
 * 流程：
 *   1. 配置 Supabase URL + anon key（或通过 .env.local 预配）
 *   2. 注册/登录
 *   3. 创建家庭（获得邀请码）或 输入邀请码加入
 *   4. 显示同步状态
 */
import { useCallback, useEffect, useState } from 'react'
import {
  isSupabaseConfigured,
  setSupabaseConfig,
  clearSupabaseConfig,
  resetSupabaseClient,
} from '@/lib/supabaseClient'
import {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  createHousehold,
  joinHousehold,
  getMyHousehold,
  type AuthUser,
  type Household,
} from '@/lib/familyAuth'
import './SyncSettingsPage.css'

type Step = 'config' | 'auth' | 'household' | 'done'

export function SyncSettingsPage() {
  const [step, setStep] = useState<Step>('config')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 表单状态
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [displayName, setDisplayName] = useState('')

  const checkStatus = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (!isSupabaseConfigured()) {
      setStep('config')
      setLoading(false)
      return
    }

    const u = await getCurrentUser()
    if (!u) {
      setStep('auth')
      setLoading(false)
      return
    }

    setUser(u)
    const h = await getMyHousehold(u.id)
    if (h) {
      setHousehold(h)
      setStep('done')
    } else {
      setStep('household')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void checkStatus()
    })
  }, [checkStatus])

  async function handleSaveConfig() {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setError('请填写 Supabase URL 和 anon key')
      return
    }
    setSupabaseConfig(supabaseUrl.trim(), supabaseKey.trim())
    resetSupabaseClient()
    setError(null)
    setStep('auth')
  }

  async function handleAuth(mode: 'signup' | 'signin') {
    setLoading(true)
    setError(null)
    const result = mode === 'signup'
      ? await signUp(email, password)
      : await signIn(email, password)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.user) {
      setUser(result.user)
      const h = await getMyHousehold(result.user.id)
      if (h) {
        setHousehold(h)
        setStep('done')
      } else {
        setStep('household')
      }
    }
    setLoading(false)
  }

  async function handleCreateHousehold() {
    if (!user || !householdName.trim()) {
      setError('请填写家庭名称')
      return
    }
    setLoading(true)
    setError(null)
    const result = await createHousehold(householdName.trim(), user.id)
    if (result.error) {
      setError(result.error)
    } else if (result.household) {
      setHousehold(result.household)
      setStep('done')
    }
    setLoading(false)
  }

  async function handleJoinHousehold() {
    if (!user || !inviteCode.trim() || !displayName.trim()) {
      setError('请填写邀请码和你的昵称')
      return
    }
    setLoading(true)
    setError(null)
    const result = await joinHousehold(inviteCode.trim(), user.id, displayName.trim())
    if (result.error) {
      setError(result.error)
    } else if (result.household) {
      setHousehold(result.household)
      setStep('done')
    }
    setLoading(false)
  }

  async function handleSignOut() {
    await signOut()
    setUser(null)
    setHousehold(null)
    setStep('auth')
  }

  function handleClearConfig() {
    clearSupabaseConfig()
    resetSupabaseClient()
    setUser(null)
    setHousehold(null)
    setStep('config')
  }

  return (
    <div className="sync-settings-page">
      <h2>家庭数据同步</h2>

      <div className="sync-info-banner">
        <p>
          饭搭子的核心是「一起吃饭的人」。
          开启同步后，你和家人的冰箱、计划、购物清单、做饭记录、饭团进度会实时共享。
        </p>
        <p className="sync-note">
          ⚠️ AI API Key 是个人配置，不会同步。健康档案家庭可见但各自编辑。
        </p>
      </div>

      {/* Step 1: Supabase 配置 */}
      {step === 'config' && (
        <section className="sync-section">
          <h3>第 1 步：配置 Supabase</h3>
          <p className="sync-step-desc">
            前往 <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">supabase.com</a> 注册免费账号，
            创建新项目，然后在 Settings → API 中找到 URL 和 anon key。
          </p>
          <p className="sync-step-desc">
            创建项目后，在 SQL Editor 中执行 <code>supabase/schema.sql</code> 建表。
          </p>
          <input
            type="text"
            placeholder="Supabase URL (https://xxx.supabase.co)"
            value={supabaseUrl}
            onChange={(e) => setSupabaseUrl(e.target.value)}
          />
          <input
            type="password"
            placeholder="Supabase anon key"
            value={supabaseKey}
            onChange={(e) => setSupabaseKey(e.target.value)}
          />
          <button onClick={handleSaveConfig} disabled={loading}>保存配置</button>
          {error && <p className="sync-error">{error}</p>}
        </section>
      )}

      {/* Step 2: 登录/注册 */}
      {step === 'auth' && (
        <section className="sync-section">
          <h3>第 2 步：注册或登录</h3>
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="sync-button-row">
            <button onClick={() => handleAuth('signup')} disabled={loading}>注册</button>
            <button onClick={() => handleAuth('signin')} disabled={loading}>登录</button>
          </div>
          {error && <p className="sync-error">{error}</p>}
        </section>
      )}

      {/* Step 3: 创建/加入家庭 */}
      {step === 'household' && (
        <section className="sync-section">
          <h3>第 3 步：创建或加入家庭</h3>

          <div className="sync-subsection">
            <h4>创建新家庭</h4>
            <input
              type="text"
              placeholder="家庭名称（如：我们的家）"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
            />
            <button onClick={handleCreateHousehold} disabled={loading}>创建家庭</button>
          </div>

          <div className="sync-divider">或</div>

          <div className="sync-subsection">
            <h4>加入已有家庭</h4>
            <input
              type="text"
              placeholder="邀请码（6位）"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              maxLength={6}
            />
            <input
              type="text"
              placeholder="你的昵称"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <button onClick={handleJoinHousehold} disabled={loading}>加入家庭</button>
          </div>
          {error && <p className="sync-error">{error}</p>}
        </section>
      )}

      {/* Step 4: 同步已开启 */}
      {step === 'done' && household && user && (
        <section className="sync-section sync-done">
          <h3>✅ 同步已开启</h3>
          <div className="sync-status-card">
            <p><strong>家庭：</strong>{household.name}</p>
            <p><strong>邀请码：</strong><code>{household.inviteCode}</code></p>
            <p className="sync-hint">把这个邀请码发给家人，他们在同步设置里输入即可加入。</p>
            <p><strong>当前账号：</strong>{user.email}</p>
          </div>
          <button onClick={handleSignOut} className="sync-logout-btn">退出登录</button>
        </section>
      )}

      {/* 底部：清除配置 */}
      {step !== 'config' && (
        <div className="sync-footer">
          <button onClick={handleClearConfig} className="sync-clear-btn">
            清除 Supabase 配置（回到本地模式）
          </button>
        </div>
      )}
    </div>
  )
}
