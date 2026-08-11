import { useEffect, useState } from 'react'
import './PwaInstallPrompt.css'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'fandazi.pwaInstallPromptDismissed'

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone
}

function isIosDevice(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function shouldShowIosPrompt(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return ['https:', 'http:'].includes(window.location.protocol)
    && !isStandalone()
    && localStorage.getItem(DISMISSED_KEY) !== 'true'
    && isIosDevice()
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(shouldShowIosPrompt)
  const [guideOpen, setGuideOpen] = useState(false)
  const [ios] = useState(() => typeof navigator !== 'undefined' && isIosDevice())

  useEffect(() => {
    if (!['https:', 'http:'].includes(window.location.protocol)) return

    const standalone = isStandalone()
    if (standalone || localStorage.getItem(DISMISSED_KEY) === 'true') return

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setVisible(true)
    }
    const handleInstalled = () => {
      setDeferredPrompt(null)
      setVisible(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  if (!visible) return null

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setGuideOpen(true)
      return
    }
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setVisible(false)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setVisible(false)
  }

  return (
    <aside className="pwa-install-prompt" aria-label="安装饭搭子">
      <div className="pwa-install-copy">
        <strong>把饭搭子放到主屏幕</strong>
        <span>{ios ? '以后点图标就能打开，更新会自动接收。' : '像 App 一样打开，不用每次再找网址。'}</span>
        {guideOpen && ios && <small>在 Safari 点“分享”→“添加到主屏幕”→“添加”。</small>}
      </div>
      <button type="button" className="pwa-install-action" onClick={() => void handleInstall()}>
        {ios ? '查看添加方法' : '添加到主屏幕'}
      </button>
      <button type="button" className="pwa-install-dismiss" aria-label="暂时关闭安装提示" onClick={handleDismiss}>×</button>
    </aside>
  )
}
