import { useEffect, useState } from 'react'
import { completeAuthHandoff, grantAuthHandoffAccess, readAuthHandoffToken } from '@/lib/authHandoff'
import './AuthHandoffReceiver.css'

type ReceiverState = 'idle' | 'loading' | 'error'

export function AuthHandoffReceiver() {
  const [token] = useState(() => readAuthHandoffToken())
  const [state, setState] = useState<ReceiverState>(token ? 'loading' : 'idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    let active = true
    void completeAuthHandoff(token).then((result) => {
      if (!active) return
      if (result.error) {
        setState('error')
        setError(result.error)
        return
      }

      grantAuthHandoffAccess()
      window.location.replace('/')
    })

    return () => {
      active = false
    }
  }, [token])

  if (!token || state === 'idle') return null

  return (
    <div className="auth-handoff-receiver" role="status" aria-live="polite">
      <div className="auth-handoff-receiver-card">
        {state === 'loading' ? (
          <>
            <div className="auth-handoff-receiver-spinner" aria-hidden="true" />
            <h1>正在接收电脑登录</h1>
            <p>请稍候，手机不会要求你再次输入密码。</p>
          </>
        ) : (
          <>
            <div className="auth-handoff-receiver-mark" aria-hidden="true">!</div>
            <h1>二维码登录没有完成</h1>
            <p>{error}</p>
            <p>请回到电脑重新生成二维码，再用手机扫描。</p>
          </>
        )}
      </div>
    </div>
  )
}
