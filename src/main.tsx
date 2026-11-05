import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useGame } from './store/gameStore'

// Accès au store depuis la console du navigateur en développement.
if (import.meta.env.DEV) (window as unknown as { genesis: typeof useGame }).genesis = useGame

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
