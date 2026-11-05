import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { Badge, Bar, Button, Card, PageTitle, Select, Stat } from '../components/ui'
import { STAFF_ROLE_LABEL, fullName, personAge, staffOverall, teamStaffByRole, RATING_LABEL } from '../../engine/people/ratings'
import { assignEngineer } from '../../engine/people/contracts'
import { moraleLabel } from '../../engine/people/morale'
import { fmtEur } from '../../engine/core/money'
import type { StaffMember, StaffRole } from '../../engine/model/types'
import { designPoints } from '../../engine/car/rnd'

const ROLE_HELP: Record<StaffRole, string> = {
  technicalDirector: 'Pilote tout le département technique : principal levier des points de design.',
  headOfAero: "Rendement des projets aérodynamiques (avec soufflerie et CFD).",
  chiefDesigner: "Dirige le bureau d'études : conception châssis et production.",
  sportingDirector: 'Stratégie de course, gestion des stands, règlement.',
  raceEngineer: 'Un par pilote : réglages du week-end et communication radio.',
  headOfScouting: 'Précision des notes affichées sur le marché des pilotes et du staff.',
}

const ROLES: [StaffRole, number][] = [
  ['technicalDirector', 1],
  ['headOfAero', 1],
  ['chiefDesigner', 1],
  ['sportingDirector', 1],
  ['raceEngineer', 2],
  ['headOfScouting', 1],
]

export function StaffScreen() {
  const game = useGameState()
  const act = useGame((s) => s.act)
  const setScreen = useGame((s) => s.setScreen)
  const team = game.teams[game.playerTeamId]
  const pc = team.pitCrew
  const dp = designPoints(game)
  return (
    <div className="space-y-5">
      <PageTitle title="Personnel" sub={`Encadrement technique et sportif · ${Math.round(dp.total)} points de design / semaine`} actions={<Button onClick={() => setScreen('market')}>Recruter ▸</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ROLES.flatMap(([role, n]) => {
          const people = teamStaffByRole(game, team.id, role)
          return Array.from({ length: Math.max(n, people.length) }, (_, i) => <StaffSlot key={`${role}-${i}`} role={role} s={people[i]} />)
        })}
      </div>
      <Card title="Équipe de mécaniciens (pit crew)">
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Vitesse" value={pc.speed.toFixed(1)} />
          <Stat label="Régularité" value={pc.consistency.toFixed(1)} />
          <Stat label="Fatigue" value={pc.fatigue.toFixed(1)} tone={pc.fatigue > 15 ? 'warn' : undefined} />
          <div>
            <div className="text-[11px] tracking-wide text-ink-400 uppercase">Entraînement</div>
            <Select
              value={pc.trainingFocus}
              onChange={(v) =>
                act((s) => {
                  s.teams[s.playerTeamId].pitCrew.trainingFocus = v
                })
              }
              options={[
                { value: 'speed', label: 'Vitesse des arrêts' },
                { value: 'consistency', label: 'Régularité' },
                { value: 'rest', label: 'Repos (récupération)' },
              ]}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}

function StaffSlot({ role, s }: { role: StaffRole; s?: StaffMember }) {
  const game = useGameState()
  const act = useGame((st) => st.act)
  const openPerson = useGame((st) => st.openPerson)
  const setScreen = useGame((st) => st.setScreen)
  const team = game.teams[game.playerTeamId]
  return (
    <Card title={STAFF_ROLE_LABEL[role]} actions={s ? <Badge tone="copper">{Math.round(staffOverall(s))}</Badge> : <Badge tone="warn">Vacant</Badge>}>
      {s ? (
        <div className="space-y-2 text-sm">
          <button className="font-semibold hover:text-copper-300" onClick={() => openPerson(s.id)}>
            {fullName(s)}
          </button>
          <div className="text-xs text-ink-400">
            {s.nationality} · {personAge(game, s)} ans · {s.contract ? `${fmtEur(s.contract.salaryEur, 2)}/an → ${s.contract.endSeason}` : ''}
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            {Object.entries(s.ratings).map(([k, v]) => (
              <div key={k}>
                <div className="truncate text-ink-400">{RATING_LABEL[k]}</div>
                <div className="font-medium tabular">{Math.round(v)}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-ink-400">
            Moral : {moraleLabel(s.morale)} <Bar value={s.morale} tone={s.morale >= 65 ? 'good' : s.morale >= 45 ? 'warn' : 'bad'} height={4} />
          </div>
          {role === 'raceEngineer' && (
            <Select
              className="w-full"
              value={s.assignedDriverId ?? ''}
              onChange={(v) => act((st) => assignEngineer(st, s.id, v || null))}
              options={[{ value: '', label: 'Non affecté' }, ...team.driverIds.map((d) => ({ value: d, label: `Ingénieur de ${fullName(game.drivers[d])}` }))]}
            />
          )}
        </div>
      ) : (
        <div className="space-y-2 text-sm text-ink-400">
          <p>{ROLE_HELP[role]}</p>
          <Button size="sm" variant="primary" onClick={() => setScreen('market')}>
            Trouver un candidat
          </Button>
        </div>
      )}
    </Card>
  )
}
