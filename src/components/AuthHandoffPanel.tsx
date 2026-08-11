import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { AUTH_HANDOFF_ENTRY_URL, createAuthHandoff } from '@/lib/authHandoff'
import './AuthHandoffPanel.css'

type HandoffState = 'closed' | 'loading' | 'ready' | 'expired' | 'error'

function getRemainingSeconds(expiresAt: string): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000))
}

export function AuthHandoffPanel() {
  const [state, setState] = useState<HandoffState>('closed')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (state !== 'ready' || !expiresAt) return

    const update = () => {
      const remaining = getRemainingSeconds(expiresAt)
      setRemainingSeconds(remaining)
      if (remaining === 0) setState('expired')
    }
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt, state])

  async function openHandoff() {
    setState('loading')
    setError('')

    if (!['http:', 'https:'].includes(window.location.protocol)) {
      setState('error')
      setError('请从公开 HTTPS 网站打开饭搭子后再生成二维码')
      return
    }

    const result = await createAuthHandoff()
    if (result.error) {
      setState('error')
      setError(result.error)
      return
    }

    const handoffUrl = new URL(AUTH_HANDOFF_ENTRY_URL)
    handoffUrl.searchParams.set('auth_handoff', result.token)
    try {
      const dataUrl = await QRCode.toDataURL(handoffUrl.toString(), {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 280,
      })
      setQrDataUrl(dataUrl)
      setExpiresAt(result.expiresAt)
      setRemainingSeconds(getRemainingSeconds(result.expiresAt))
      setState('ready')
    } catch {
      setState('error')
      setError('二维码图片生成失败，请重试')
    }
  }

  function closeHandoff() {
    setState('closed')
    setQrDataUrl('')
    setExpiresAt('')
    setRemainingSeconds(0)
    setError('')
  }

  return (
    <div className="auth-handoff-panel">
      <div className="auth-handoff-copy">
        <strong>手机不用再输入密码？</strong>
        <span>在手机饭搭子登录页点击“扫描电脑二维码登录”，对准这张二维码即可。</span>
      </div>

      {state === 'closed' && (
        <button type="button" className="auth-handoff-trigger" onClick={() => void openHandoff()}>
          用手机扫码登录
        </button>
      )}

      {state === 'loading' && <p className="auth-handoff-status">正在生成一次性二维码…</p>}

      {(state === 'ready' || state === 'expired') && (
        <div className="auth-handoff-qr-wrap">
          {qrDataUrl && <img className="auth-handoff-qr" src={qrDataUrl} alt="手机扫码接力登录二维码" />}
          <p className="auth-handoff-status">
            {state === 'ready'
              ? `请在手机登录页内扫描，二维码 ${remainingSeconds} 秒后失效`
              : '二维码已失效，请重新生成'}
          </p>
          <div className="auth-handoff-actions">
            <button type="button" onClick={() => void openHandoff()}>
              {state === 'ready' ? '重新生成' : '生成新二维码'}
            </button>
            <button type="button" className="auth-handoff-secondary" onClick={closeHandoff}>关闭</button>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="auth-handoff-error">
          <p>{error}</p>
          <div className="auth-handoff-actions">
            <button type="button" onClick={() => void openHandoff()}>重试</button>
            <button type="button" className="auth-handoff-secondary" onClick={closeHandoff}>关闭</button>
          </div>
        </div>
      )}
    </div>
  )
}
