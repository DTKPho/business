import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../store/gameStore'
import { deleteSlot, lastSlot, listSlots, loadSlot } from '../../persistence/idb'
import type { SlotMeta } from '../../persistence/idb'
import { exportToFile, importFromFile } from '../../persistence/exportImport'
import { Button, Card, Empty } from '../components/ui'
import { formatDate } from '../../engine/core/time'
import { fmtEur } from '../../engine/core/money'

export function HomeScreen() {
  const newGame = useGame((s) => s.newGame)
  const loadGame = useGame((s) => s.loadGame)
  const adoptGame = useGame((s) => s.adoptGame)
  const toast = useGame((s) => s.toast)
  const [slots, setSlots] = useState<SlotMeta[] | null>(null)
  const [name, setName] = useState('Carrière Genesis')
  const [seed, setSeed] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const last = lastSlot()

  const refresh = () =>
    listSlots()
      .then(setSlots)
      .catch((e) => {
        setSlots([])
        toast(`IndexedDB indisponible : ${(e as Error).message}`, 'bad')
      })
  useEffect(() => {
    void refresh()
  }, [])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#2a1208_0%,_#0b0b0d_55%)]">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
        <div className="mb-10 flex items-center gap-4">
          <img src="./favicon.svg" alt="" className="h-14 w-14" />
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">GENESIS MAGMA F1 TEAM</h1>
            <p className="text-sm tracking-[0.25em] text-copper-400">JEU DE GESTION · BRACKLEY · DEPUIS 2027</p>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
          <Card title="Parties sauvegardées">
            {slots === null ? (
              <p className="text-sm text-ink-400">Chargement…</p>
            ) : slots.length === 0 ? (
              <Empty>Aucune sauvegarde. Lancez une nouvelle carrière !</Empty>
            ) : (
              <ul className="space-y-2">
                {slots.map((s) => (
                  <li key={s.id} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {s.name} {s.id === last && <span className="ml-1 text-[11px] text-magma-400">dernière partie</span>}
                        </div>
                        <div className="text-xs text-ink-400">
                          Saison {s.season} · {formatDate(s.date)} · P{s.position} constructeurs · {fmtEur(s.cashEur)}
                        </div>
                        <div className="text-[11px] text-ink-600">Enregistrée le {new Date(s.updatedAt).toLocaleString('fr-FR')}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => loadGame(s.id))}>
                          Reprendre
                        </Button>
                        <Button size="sm" disabled={busy} onClick={() => run(async () => exportToFile(await loadSlot(s.id)))}>
                          Exporter
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() =>
                            confirm(`Supprimer définitivement « ${s.name} » ?`) &&
                            run(async () => {
                              await deleteSlot(s.id)
                              await refresh()
                            })
                          }
                        >
                          Suppr.
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex gap-2">
              <Button onClick={() => fileRef.current?.click()} disabled={busy}>
                Importer un fichier JSON…
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void run(async () => adoptGame(await importFromFile(file)))
                }}
              />
            </div>
          </Card>
          <Card title="Nouvelle carrière">
            <div className="space-y-4 text-sm">
              <p className="text-ink-300">
                Vous êtes <strong>Liam Robert</strong>, 42 ans, Executive Chairman &amp; CEO de Genesis Magma F1 Team, l'écurie de Hyundai Motor Group qui remplace Haas sur la grille 2027. Recrutez vos pilotes et votre encadrement, développez la voiture et
                convainquez Hyundai, RedBird et Arctos.
              </p>
              <label className="block">
                <span className="text-xs text-ink-400">Nom de la sauvegarde</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 outline-none focus:border-copper-400" />
              </label>
              <label className="block">
                <span className="text-xs text-ink-400">Graine aléatoire (facultatif — même graine = même partie)</span>
                <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="aléatoire" className="mt-1 w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 outline-none focus:border-copper-400" />
              </label>
              <Button variant="primary" className="w-full" disabled={busy} onClick={() => run(() => newGame(name, seed))}>
                Lancer la carrière
              </Button>
              <p className="text-[11px] text-ink-600">Données de pilotes et staff réelles, statistiques estimées et non officielles. Usage personnel.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
