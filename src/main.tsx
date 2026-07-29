import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import '@/design/tokens.css'
import { enablePwaAutoUpdate } from '@/lib/pwaAutoUpdate'

enablePwaAutoUpdate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
