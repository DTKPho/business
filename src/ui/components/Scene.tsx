import { useSettings } from '../../store/settings'
import scenes from '../../data/scenes.json'

export const SCENES = scenes as { screens: Record<string, string>; facilities: Record<string, string> }

export function sceneUrl(key: string): string | undefined {
  const p = SCENES.screens[key]
  return p ? `./${p}` : undefined
}

export function facilityImage(id: string): string | undefined {
  const p = SCENES.facilities[id]
  return p ? `./${p}` : undefined
}

/** Décor flou et animé du QG, derrière tout le contenu de l'onglet. */
export function SceneBackdrop({ scene }: { scene: string }) {
  const { scenes: enabled, motion } = useSettings()
  const url = sceneUrl(scene)
  if (!enabled || !url) return <div className="scene-overlay" />
  return (
    <>
      <div key={url} className={`scene-layer ${motion ? 'scene-animate' : ''}`} style={{ backgroundImage: `url("${url}")` }} />
      <div className="scene-overlay" />
    </>
  )
}
