import { useGame } from '../../store/gameStore'
import { useGameState, useAction } from '../hooks'
import { Badge, Bar, Button, Card, Empty, PageTitle, RatingRow } from '../components/ui'
import { RATING_LABEL, driverOverall, fullName, personAge, raceEngineerFor } from '../../engine/people/ratings'
import { promoteReserve } from '../../engine/people/contracts'
import { moraleLabel } from '../../engine/people/morale'
import { driverStandings } from '../../engine/season/standings'
import { fmtEur } from '../../engine/core/money'
import type { Driver } from '../../engine/model/types'

export function DriversScreen() {
  const game = useGameState()
  const setScreen = useGame((s) => s.setScreen)
  const team = game.teams[game.playerTeamId]
  const reserve = team.reserveDriverId ? game.drivers[team.reserveDriverId] : null
  return (
    <div className="space-y-5">
      <PageTitle title="Pilotes" sub="Titulaires et réserviste de Genesis" actions={<Button onClick={() => setScreen('market')}>Marché des pilotes ▸</Button>} />
      {team.driverIds.length === 0 && <Empty>Aucun pilote titulaire. Recrutez-en deux sur le marché avant le premier Grand Prix.</Empty>}
      <div className="grid gap-5 lg:grid-cols-2">
        {team.driverIds.map((id) => (
          <DriverCard key={id} d={game.drivers[id]} />
        ))}
      </div>
      <Card title="Pilote de réserve">
        {reserve ? <DriverCard d={reserve} reserve /> : <p className="text-sm text-ink-400">Aucun réserviste. Recrutez un pilote F2/F3 ou libre avec le rôle « Réserviste ».</p>}
      </Card>
    </div>
  )
}

function DriverCard({ d, reserve }: { d: Driver; reserve?: boolean }) {
  const game = useGameState()
  const openPerson = useGame((s) => s.openPerson)
  const run = useAction()
  const team = game.teams[game.playerTeamId]
  const st = driverStandings(game).find((x) => x.driverId === d.id)
  const eng = raceEngineerFor(game, d.id)
  return (
    <Card
      title={
        <span>
          {fullName(d)} <span className="ml-1 text-xs font-normal text-ink-400 normal-case">{d.nationality} · {personAge(game, d)} ans</span>
        </span>
      }
      actions={<Badge tone="copper">{Math.round(driverOverall(d))}</Badge>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          {(Object.keys(d.ratings) as (keyof Driver['ratings'])[]).map((k) => (
            <RatingRow key={k} label={RATING_LABEL[k]} value={d.ratings[k]} />
          ))}
          <RatingRow label="Potentiel" value={d.potential} />
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-ink-400">Moral</span>
              <span>{moraleLabel(d.morale)}</span>
            </div>
            <Bar value={d.morale} tone={d.morale >= 65 ? 'good' : d.morale >= 45 ? 'warn' : 'bad'} />
          </div>
          <div className="text-xs text-ink-300">
            {d.contract ? `${fmtEur(d.contract.salaryEur, 2)}/an jusqu'en ${d.contract.endSeason}` : 'Sans contrat'}
            {d.contract && d.contract.endSeason <= game.clock.season && <Badge tone="warn" className="ml-2">Fin de contrat</Badge>}
          </div>
          {!reserve && (
            <div className="text-xs text-ink-300">
              Saison : P{st?.position ?? '—'} · {st?.points ?? 0} pts · {d.season.podiums} podium(s)
              <br />
              Ingénieur de course : {eng ? fullName(eng) : <span className="text-warn">aucun</span>}
            </div>
          )}
          <div className="text-xs text-ink-400">
            Carrière : {d.career.starts} GP · {d.career.wins} V · {d.career.podiums} podiums · {d.career.titles} titre(s)
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => openPerson(d.id)}>
              Contrat / fiche
            </Button>
            {!reserve && team.reserveDriverId && (
              <Button size="sm" variant="ghost" onClick={() => run((s) => promoteReserve(s, d.id), 'Changement de titulaire effectué.')}>
                Remplacer par le réserviste
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
