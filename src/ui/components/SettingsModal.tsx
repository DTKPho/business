import { useGame } from '../../store/gameStore'
import { useSettings } from '../../store/settings'
import { Modal, cx } from './ui'

function Choice<T extends string | boolean>({ value, options, onChange }: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cx('rounded-xl border px-3 py-2.5 text-left text-sm', value === o.value ? 'border-magma-500 bg-magma-500/10' : 'border-ink-700 hover:border-ink-600')}
        >
          <div className="font-medium">{o.label}</div>
          {o.hint && <div className="text-xs text-ink-400">{o.hint}</div>}
        </button>
      ))}
    </div>
  )
}

export function SettingsModal() {
  const overlay = useGame((s) => s.overlay)
  const setOverlay = useGame((s) => s.setOverlay)
  const s = useSettings()
  return (
    <Modal open={overlay === 'settings'} onClose={() => setOverlay(null)} title="Paramètres d’affichage">
      <div className="space-y-5">
        <section>
          <h4 className="mb-2 text-sm font-semibold">Ambiance</h4>
          <Choice
            value={s.theme}
            onChange={(v) => s.set({ theme: v })}
            options={[
              { value: 'light', label: '☀ Jour', hint: 'Clair et lumineux' },
              { value: 'dark', label: '☾ Nuit', hint: 'Plus sombre, reposant' },
            ]}
          />
        </section>
        <section>
          <h4 className="mb-2 text-sm font-semibold">Décors du QG</h4>
          <Choice
            value={s.scenes}
            onChange={(v) => s.set({ scenes: v })}
            options={[
              { value: true, label: 'Affichés', hint: 'Garage, bureau du conseil…' },
              { value: false, label: 'Masqués', hint: 'Fond uni' },
            ]}
          />
        </section>
        <section>
          <h4 className="mb-2 text-sm font-semibold">Animations</h4>
          <Choice
            value={s.motion}
            onChange={(v) => s.set({ motion: v })}
            options={[
              { value: true, label: 'Activées', hint: 'Décors en mouvement' },
              { value: false, label: 'Réduites', hint: 'Images fixes' },
            ]}
          />
        </section>
        <p className="text-xs text-ink-400">Ces réglages sont propres à cet appareil et ne modifient pas la sauvegarde.</p>
      </div>
    </Modal>
  )
}
