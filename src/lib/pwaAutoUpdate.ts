import { registerSW } from 'virtual:pwa-register'

const CHECK_INTERVAL_MS = 60 * 60 * 1000

/** Keep official hosted installations current without asking family members to reinstall. */
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
