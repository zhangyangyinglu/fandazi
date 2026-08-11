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
import { Link, useNavigate } from 'react-router-dom'
import { friendlyError } from '@/lib/friendlyError'
import {
  isSupabaseConfigured,
  FANDAZI_SYNC_CONFIG_EVENT,
  setSupabaseConfig,
  clearSupabaseConfig,
  resetSupabaseClient,
  getSupabasePublicConfig,
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
import { getSyncStatus, onSyncStatusChange, type SyncStatus } from '@/lib/useFamilySync'
import {
  readAiConfig,
  writeAiConfig,
  clearAiConfig,
  getAiConfigSource,
  PROVIDER_DEFAULTS,
  type AiProvider,
  type AiProviderConfig,
} from '@/lib/aiProviderConfig'
import { testAiConnection } from '@/lib/fantuanAiClient'
import { FIRST_USE_COMPLETED_KEY, LOCAL_MODE_CONFIRMED_KEY } from '@/components/AppAccessGate'
import { AuthHandoffPanel } from '@/components/AuthHandoffPanel'
import { AuthHandoffScanner } from '@/components/AuthHandoffScanner'
import './SyncSettingsPage.css'

type Step = 'config' | 'auth' | 'household' | 'done'

export function SyncSettingsPage() {
  const navigate = useNavigate()
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

  // 饭团 AI 设置状态（惰性初始化，从 localStorage 读取已保存配置）
  const savedAiConfig = readAiConfig()
  const [aiProvider, setAiProvider] = useState<AiProvider>(savedAiConfig?.provider ?? 'deepseek')
  const [aiBaseURL, setAiBaseURL] = useState(savedAiConfig?.baseURL ?? PROVIDER_DEFAULTS.deepseek.baseURL)
  const [aiModel, setAiModel] = useState(savedAiConfig?.model ?? PROVIDER_DEFAULTS.deepseek.model)
  const [aiApiKey, setAiApiKey] = useState(savedAiConfig?.apiKey ?? '')
  const [aiTestStatus, setAiTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>(savedAiConfig?.tested ? 'ok' : 'idle')
  const [aiTestError, setAiTestError] = useState('')
  const [aiConfigSaved, setAiConfigSaved] = useState(!!savedAiConfig)

  // 同步状态（synced / connecting / error / offline）
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus())
  useEffect(() => {
    const unsub = onSyncStatusChange(setSyncStatus)
    return unsub
  }, [])

  const supabasePublicConfig = getSupabasePublicConfig()
  const visiblePrimaryButtonStyle = {
    backgroundColor: '#f39c12',
    borderColor: '#f39c12',
    color: '#fff',
  }
  const partnerInvitePackage = household && supabasePublicConfig
    ? [
        '饭搭子家庭邀请包',
        '打开网址：https://fandazi-web-tool.vercel.app',
        ...(supabasePublicConfig.source === 'localStorage'
          ? [`Supabase URL: ${supabasePublicConfig.url}`, `Supabase anon key: ${supabasePublicConfig.anonKey}`]
          : []),
        `家庭邀请码: ${household.inviteCode}`,
        supabasePublicConfig.source === 'env'
          ? '说明：搭子打开上面网址，注册/登录后输入邀请码加入，不需要下载、部署或配置 Supabase。'
          : '说明：这是独立部署版；搭子需要填入同一套家庭云端配置，再注册/登录并输入邀请码加入。',
      ].join('\n')
    : ''

  const continueAfterHousehold = useCallback(() => {
    if (localStorage.getItem(FIRST_USE_COMPLETED_KEY) !== 'true') {
      navigate('/welcome', { replace: true })
    }
  }, [navigate])

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
      continueAfterHousehold()
    } else {
      setStep('household')
    }
    setLoading(false)
  }, [continueAfterHousehold])

  useEffect(() => {
    queueMicrotask(() => {
      void checkStatus()
    })
  }, [checkStatus])

  function handleAiProviderChange(provider: AiProvider) {
    setAiProvider(provider)
    const defaults = PROVIDER_DEFAULTS[provider]
    setAiBaseURL(defaults.baseURL)
    setAiModel(defaults.model)
  }

  async function handleSaveAiConfig() {
    if (!aiApiKey.trim() || !aiBaseURL.trim() || !aiModel.trim()) {
      setAiTestStatus('fail')
      setAiTestError('请填写完整的 baseURL、模型和 API Key')
      return
    }
    const config: AiProviderConfig = {
      provider: aiProvider,
      baseURL: aiBaseURL.trim(),
      model: aiModel.trim(),
      apiKey: aiApiKey.trim(),
      tested: false,
    }
    writeAiConfig(config).then(() => {
      setAiConfigSaved(true)
      setAiTestStatus('idle')
      setAiTestError('')
    })
  }

  async function handleTestAi() {
    if (!aiApiKey.trim() || !aiBaseURL.trim() || !aiModel.trim()) {
      setAiTestStatus('fail')
      setAiTestError('请先填写并保存配置')
      return
    }
    // 先保存再测试
    await handleSaveAiConfig()
    setAiTestStatus('testing')
    setAiTestError('')
    const config: AiProviderConfig = {
      provider: aiProvider,
      baseURL: aiBaseURL.trim(),
      model: aiModel.trim(),
      apiKey: aiApiKey.trim(),
      tested: false,
    }
    const result = await testAiConnection(config)
    if (result.ok) {
      setAiTestStatus('ok')
      void writeAiConfig({ ...config, tested: true })
    } else {
      setAiTestStatus('fail')
      const errorMap: Record<string, string> = {
        KEY_INVALID: 'API Key 无效，请检查',
        NETWORK_ERROR: '网络连接失败，检查 baseURL 是否正确',
        EMPTY_RESPONSE: '模型返回为空，检查模型名称是否正确',
      }
      setAiTestError(errorMap[result.error] || result.error)
    }
  }

  function handleClearAiConfig() {
    clearAiConfig().then(() => {
      setAiApiKey('')
      setAiTestStatus('idle')
      setAiTestError('')
      setAiConfigSaved(false)
    })
  }

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
    if (!email.trim() || !password.trim()) {
      setError('请填写邮箱和密码')
      return
    }
    if (password.trim().length < 6) {
      setError('密码至少 6 位')
      return
    }
    setLoading(true)
    setError(null)
    const result = mode === 'signup'
      ? await signUp(email, password)
      : await signIn(email, password)

    if (result.error) {
      setError(friendlyError(result.error))
      setLoading(false)
      return
    }

    if (result.user) {
      setUser(result.user)
      const h = await getMyHousehold(result.user.id)
      if (h) {
        setHousehold(h)
        setStep('done')
        continueAfterHousehold()
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
      setError(friendlyError(result.error))
    } else if (result.household) {
      setHousehold(result.household)
      setStep('done')
      continueAfterHousehold()
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
      setError(friendlyError(result.error))
    } else if (result.household) {
      setHousehold(result.household)
      setStep('done')
      continueAfterHousehold()
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
      <h2>进入饭搭子</h2>

      <div className="sync-info-banner">
        <p>
          <strong>饭搭子是一款家庭吃饭 App。</strong>
          你可以把它添加到手机主屏幕，像 App 一样打开；它本质上是 PWA 网页 App。这里的“饭搭子项目”只是开发和维护它的代码项目，不是另一个产品。
        </p>
        <p>
          饭搭子的核心是「一起吃饭的人」。
          你可以一个人用一个家庭组，也可以把搭子邀请进来。搭子可以是另一个人、家里的宠物、或不会用电脑的老人——由你自己设置。
        </p>
        <p className="sync-note">
          所有用户可以使用同一个线上 Supabase 后端，但每个用户都要在应用内创建自己的家庭组；只有拿到本家庭邀请码的搭子才能加入，家庭数据不会混在一起。
          饭团 AI 可在本页下方配置；健康档案家庭可见但各自编辑。
        </p>
      </div>

      {/* Step 1: Supabase 配置 */}
      {step === 'config' && (
        <section className="sync-section">
          <h3>第 1 步：配置 Supabase</h3>
          <p className="sync-step-desc">
            如果你是第一个配置饭搭子的人：前往 <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">supabase.com</a> 注册免费账号，
            创建一个家庭云端项目，然后在 Settings → API 中找到 URL 和 anon key。
          </p>
          <p className="sync-step-desc">
            创建项目后，在 SQL Editor 中执行 <code>supabase/schema.sql</code> 建表。
            如果你是被邀请的搭子，不用新建 Supabase 项目，直接填邀请人发来的 URL 和 anon key。
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
          <button
            className="sync-clear-btn"
            type="button"
            onClick={() => {
              localStorage.setItem(LOCAL_MODE_CONFIRMED_KEY, 'true')
              window.dispatchEvent(new Event(FANDAZI_SYNC_CONFIG_EVENT))
              navigate('/welcome')
            }}
          >仅在本机体验（不共享数据）</button>
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
            <button style={visiblePrimaryButtonStyle} onClick={() => handleAuth('signup')} disabled={loading}>注册</button>
            <button style={visiblePrimaryButtonStyle} onClick={() => handleAuth('signin')} disabled={loading}>登录</button>
          </div>
          {error && (
            <div className="sync-error-card">
              <p>{error}</p>
              <div className="sync-button-row">
                <button style={visiblePrimaryButtonStyle} onClick={() => handleAuth('signup')} disabled={loading}>重新注册/重发确认</button>
                <button style={visiblePrimaryButtonStyle} onClick={() => handleAuth('signin')} disabled={loading}>我已确认，登录</button>
              </div>
            </div>
          )}
          <AuthHandoffScanner />
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
            <button style={visiblePrimaryButtonStyle} onClick={handleCreateHousehold} disabled={loading}>创建家庭</button>
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
            <button style={visiblePrimaryButtonStyle} onClick={handleJoinHousehold} disabled={loading}>加入家庭</button>
          </div>
          {error && <p className="sync-error">{error}</p>}
        </section>
      )}

      {/* Step 4: 同步已开启 */}
      {step === 'done' && household && user && (
        <section className="sync-section sync-done">
          <h3>✅ 同步已开启</h3>
          <div className="sync-status-indicator" style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: syncStatus === 'error' ? '#e74c3c' : syncStatus === 'synced' ? '#27ae60' : '#7f8c8d' }}>
            {syncStatus === 'synced' && '🟢 数据同步正常'}
            {syncStatus === 'connecting' && '🟡 正在连接…'}
            {syncStatus === 'error' && '🔴 同步出错，数据可能未保存到云端（本地仍可用）'}
            {syncStatus === 'offline' && '⚪ 未连接云端'}
          </div>
          <div className="sync-status-card">
            <p><strong>家庭：</strong>{household.name}</p>
            <p><strong>邀请码：</strong><code>{household.inviteCode}</code></p>
            <p className="sync-hint">
              想邀请搭子时，把下面这份邀请包发给对方即可。搭子可以是另一个人、宠物、或不会用电脑的老人——不邀请也完全正常，一个人用就是一个人的家庭组。
            </p>
            {partnerInvitePackage && (
              <div className="sync-invite-package">
                <label htmlFor="partner-invite-package">给搭子的邀请包</label>
                <textarea
                  id="partner-invite-package"
                  readOnly
                  value={partnerInvitePackage}
                  rows={6}
                />
              </div>
            )}
            <p><strong>当前账号：</strong>{user.email}</p>
          </div>
          <AuthHandoffPanel />
          <button style={visiblePrimaryButtonStyle} onClick={() => navigate('/welcome')}>
            继续首次设置
          </button>
          <button onClick={handleSignOut} className="sync-logout-btn">退出登录</button>
        </section>
      )}

      {/* 饭团 AI 设置 */}
      <section className="sync-section sync-ai-section">
        <h3>饭团 AI 设置</h3>
        <p className="sync-step-desc">
          配置后饭团可以调用真实 AI 模型对话。不配置则使用本地回复（本地模式）。
          Key 不进仓库、不进公开 Demo。
        </p>
        <p className="sync-note">
          {getAiConfigSource() === 'cloud'
            ? '🔒 家庭共享模式：Key 保存在家庭组云端，家庭组内任意成员添加后全组可用。'
            : '📱 本机模式：Key 保存在本机浏览器。配置家庭同步后，Key 将自动共享给整个家庭组。'}
        </p>
        <label className="sync-ai-label">AI 服务商</label>
        <select
          className="sync-ai-select"
          value={aiProvider}
          onChange={(e) => handleAiProviderChange(e.target.value as AiProvider)}
        >
          <option value="deepseek">DeepSeek</option>
          <option value="openai">OpenAI</option>
          <option value="custom">自定义（OpenAI 兼容）</option>
        </select>

        <label className="sync-ai-label">Base URL</label>
        <input
          type="text"
          placeholder="https://api.deepseek.com/v1"
          value={aiBaseURL}
          onChange={(e) => setAiBaseURL(e.target.value)}
        />

        <label className="sync-ai-label">模型名称</label>
        <input
          type="text"
          placeholder="deepseek-chat"
          value={aiModel}
          onChange={(e) => setAiModel(e.target.value)}
        />

        <label className="sync-ai-label">API Key</label>
        <input
          type="password"
          placeholder="sk-..."
          value={aiApiKey}
          onChange={(e) => setAiApiKey(e.target.value)}
        />

        <div className="sync-button-row">
          <button style={visiblePrimaryButtonStyle} onClick={handleSaveAiConfig}>保存配置</button>
          <button onClick={handleTestAi} disabled={aiTestStatus === 'testing'}>
            {aiTestStatus === 'testing' ? '测试中…' : '测试连接'}
          </button>
          {aiConfigSaved && (
            <button onClick={handleClearAiConfig} className="sync-clear-btn">
              清除 Key
            </button>
          )}
        </div>

        {aiTestStatus === 'ok' && (
          <p className="sync-ai-test-ok">✅ 连接成功！饭团可以开始用 AI 对话了。</p>
        )}
        {aiTestStatus === 'fail' && (
          <p className="sync-ai-test-fail">❌ {aiTestError}</p>
        )}
        {aiConfigSaved && aiTestStatus === 'idle' && (
          <p className="sync-ai-saved">已保存（未测试连接）。饭团将尝试使用此配置。</p>
        )}
      </section>

      {/* 底部：清除配置 */}
      {step !== 'config' && (
        <div className="sync-footer">
          <button onClick={handleClearConfig} className="sync-clear-btn">
            清除 Supabase 配置（回到本地模式）
          </button>
          <Link to="/privacy" className="sync-privacy-link">隐私政策</Link>
        </div>
      )}
    </div>
  )
}
