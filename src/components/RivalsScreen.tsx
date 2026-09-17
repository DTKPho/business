import { useGameStore } from '../game/store';
import { isRivalWeakened, partialStakeCost, fullBuyoutCost } from '../game/rivals';
import { formatMoney } from '../game/format';

const BEHAVIOR_LABELS: Record<string, string> = {
  agressif: 'Agressif — casse les prix',
  opportuniste: 'Opportuniste — vise les routes rentables',
  defensif: 'Défensif — consolide prudemment',
};

export function RivalsScreen() {
  const rivals = useGameStore((s) => s.rivals);
  const charterTier = useGameStore((s) => s.charterTier);
  const buyPartialStake = useGameStore((s) => s.buyPartialStake);
  const buyFullRival = useGameStore((s) => s.buyFullRival);

  const canBuyout = charterTier >= 3;

  return (
    <div className="screen">
      <p className="screen-intro">
        {canBuyout
          ? "Rachetez des parts d'un rival affaibli (moins de 1 200 $ de capital) à prix réduit, ou proposez un rachat amiable à tout moment — plus cher, mais sans guerre commerciale."
          : "Une Charte d'État (palier 3) est requise pour racheter des parts de vos concurrents."}
      </p>

      <div className="card-grid">
        {rivals.map((rival) => {
          const weakened = isRivalWeakened(rival);
          const activeRoutes = rival.routes.length;
          return (
            <div key={rival.id} className={rival.defeated ? 'rival-card defeated' : 'rival-card'}>
              <h3>
                <span className="rival-color-dot" style={{ background: rival.color }} />
                {rival.name}
              </h3>
              <p className="behavior">{BEHAVIOR_LABELS[rival.behavior]}</p>

              <dl className="stat-grid">
                <dt>Capital estimé</dt>
                <dd>{rival.defeated ? '—' : formatMoney(rival.capital)}</dd>
                <dt>Routes actives</dt>
                <dd>{rival.defeated ? 0 : activeRoutes}</dd>
                <dt>Votre part</dt>
                <dd>{Math.round(rival.playerStake * 100)}%</dd>
                {weakened && !rival.defeated && (
                  <>
                    <dt>Statut</dt>
                    <dd style={{ color: 'var(--danger)' }}>Affaibli</dd>
                  </>
                )}
              </dl>

              {!rival.defeated && canBuyout && (
                <div className="rival-actions">
                  <button type="button" onClick={() => buyPartialStake(rival.id, 0.25)}>
                    Racheter 25% ({formatMoney(partialStakeCost(rival, 0.25))})
                  </button>
                  <button type="button" disabled={!weakened} onClick={() => buyFullRival(rival.id, false)}>
                    {weakened ? `Rachat forcé (${formatMoney(fullBuyoutCost(rival, false))})` : 'Trop solide pour un rachat forcé'}
                  </button>
                  <button type="button" onClick={() => buyFullRival(rival.id, true)}>
                    Rachat amiable ({formatMoney(fullBuyoutCost(rival, true))})
                  </button>
                </div>
              )}
              {rival.defeated && <p className="hint">Absorbé dans votre empire commercial.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
