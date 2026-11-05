import type { Effect, GameState, InboxCategory } from '../model/types'
import { nextId } from '../core/ids'
import { addDays } from '../core/time'

export interface NewMessage {
  category: InboxCategory
  title: string
  body: string
  choices?: { id: string; label: string; effects: Effect[] }[]
  expiresInDays?: number
}

export function pushMessage(state: GameState, m: NewMessage): string {
  const id = nextId(state, 'msg')
  state.inbox.unshift({
    id,
    date: state.clock.date,
    category: m.category,
    title: m.title,
    body: m.body,
    read: false,
    choices: m.choices && m.choices.length ? m.choices : undefined,
    expiresAt: m.choices && m.choices.length ? addDays(state.clock.date, m.expiresInDays ?? 28) : undefined,
  })
  if (state.inbox.length > 400) state.inbox.length = 400
  return id
}

export function unreadCount(state: GameState): number {
  return state.inbox.filter((m) => !m.read).length
}

export function pendingDecisions(state: GameState): number {
  return state.inbox.filter((m) => m.choices && !m.resolvedChoiceId).length
}
