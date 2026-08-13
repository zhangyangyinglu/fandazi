import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import '@/design/tokens.css'
import { enablePwaAutoUpdate } from '@/lib/pwaAutoUpdate'

enablePwaAutoUpdate()

// 自愈机制：懒加载 chunk 失败（常见于版本更新后旧缓存引用已删除的旧 JS 文件）时，
// 自动注销 SW + 清缓存（不动 localStorage 用户数据）后刷新一次。sessionStorage 防无限循环。
window.addEventListener('vite:preloadError', (event) => {
  const guardKey = 'fandazi.preloadErrorRecovered'
  event.preventDefault()
  if (sessionStorage.getItem(guardKey)) return
  sessionStorage.setItem(guardKey, '1')
  void (async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.map((n) => caches.delete(n)))
      }
    } finally {
      window.location.reload()
    }
  })()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
