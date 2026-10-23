import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from '@/app/App'
import { db } from '@/db/db'
import '@/styles/globals.css'

registerSW({ immediate: true })

async function bootstrap() {
  try {
    await db.open()
    createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
  } catch (error) {
    console.error('Unable to open local storage', error)
    const root = document.getElementById('root')!
    root.textContent = 'Local storage could not be opened. Please allow browser storage and reload.'
    root.setAttribute('role', 'alert')
  }
}

void bootstrap()
