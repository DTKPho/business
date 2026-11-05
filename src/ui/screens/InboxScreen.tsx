import { useState } from 'react'
import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { Badge, Button, Card, Empty, PageTitle, Select, cx } from '../components/ui'
import { formatDate } from '../../engine/core/time'
import { resolveChoice } from '../../engine/inbox/events'
import type { InboxCategory } from '../../engine/model/types'

const CAT: Record<InboxCategory, string> = {
  board: 'Conseil',
  sponsor: 'Sponsors',
  staff: 'Personnel',
  driver: 'Pilotes',
  rumour: 'Rumeurs',
  crisis: 'Crise',
  race: 'Course',
  finance: 'Finances',
  car: 'Technique',
  facility: 'Installations',
}

export function InboxScreen() {
  const game = useGameState()
  const act = useGame((s) => s.act)
  const toast = useGame((s) => s.toast)
  const [filter, setFilter] = useState<'all' | 'pending' | InboxCategory>('all')
  const [sel, setSel] = useState<string | null>(game.inbox[0]?.id ?? null)
  const list = game.inbox.filter((m) => (filter === 'all' ? true : filter === 'pending' ? m.choices && !m.resolvedChoiceId : m.category === filter))
  const msg = game.inbox.find((m) => m.id === sel)

  const select = (id: string) => {
    setSel(id)
    act((s) => {
      const m = s.inbox.find((x) => x.id === id)
      if (m) m.read = true
    })
  }

  return (
    <div>
      <PageTitle
        title="Boîte de réception"
        actions={
          <>
            <Select
              value={filter}
              onChange={setFilter}
              options={[{ value: 'all', label: 'Tous les messages' }, { value: 'pending', label: 'Décisions en attente' }, ...Object.entries(CAT).map(([k, v]) => ({ value: k as InboxCategory, label: v }))]}
            />
            <Button size="sm" onClick={() => act((s) => s.inbox.forEach((m) => (m.read = true)))}>
              Tout marquer comme lu
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card pad={false} className="max-h-[70vh] overflow-y-auto">
          {list.length === 0 ? (
            <div className="p-4">
              <Empty>Aucun message.</Empty>
            </div>
          ) : (
            <ul>
              {list.map((m) => (
                <li key={m.id}>
                  <button onClick={() => select(m.id)} className={cx('w-full border-b border-ink-800 px-4 py-2.5 text-left hover:bg-ink-850', sel === m.id && 'bg-ink-850')}>
                    <div className="flex items-center gap-2">
                      {!m.read && <span className="h-2 w-2 shrink-0 rounded-full bg-magma-500" />}
                      <span className={cx('min-w-0 flex-1 truncate text-sm', !m.read && 'font-semibold')}>{m.title}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
                      <span>{formatDate(m.date)}</span>
                      <Badge tone={m.category === 'crisis' ? 'bad' : m.category === 'board' ? 'copper' : 'neutral'}>{CAT[m.category]}</Badge>
                      {m.choices && !m.resolvedChoiceId && <Badge tone="warn">décision</Badge>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          {msg ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
                <Badge tone="copper">{CAT[msg.category]}</Badge>
                {formatDate(msg.date)}
                {msg.expiresAt && !msg.resolvedChoiceId && <span>· réponse avant le {formatDate(msg.expiresAt)}</span>}
              </div>
              <h2 className="text-lg font-semibold">{msg.title}</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink-300">{msg.body}</p>
              {msg.choices && (
                <div className="flex flex-wrap gap-2 border-t border-ink-800 pt-3">
                  {msg.resolvedChoiceId ? (
                    <span className="text-sm text-ink-400">
                      {msg.resolvedChoiceId === 'expired' ? 'Sans réponse : la proposition a expiré.' : `Décision : ${msg.choices.find((c) => c.id === msg.resolvedChoiceId)?.label}`}
                    </span>
                  ) : (
                    msg.choices.map((c, i) => (
                      <Button
                        key={c.id}
                        variant={i === 0 ? 'primary' : 'secondary'}
                        onClick={() => {
                          const r = act((s) => resolveChoice(s, msg.id, c.id), { save: 'now' })
                          if (!r.ok) toast(r.reason ?? 'Impossible.', 'bad')
                          else toast('Décision enregistrée.', 'good')
                        }}
                      >
                        {c.label}
                      </Button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <Empty>Sélectionnez un message.</Empty>
          )}
        </Card>
      </div>
    </div>
  )
}
