import { registerSW } from 'virtual:pwa-register'

const CHECK_INTERVAL_MS = 30 * 60 * 1000

/**
 * PWA 自动更新机制：
 * - registerType: 'autoUpdate' + skipWaiting + clientsClaim (vite-plugin-pwa 内置)
 * - onNeedRefresh: 检测到新版本时自动 skipWaiting，无需用户确认
 * - controllerchange: 新 SW 接管后自动刷新页面
 * - 定期 + 焦点/上线/页面可见时检查更新
 *
 * 这样用户只需关闭再打开 App，或切回 App 标签页，就会自动获取最新版本。
 * 无需手动清缓存或删 App 重装。
 */
export function enablePwaAutoUpdate() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return

  let reloading = false
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true)
    },
    onRegisteredSW(_swUrl, registration) {
      const checkForUpdate = () => void registration?.update().catch(() => undefined)
      window.setInterval(checkForUpdate, CHECK_INTERVAL_MS)
      window.addEventListener('focus', checkForUpdate)
      window.addEventListener('online', checkForUpdate)
      window.addEventListener('pageshow', checkForUpdate)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      checkForUpdate()
    },
  })

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}
