import { useState } from 'react'
import type { Screen } from '../../store/gameStore'
import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { cx } from '../components/ui'
import { TopBar } from './TopBar'
import { SceneBackdrop } from '../components/Scene'
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
import { SettingsModal } from '../components/SettingsModal'
import { CheatModal } from '../components/CheatModal'

export const NAV_GROUPS: { id: string; label: string; items: { id: Screen; label: string; icon: string }[] }[] = [
  {
    id: 'hq',
    label: 'Quartier général',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: '◧' },
      { id: 'inbox', label: 'Boîte de réception', icon: '✉' },
    ],
  },
  {
    id: 'racing',
    label: 'Course',
    items: [
      { id: 'weekend', label: 'Week-end de course', icon: '⚑' },
      { id: 'calendar', label: 'Calendrier', icon: '▦' },
      { id: 'standings', label: 'Classements', icon: '≡' },
    ],
  },
  {
    id: 'tech',
    label: 'Technique',
    items: [
      { id: 'car', label: 'Voiture & R&D', icon: '⚙' },
      { id: 'facilities', label: 'Installations', icon: '⌂' },
    ],
  },
  {
    id: 'team',
    label: 'Équipe',
    items: [
      { id: 'drivers', label: 'Pilotes', icon: '◉' },
      { id: 'staff', label: 'Personnel', icon: '☷' },
      { id: 'market', label: 'Marché des transferts', icon: '⇄' },
    ],
  },
  {
    id: 'direction',
    label: 'Direction',
    items: [
      { id: 'finances', label: 'Finances & sponsors', icon: '€' },
      { id: 'board', label: 'Conseil & parts', icon: '◔' },
    ],
  },
]

export function AppShell() {
  const game = useGameState()
  const screen = useGame((s) => s.screen)
  const setScreen = useGame((s) => s.setScreen)
  const setOverlay = useGame((s) => s.setOverlay)
  const [closed, setClosed] = useState<Record<string, boolean>>({})
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
      case 'race':
        return game.race ? <RaceScreen /> : <WeekendScreen />
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

  const badge = (id: Screen) =>
    id === 'inbox' && unread > 0 ? (
      <span className="rounded-full bg-magma-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>
    ) : id === 'weekend' && inWeekend ? (
      <span className="h-2 w-2 rounded-full bg-magma-500" style={{ animation: 'pulse-dot 1.4s infinite' }} />
    ) : null

  return (
    <div className="relative min-h-screen">
      <SceneBackdrop scene={effective} />
      <div className="relative z-10 flex min-h-screen">
        <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-700/70 lg:flex">
          <button onClick={() => setScreen('dashboard')} className="flex items-center gap-3 border-b border-ink-700/70 px-5 py-5 text-left">
            <img src="./favicon.svg" alt="" className="h-9 w-9" />
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wide">GENESIS MAGMA</div>
              <div className="text-[11px] tracking-[0.25em] text-copper-400">F1 TEAM · QG</div>
            </div>
          </button>
          <nav className="flex-1 overflow-y-auto px-3 py-3">
            {NAV_GROUPS.map((g) => (
              <div key={g.id} className="mb-2">
                <button
                  onClick={() => setClosed({ ...closed, [g.id]: !closed[g.id] })}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase hover:text-ink-100"
                >
                  {g.label}
                  <span className={cx('transition-transform', closed[g.id] ? '' : 'rotate-90')}>›</span>
                </button>
                {!closed[g.id] &&
                  g.items.map((n) => {
                    const active = effective === n.id || (n.id === 'weekend' && effective === 'race')
                    return (
                      <button
                        key={n.id}
                        onClick={() => setScreen(n.id)}
                        className={cx(
                          'mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                          active ? 'bg-magma-500 font-medium text-white shadow-sm' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
                        )}
                      >
                        <span className="w-4 text-center opacity-80">{n.icon}</span>
                        <span className="flex-1">{n.label}</span>
                        {badge(n.id)}
                      </button>
                    )
                  })}
              </div>
            ))}
          </nav>
          {pending > 0 && (
            <button onClick={() => setScreen('inbox')} className="mx-3 mb-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-left text-xs font-medium text-warn">
              ⚠ {pending} décision{pending > 1 ? 's' : ''} en attente
            </button>
          )}
          <div className="grid grid-cols-3 gap-1 border-t border-ink-700/70 p-3 text-[11px]">
            <button onClick={() => setScreen('saves')} className="rounded-lg px-2 py-2 text-ink-300 hover:bg-ink-800 hover:text-ink-100">
              ⛁<div>Sauvegardes</div>
            </button>
            <button onClick={() => setOverlay('settings')} className="rounded-lg px-2 py-2 text-ink-300 hover:bg-ink-800 hover:text-ink-100">
              ⚙<div>Paramètres</div>
            </button>
            <button onClick={() => setOverlay('cheats')} className="rounded-lg px-2 py-2 text-ink-300 hover:bg-ink-800 hover:text-ink-100">
              ✦<div>Triche</div>
            </button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <nav className="glass flex gap-1 overflow-x-auto border-b border-ink-700/70 px-2 py-1.5 lg:hidden">
            {NAV_GROUPS.flatMap((g) => g.items).map((n) => (
              <button
                key={n.id}
                onClick={() => setScreen(n.id)}
                className={cx('flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs', effective === n.id ? 'bg-magma-500 text-white' : 'text-ink-300')}
              >
                {n.label}
                {badge(n.id)}
              </button>
            ))}
          </nav>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">{content}</main>
        </div>
      </div>
      <PersonModal />
      <SettingsModal />
      <CheatModal />
    </div>
  )
}
