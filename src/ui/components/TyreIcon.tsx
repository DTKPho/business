import type { Compound } from '../../engine/model/types'
import { COMPOUND_COLOR, COMPOUND_LABEL } from '../../engine/race/performance'

export function TyreIcon({ c }: { c: Compound }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] bg-[#16181d] text-[9px] font-bold" style={{ borderColor: COMPOUND_COLOR[c], color: COMPOUND_COLOR[c] }} title={COMPOUND_LABEL[c]}>
      {c}
    </span>
  )
}
