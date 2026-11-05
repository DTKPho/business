import { useMemo, useState } from 'react'
import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { Badge, Card, PageTitle, Select, Table, Tabs, TeamDot, cx, td, th } from '../components/ui'
import { STAFF_ROLE_LABEL, driverOverall, fullName, personAge, scoutedValue, scoutingQuality, staffOverall } from '../../engine/people/ratings'
import { askingSalary, buyoutCost } from '../../engine/people/contracts'
import { fmtEur } from '../../engine/core/money'
import type { Person, StaffRole } from '../../engine/model/types'

type Tab = 'drivers' | 'staff'
type DriverFilter = 'all' | 'free' | 'F1' | 'F2' | 'F3'

export function MarketScreen() {
  const game = useGameState()
  const openPerson = useGame((s) => s.openPerson)
  const [tab, setTab] = useState<Tab>('drivers')
  const [df, setDf] = useState<DriverFilter>('free')
  const [role, setRole] = useState<StaffRole | 'all'>('all')
  const [staffFree, setStaffFree] = useState<'free' | 'all'>('free')
  const [sort, setSort] = useState<'overall' | 'age' | 'salary'>('overall')
  const q = Math.round(scoutingQuality(game))

  const rows = useMemo(() => {
    let list: Person[]
    if (tab === 'drivers') {
      list = Object.values(game.drivers).filter((d) => !d.retired && d.teamId !== game.playerTeamId && game.teams[game.playerTeamId].reserveDriverId !== d.id)
      if (df === 'free') list = list.filter((d) => d.kind === 'driver' && !d.teamId && (d.series === 'FA' || d.series === 'F2' || d.series === 'F3'))
      else if (df !== 'all') list = list.filter((d) => d.kind === 'driver' && d.series === df)
    } else {
      list = Object.values(game.staff).filter((s) => !s.retired && s.teamId !== game.playerTeamId && (role === 'all' || s.role === role) && (staffFree === 'all' || !s.teamId))
    }
    const ov = (p: Person) => scoutedValue(game, p, 'overall', p.kind === 'driver' ? driverOverall(p) : staffOverall(p)).value
    return list
      .map((p) => ({ p, ov: ov(p), age: personAge(game, p), ask: askingSalary(game, p), buyout: buyoutCost(game, p) }))
      .sort((a, b) => (sort === 'overall' ? b.ov - a.ov : sort === 'age' ? a.age - b.age : a.ask - b.ask))
  }, [game, tab, df, role, staffFree, sort])

  return (
    <div className="space-y-4">
      <PageTitle title="Marché des transferts" sub={`Qualité du scouting : ${q}/100 — les notes des personnes hors de Genesis sont des estimations`} />
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'drivers', label: 'Pilotes' },
            { id: 'staff', label: 'Personnel' },
          ]}
        />
        {tab === 'drivers' ? (
          <Select<DriverFilter>
            value={df}
            onChange={setDf}
            options={[
              { value: 'free', label: 'Disponibles (libres, F2, F3)' },
              { value: 'F1', label: 'Pilotes F1 sous contrat' },
              { value: 'F2', label: 'Formule 2' },
              { value: 'F3', label: 'Formule 3' },
              { value: 'all', label: 'Tous' },
            ]}
          />
        ) : (
          <>
            <Select<StaffRole | 'all'> value={role} onChange={setRole} options={[{ value: 'all', label: 'Tous les rôles' }, ...(Object.keys(STAFF_ROLE_LABEL) as StaffRole[]).map((r) => ({ value: r, label: STAFF_ROLE_LABEL[r] }))]} />
            <Select
              value={staffFree}
              onChange={setStaffFree}
              options={[
                { value: 'free', label: 'Libres' },
                { value: 'all', label: 'Libres et sous contrat' },
              ]}
            />
          </>
        )}
        <Select
          value={sort}
          onChange={setSort}
          options={[
            { value: 'overall', label: 'Tri : note' },
            { value: 'age', label: 'Tri : âge' },
            { value: 'salary', label: 'Tri : salaire' },
          ]}
        />
      </div>
      <Card pad={false}>
        <Table>
          <thead>
            <tr>
              <th className={th}>Nom</th>
              <th className={th}>{tab === 'drivers' ? 'Série / écurie' : 'Rôle / écurie'}</th>
              <th className={cx(th, 'text-right')}>Âge</th>
              <th className={cx(th, 'text-right')}>Note</th>
              {tab === 'drivers' && <th className={cx(th, 'text-right')}>Potentiel</th>}
              <th className={cx(th, 'text-right')}>Salaire demandé</th>
              <th className={cx(th, 'text-right')}>Indemnité</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 150).map(({ p, ov, age, ask, buyout }) => {
              const team = p.teamId ? game.teams[p.teamId] : null
              const margin = scoutedValue(game, p, 'overall', 50).margin
              const pot = p.kind === 'driver' ? scoutedValue(game, p, 'potential', p.potential) : null
              return (
                <tr key={p.id} className="cursor-pointer hover:bg-ink-850" onClick={() => openPerson(p.id)}>
                  <td className={td}>
                    <span className="font-medium">{fullName(p)}</span>
                    {p.kind === 'driver' && p.affiliation && <Badge className="ml-1.5">{p.affiliation}</Badge>}
                    {p.generated && <span className="ml-1 text-[10px] text-ink-600">gén.</span>}
                  </td>
                  <td className={td}>
                    <span className="flex items-center gap-1.5 text-ink-300">
                      {team && <TeamDot color={team.colors.primary} />}
                      {p.kind === 'driver' ? (p.series === 'FA' ? 'Libre' : p.series) : STAFF_ROLE_LABEL[p.role]}
                      {team ? ` · ${team.shortName}` : p.kind === 'driver' && p.juniorTeam && p.series !== 'FA' ? ` · ${p.juniorTeam}` : ''}
                    </span>
                  </td>
                  <td className={cx(td, 'text-right tabular')}>{age}</td>
                  <td className={cx(td, 'text-right font-semibold tabular')}>
                    {ov}
                    {margin > 0 && <span className="text-[10px] font-normal text-ink-400"> ±{margin}</span>}
                  </td>
                  {pot && <td className={cx(td, 'text-right tabular')}>{pot.value}</td>}
                  <td className={cx(td, 'text-right tabular')}>{fmtEur(ask, 2)}</td>
                  <td className={cx(td, 'text-right tabular')}>{buyout ? fmtEur(buyout) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
