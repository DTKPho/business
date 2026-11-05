import { useEffect, useState } from 'react'
import { useGame } from './store/gameStore'
import { lastSlot } from './persistence/idb'
import { AppShell } from './ui/layout/AppShell'
import { HomeScreen } from './ui/screens/HomeScreen'
import { Toasts } from './ui/layout/Toasts'

export default function App() {
  const hasGame = useGame((s) => !!s.game)
  const loadGame = useGame((s) => s.loadGame)
  const [booting, setBooting] = useState(() => !!lastSlot())
  // Reprise automatique de la dernière partie ouverte.
  useEffect(() => {
    const id = lastSlot()
    if (!id) return
    loadGame(id)
      .catch(() => undefined)
      .finally(() => setBooting(false))
  }, [loadGame])
  if (booting) return <div className="flex min-h-screen items-center justify-center text-sm text-ink-400">Chargement de la partie…</div>
  return (
    <>
      {hasGame ? <AppShell /> : <HomeScreen />}
      <Toasts />
    </>
  )
}
