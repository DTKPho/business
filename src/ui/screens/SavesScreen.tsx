import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../store/gameStore'
import { useGameState } from '../hooks'
import { Button, Card, PageTitle } from '../components/ui'
import { deleteSlot, listSlots, saveSlot, newSlotId } from '../../persistence/idb'
import type { SlotMeta } from '../../persistence/idb'
import { exportToFile, importFromFile } from '../../persistence/exportImport'
import { formatDate } from '../../engine/core/time'

export function SavesScreen() {
  const game = useGameState()
  const slotId = useGame((s) => s.slotId)
  const saveNow = useGame((s) => s.saveNow)
  const loadGame = useGame((s) => s.loadGame)
  const adoptGame = useGame((s) => s.adoptGame)
  const quit = useGame((s) => s.quit)
  const act = useGame((s) => s.act)
  const toast = useGame((s) => s.toast)
  const lastSavedAt = useGame((s) => s.lastSavedAt)
  const [slots, setSlots] = useState<SlotMeta[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const refresh = () => listSlots().then(setSlots)
  useEffect(() => {
    void refresh()
  }, [lastSavedAt])

  const wrap = async (fn: () => Promise<void>, ok?: string) => {
    try {
      await fn()
      if (ok) toast(ok, 'good')
      await refresh()
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  }

  return (
    <div className="space-y-5">
      <PageTitle title="Sauvegardes" sub="Sauvegarde automatique dans le navigateur (IndexedDB) après chaque action importante." />
      <Card title="Partie en cours">
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="block">
            <span className="text-xs text-ink-400">Nom</span>
            <input
              value={game.meta.saveName}
              onChange={(e) =>
                act((s) => {
                  s.meta.saveName = e.target.value
                })
              }
              className="mt-1 block rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 outline-none focus:border-copper-400"
            />
          </label>
          <Button variant="primary" onClick={() => wrap(saveNow, 'Partie sauvegardée.')}>
            Sauvegarder maintenant
          </Button>
          <Button onClick={() => wrap(async () => saveSlot(newSlotId(), { ...structuredClone(game), meta: { ...game.meta, saveName: `${game.meta.saveName} (copie)` } }), 'Copie créée dans un nouvel emplacement.')}>
            Dupliquer dans un nouvel emplacement
          </Button>
          <Button onClick={() => exportToFile(game)}>Exporter en JSON</Button>
          <Button onClick={() => fileRef.current?.click()}>Importer un JSON…</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void wrap(async () => adoptGame(await importFromFile(file)), 'Sauvegarde importée.')
            }}
          />
          <Button variant="ghost" onClick={quit}>
            Retour au menu
          </Button>
        </div>
        <p className="mt-3 text-xs text-ink-400">
          Graine : <span className="font-mono">{game.meta.seed}</span> · dernière sauvegarde : {lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString('fr-FR') : '—'}
        </p>
      </Card>
      <Card title="Emplacements">
        <ul className="space-y-2">
          {slots.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm">
              <div>
                <div className="font-medium">
                  {s.name} {s.id === slotId && <span className="ml-1 text-[11px] text-magma-400">en cours</span>}
                </div>
                <div className="text-xs text-ink-400">
                  Saison {s.season} · {formatDate(s.date)} · enregistrée le {new Date(s.updatedAt).toLocaleString('fr-FR')}
                </div>
              </div>
              {s.id !== slotId && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => wrap(() => loadGame(s.id), 'Partie chargée.')}>
                    Charger
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => confirm(`Supprimer « ${s.name} » ?`) && wrap(() => deleteSlot(s.id), 'Emplacement supprimé.')}>
                    Supprimer
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
