import { useState } from 'react'
import { useGame } from '../../store/gameStore'
import { Button, Modal, cx } from './ui'
import { CHEATS } from '../../engine/cheats'
import type { GameState } from '../../engine/model/types'
import { fmtEur, fmtUsd } from '../../engine/core/money'

export function CheatModal() {
  const overlay = useGame((s) => s.overlay)
  const setOverlay = useGame((s) => s.setOverlay)
  const game = useGame((s) => s.game)
  const act = useGame((s) => s.act)
  const toast = useGame((s) => s.toast)
  const [cash, setCash] = useState(100)
  const [cap, setCap] = useState(215)
  const [val, setVal] = useState(6)
  if (!game) return null
  const flags = game.meta.cheats ?? { used: false, alwaysAccept: false, noFailures: false }
  const run = (label: string, fn: (s: GameState) => void) => {
    act(fn, { save: 'now' })
    toast(`Triche : ${label}`, 'good')
  }
  const row = (label: string, desc: string, action: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/60 py-3 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-ink-400">{desc}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{action}</div>
    </div>
  )
  const toggle = (flag: 'alwaysAccept' | 'noFailures', label: string) => (
    <button
      onClick={() => act((s) => CHEATS.setFlag(s, flag, !flags[flag]), { save: 'now' })}
      className={cx('rounded-full px-3 py-1 text-xs font-semibold', flags[flag] ? 'bg-good/15 text-good' : 'bg-ink-800 text-ink-400')}
    >
      {flags[flag] ? `✓ ${label}` : label}
    </button>
  )
  const input = (v: number, set: (n: number) => void, suffix: string) => (
    <label className="flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-800 px-2 py-1 text-sm">
      <input type="number" value={v} onChange={(e) => set(Number(e.target.value))} className="w-20 bg-transparent text-right outline-none" />
      <span className="text-ink-400">{suffix}</span>
    </label>
  )
  return (
    <Modal open={overlay === 'cheats'} onClose={() => setOverlay(null)} title="✦ Menu de triche" wide>
      <p className="mb-3 rounded-lg bg-copper-400/10 px-3 py-2 text-xs text-copper-300">La carrière sera marquée « triche » dans la barre du haut. Tout reste modifiable à tout moment.</p>
      <div className="grid gap-x-8 md:grid-cols-2">
        <div>
          <h4 className="mt-2 text-xs font-semibold tracking-widest text-ink-400 uppercase">Argent & règlement</h4>
          {row('Ajouter de la trésorerie', `Trésorerie actuelle : ${fmtEur(game.finances.cashEur)}`, (
            <>
              {input(cash, setCash, 'M€')}
              <Button size="sm" variant="primary" onClick={() => run(`+${cash} M€`, (s) => CHEATS.addCash(s, cash * 1e6))}>
                Ajouter
              </Button>
            </>
          ))}
          {row('Remettre le plafond à zéro', `Dépensé : ${fmtUsd(game.finances.costCap.spentUsd)}`, <Button size="sm" onClick={() => run('plafond remis à zéro', CHEATS.resetCostCap)}>Réinitialiser</Button>)}
          {row('Changer la limite du plafond', `Limite : ${fmtUsd(game.finances.costCap.limitUsd)}`, (
            <>
              {input(cap, setCap, 'M$')}
              <Button size="sm" onClick={() => run('limite du plafond modifiée', (s) => CHEATS.setCostCapLimit(s, cap * 1e6))}>
                Appliquer
              </Button>
            </>
          ))}
          {row('Valorisation de l’écurie', 'Déclenche les earn-out si le seuil est atteint', (
            <>
              {input(val, setVal, 'Md€')}
              <Button size="sm" onClick={() => run('valorisation modifiée', (s) => CHEATS.setValuation(s, val * 1e9))}>
                Appliquer
              </Button>
            </>
          ))}
          {row('Conseil conquis', 'Confiance et satisfaction des actionnaires à 100', <Button size="sm" onClick={() => run('conseil conquis', CHEATS.pleaseBoard)}>Appliquer</Button>)}
          {row('Toutes les parts de Liam', 'Débloque vesting, sweat equity et earn-out', <Button size="sm" onClick={() => run('parts débloquées', CHEATS.unlockAllEquity)}>Débloquer</Button>)}
          {row('Réputation maximale', 'Attire sponsors et recrues', <Button size="sm" onClick={() => run('réputation 100', (s) => CHEATS.setReputation(s, 100))}>Appliquer</Button>)}
        </div>
        <div>
          <h4 className="mt-2 text-xs font-semibold tracking-widest text-ink-400 uppercase">Voiture & installations</h4>
          {row('Améliorer la voiture', 'Toutes les notes de la voiture', (
            <>
              <Button size="sm" onClick={() => run('voiture +5', (s) => CHEATS.boostCar(s, 5))}>+5</Button>
              <Button size="sm" onClick={() => run('voiture au maximum', CHEATS.maxCar)}>Max</Button>
            </>
          ))}
          {row('Terminer les projets de R&D', 'Conception et production instantanées', <Button size="sm" onClick={() => run('projets terminés', CHEATS.finishProjects)}>Terminer</Button>)}
          {row('Installations', 'Terminer les travaux ou tout passer au niveau maximal', (
            <>
              <Button size="sm" onClick={() => run('travaux terminés', CHEATS.finishFacilities)}>Finir travaux</Button>
              <Button size="sm" onClick={() => run('installations au maximum', CHEATS.maxFacilities)}>Tout max</Button>
            </>
          ))}
          {row('Moteurs neufs', 'Allocation remise à zéro, pénalités effacées', <Button size="sm" onClick={() => run('moteurs neufs', CHEATS.freshEngines)}>Appliquer</Button>)}
          {row('Programme Hyundai terminé', 'Moteur Namyang homologué', <Button size="sm" onClick={() => run('programme Hyundai terminé', CHEATS.finishHyundai)}>Terminer</Button>)}
          <h4 className="mt-4 text-xs font-semibold tracking-widest text-ink-400 uppercase">Équipe</h4>
          {row('Pilotes', 'Notes de vos pilotes', <Button size="sm" onClick={() => run('pilotes +5', (s) => CHEATS.boostDrivers(s, 5))}>+5</Button>)}
          {row('Personnel', 'Notes de votre encadrement', <Button size="sm" onClick={() => run('staff +5', (s) => CHEATS.boostStaff(s, 5))}>+5</Button>)}
          {row('Moral au maximum', 'Pilotes et staff', <Button size="sm" onClick={() => run('moral maximal', CHEATS.maxMorale)}>Appliquer</Button>)}
          {row('Pit crew parfait', 'Vitesse et régularité 99', <Button size="sm" onClick={() => run('pit crew parfait', CHEATS.maxPitCrew)}>Appliquer</Button>)}
          {row('Options permanentes', 'Restent actives jusqu’à désactivation', (
            <>
              {toggle('alwaysAccept', 'Signatures toujours acceptées')}
              {toggle('noFailures', 'Aucune panne')}
            </>
          ))}
        </div>
      </div>
    </Modal>
  )
}
