import { useState } from 'react'
import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { Badge, Bar, Button, Modal, RatingRow, Select, TeamDot } from './ui'
import type { Person } from '../../engine/model/types'
import { RATING_LABEL, STAFF_ROLE_LABEL, driverOverall, fullName, personAge, scoutedValue, staffOverall } from '../../engine/people/ratings'
import { askingSalary, buyoutCost, evaluateOffer, getPerson, releaseFromPlayer, signWithPlayer } from '../../engine/people/contracts'
import { moraleLabel } from '../../engine/people/morale'
import { fmtEur } from '../../engine/core/money'

const SERIES_LABEL = { F1: 'Formule 1', F2: 'Formule 2', F3: 'Formule 3', FA: 'Libre' } as const

export function personSubtitle(p: Person, teamName?: string): string {
  if (p.kind === 'driver') return `${SERIES_LABEL[p.series]}${p.juniorTeam && p.series !== 'F1' ? ` · ${p.juniorTeam}` : ''}${teamName ? ` · ${teamName}` : ''}`
  return `${STAFF_ROLE_LABEL[p.role]}${teamName ? ` · ${teamName}` : ''}`
}

export function PersonModal() {
  const game = useGameState()
  const id = useGame((s) => s.focusPersonId)
  const open = useGame((s) => s.openPerson)
  const p = id ? getPerson(game, id) : undefined
  return (
    <Modal open={!!p} onClose={() => open(null)} title={p ? fullName(p) : ''} wide>
      {p && <PersonDetail key={p.id} p={p} />}
    </Modal>
  )
}

function PersonDetail({ p }: { p: Person }) {
  const game = useGameState()
  const act = useGame((s) => s.act)
  const toast = useGame((s) => s.toast)
  const close = useGame((s) => s.openPerson)
  const mine = p.teamId === game.playerTeamId
  const team = p.teamId ? game.teams[p.teamId] : null
  const asking = askingSalary(game, p)
  const [salary, setSalary] = useState(Math.round((mine && p.contract ? Math.max(p.contract.salaryEur, asking) : asking) / 10000) * 10000)
  const [years, setYears] = useState(2)
  const [role, setRole] = useState<'first' | 'second' | 'reserve'>(p.kind === 'driver' && (p.series === 'F2' || p.series === 'F3') ? 'reserve' : 'second')
  const [feedback, setFeedback] = useState<string | null>(null)
  const buyout = buyoutCost(game, p)
  const overall = p.kind === 'driver' ? driverOverall(p) : staffOverall(p)
  const ov = scoutedValue(game, p, 'overall', overall)
  const ratings = p.kind === 'driver' ? (p.ratings as unknown as Record<string, number>) : p.ratings
  const preview = !mine ? evaluateOffer(game, p, { salaryEur: salary, years, role: p.kind === 'driver' ? role : undefined }) : null

  const submit = () => {
    const r = act((s) => signWithPlayer(s, p.id, { salaryEur: salary, years, role: p.kind === 'driver' ? role : undefined }), { save: 'now' })
    setFeedback(r.message)
    if (r.accepted) toast(r.message, 'good')
    if (r.counterSalary) setSalary(r.counterSalary)
  }
  const release = () => {
    if (!confirm(`Libérer ${fullName(p)} ? Une indemnité de 50 % du salaire restant sera versée.`)) return
    const r = act((s) => releaseFromPlayer(s, p.id), { save: 'now' })
    toast(`${fullName(p)} est libéré (indemnité ${fmtEur(r.cost)}).`)
    close(null)
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-ink-300">
              {team && <TeamDot color={team.colors.primary} />}
              {personSubtitle(p, team?.shortName)}
            </div>
            <div className="mt-1 text-xs text-ink-400">
              {p.nationality} · {personAge(game, p)} ans{p.generated ? ' · profil généré' : ''}
              {p.kind === 'driver' && p.affiliation ? ` · junior ${p.affiliation}` : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold tabular">
              {ov.margin ? '≈' : ''}
              {ov.value}
            </div>
            <div className="text-[11px] text-ink-400">note globale{ov.margin ? ` ±${ov.margin}` : ''}</div>
          </div>
        </div>
        <div className="space-y-1.5">
          {Object.entries(ratings).map(([k, v]) => {
            const sv = scoutedValue(game, p, k, v)
            return <RatingRow key={k} label={RATING_LABEL[k] ?? k} value={sv.value} margin={sv.margin} />
          })}
          {p.kind === 'driver' && (() => {
            const pot = scoutedValue(game, p, 'potential', p.potential)
            return <RatingRow label="Potentiel" value={pot.value} margin={pot.margin} />
          })()}
        </div>
        {!mine && ov.margin > 4 && <p className="text-[11px] text-ink-400">Notes estimées par votre cellule de scouting. Un meilleur responsable du scouting réduit la marge d'erreur.</p>}
      </div>
      <div className="space-y-4">
        <div className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-ink-400">Moral</span>
            <span>
              {moraleLabel(p.morale)} ({Math.round(p.morale)})
            </span>
          </div>
          <Bar value={p.morale} tone={p.morale >= 65 ? 'good' : p.morale >= 45 ? 'warn' : 'bad'} />
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-ink-400">Ambition</span>
            <span>{p.mentality.ambition}</span>
            <span className="text-ink-400">Loyauté</span>
            <span>{p.mentality.loyalty}</span>
            <span className="text-ink-400">Tempérament</span>
            <span>{p.mentality.temperament}</span>
            <span className="text-ink-400">Esprit d'équipe</span>
            <span>{p.mentality.teamPlayer}</span>
          </div>
        </div>
        <div className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm">
          <div className="mb-1 font-medium">Contrat</div>
          {p.contract ? (
            <div className="text-xs text-ink-300">
              {fmtEur(p.contract.salaryEur, 2)}/an · jusqu'en {p.contract.endSeason}
              {p.contract.role ? ` · ${p.contract.role === 'first' ? 'pilote n°1' : p.contract.role === 'second' ? 'pilote n°2' : 'réserviste'}` : ''}
              {mine && <span className="ml-1 text-ink-400">({p.contract.inCostCap ? 'dans le plafond' : 'hors plafond'})</span>}
            </div>
          ) : (
            <div className="text-xs text-ink-400">Libre de tout engagement</div>
          )}
          <div className="mt-1 text-xs text-ink-400">Prétentions estimées : {fmtEur(asking, 2)}/an</div>
          {buyout > 0 && <div className="mt-1 text-xs text-warn">Indemnité de transfert à verser à {team?.shortName} : {fmtEur(buyout)}</div>}
          {p.kind === 'driver' && p.leavingTo && <div className="mt-1 text-xs text-bad">A signé chez {game.teams[p.leavingTo].shortName} pour la saison prochaine.</div>}
        </div>
        {p.kind === 'driver' && (
          <div className="text-xs text-ink-400">
            Carrière F1 : {p.career.starts} départs · {p.career.wins} victoires · {p.career.podiums} podiums · {p.career.poles} poles · {p.career.titles} titre(s)
            {p.season.feederPos ? ` · ${p.series === 'F1' ? '' : `dernier classement ${p.series} : P${p.season.feederPos}`}` : ''}
          </div>
        )}
        {!p.retired && (
          <div className="space-y-3 rounded-lg border border-copper-400/30 bg-copper-400/5 p-3">
            <div className="text-sm font-medium">{mine ? 'Prolonger / renégocier' : 'Faire une offre'}</div>
            <label className="block text-xs">
              <span className="text-ink-400">Salaire annuel : </span>
              <span className="font-semibold tabular">{fmtEur(salary, 2)}</span>
              <input type="range" className="mt-1 w-full" min={Math.round(asking * 0.4)} max={Math.max(Math.round(asking * 2.5), 500000)} step={10000} value={salary} onChange={(e) => setSalary(Number(e.target.value))} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Select
                value={String(years)}
                onChange={(v) => setYears(Number(v))}
                options={[1, 2, 3, 4].map((y) => ({ value: String(y), label: `${y} saison${y > 1 ? 's' : ''}` }))}
              />
              {p.kind === 'driver' && !mine && (
                <Select
                  value={role}
                  onChange={setRole}
                  options={[
                    { value: 'first', label: 'Pilote n°1' },
                    { value: 'second', label: 'Pilote n°2' },
                    { value: 'reserve', label: 'Réserviste' },
                  ]}
                />
              )}
              <Button variant="primary" onClick={submit}>
                {mine ? 'Proposer la prolongation' : 'Envoyer l’offre'}
              </Button>
            </div>
            {preview && <div className="text-[11px] text-ink-400">Intérêt estimé : {preview.accepted ? <Badge tone="good">favorable</Badge> : preview.counterSalary ? <Badge tone="warn">à négocier</Badge> : <Badge tone="bad">faible</Badge>}</div>}
            {feedback && <div className="text-xs text-copper-300">{feedback}</div>}
          </div>
        )}
        {mine && (
          <Button variant="danger" size="sm" onClick={release}>
            Libérer de son contrat
          </Button>
        )}
      </div>
    </div>
  )
}
