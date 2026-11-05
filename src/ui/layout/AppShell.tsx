import type { Screen } from '../../store/gameStore'
import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { cx } from '../components/ui'
import { TopBar } from './TopBar'
import { unreadCount, pendingDecisions } from '../../engine/inbox/messages'
import { DashboardScreen } from '../screens/DashboardScreen'
import { InboxScreen } from '../screens/InboxScreen'
import { CalendarScreen } from '../screens/CalendarScreen'
import { WeekendScreen } from '../screens/WeekendScreen'
import { RaceScreen } from '../screens/RaceScreen'
import { StandingsScreen } from '../screens/StandingsScreen'
import { CarScreen } from '../screens/CarScreen'
import { DriversScreen } from '../screens/DriversScreen'
import { StaffScreen } from '../screens/StaffScreen'
import { MarketScreen } from '../screens/MarketScreen'
import { FacilitiesScreen } from '../screens/FacilitiesScreen'
import { FinancesScreen } from '../screens/FinancesScreen'
import { BoardScreen } from '../screens/BoardScreen'
import { SavesScreen } from '../screens/SavesScreen'
import { PersonModal } from '../components/PersonModal'

const NAV: { id: Screen; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: '◧' },
  { id: 'inbox', label: 'Boîte de réception', icon: '✉' },
  { id: 'calendar', label: 'Calendrier', icon: '▦' },
  { id: 'weekend', label: 'Week-end', icon: '⚑' },
  { id: 'standings', label: 'Classements', icon: '≡' },
  { id: 'car', label: 'Voiture & R&D', icon: '⚙' },
  { id: 'drivers', label: 'Pilotes', icon: '◉' },
  { id: 'staff', label: 'Personnel', icon: '☷' },
  { id: 'market', label: 'Marché', icon: '⇄' },
  { id: 'facilities', label: 'Installations', icon: '⌂' },
  { id: 'finances', label: 'Finances', icon: '€' },
  { id: 'board', label: 'Conseil & parts', icon: '◔' },
  { id: 'saves', label: 'Sauvegardes', icon: '⛁' },
]

export function AppShell() {
  const game = useGameState()
  const screen = useGame((s) => s.screen)
  const setScreen = useGame((s) => s.setScreen)
  const unread = unreadCount(game)
  const pending = pendingDecisions(game)
  const inWeekend = game.clock.phase === 'raceWeekend'
  const effective: Screen = screen === 'race' && !game.race ? 'weekend' : screen

  const content = (() => {
    switch (effective) {
      case 'dashboard':
        return <DashboardScreen />
      case 'inbox':
        return <InboxScreen />
      case 'calendar':
        return <CalendarScreen />
      case 'weekend':
        return game.race ? <RaceScreen /> : <WeekendScreen />
      case 'race':
        return <RaceScreen />
      case 'standings':
        return <StandingsScreen />
      case 'car':
        return <CarScreen />
      case 'drivers':
        return <DriversScreen />
      case 'staff':
        return <StaffScreen />
      case 'market':
        return <MarketScreen />
      case 'facilities':
        return <FacilitiesScreen />
      case 'finances':
        return <FinancesScreen />
      case 'board':
        return <BoardScreen />
      case 'saves':
        return <SavesScreen />
    }
  })()

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-ink-800 bg-ink-900 lg:flex">
        <div className="flex items-center gap-2 border-b border-ink-800 px-4 py-4">
          <img src="./favicon.svg" alt="" className="h-8 w-8" />
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide">GENESIS MAGMA</div>
            <div className="text-[11px] tracking-[0.2em] text-copper-400">F1 TEAM</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setScreen(n.id)}
              className={cx(
                'mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                effective === n.id || (n.id === 'weekend' && effective === 'race') ? 'bg-magma-500/15 text-magma-400' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
              )}
            >
              <span className="w-4 text-center opacity-80">{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.id === 'inbox' && unread > 0 && <span className="rounded-full bg-magma-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
              {n.id === 'weekend' && inWeekend && <span className="h-2 w-2 animate-pulse rounded-full bg-magma-500" />}
            </button>
          ))}
        </nav>
        {pending > 0 && (
          <button onClick={() => setScreen('inbox')} className="m-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-left text-xs text-warn">
            {pending} décision{pending > 1 ? 's' : ''} en attente
          </button>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <nav className="flex gap-1 overflow-x-auto border-b border-ink-800 bg-ink-900 px-2 py-1.5 lg:hidden">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setScreen(n.id)}
              className={cx('flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs', effective === n.id ? 'bg-magma-500/15 text-magma-400' : 'text-ink-300')}
            >
              {n.label}
              {n.id === 'inbox' && unread > 0 && <span className="rounded-full bg-magma-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
            </button>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">{content}</main>
      </div>
      <PersonModal />
    </div>
  )
}
