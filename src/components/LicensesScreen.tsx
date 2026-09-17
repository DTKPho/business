import { PLAYABLE_STATE_IDS } from '../data/cities';
import { US_STATE_PATHS } from '../data/usStatePaths';
import { GOOD_CATEGORY_LABELS, type GoodCategory } from '../data/goods';
import { GANGS } from '../data/gangs';
import { useGameStore } from '../game/store';
import { licenseCost, hasLicense, CATEGORY_MIN_TIER, MIN_REPUTATION_TO_LICENSE } from '../game/licenses';
import { concessionBribeCost, hasConcession, CONCESSION_MIN_TIER } from '../game/concessions';
import { formatMoney } from '../game/format';

const stateNameById = Object.fromEntries(US_STATE_PATHS.map((s) => [s.id, s.name]));
const LICENSABLE_CATEGORIES: GoodCategory[] = ['agricole', 'matieres_premieres', 'manufacture', 'luxe'];

export function LicensesScreen() {
  const licenses = useGameStore((s) => s.licenses);
  const concessions = useGameStore((s) => s.concessions);
  const reputation = useGameStore((s) => s.reputation);
  const corruption = useGameStore((s) => s.corruption);
  const gangProtection = useGameStore((s) => s.gangProtection);
  const charterTier = useGameStore((s) => s.charterTier);
  const buyLicense = useGameStore((s) => s.buyLicense);
  const negotiateConcession = useGameStore((s) => s.negotiateConcession);
  const setCorruption = useGameStore((s) => s.setCorruption);
  const toggleGangProtection = useGameStore((s) => s.toggleGangProtection);

  return (
    <div className="screen">
      <p className="screen-intro">
        Chaque État exige une licence par catégorie de biens pour percevoir une commission légale. L'alcool n'est
        jamais officiellement licenciable : vous opérez toujours au noir sur ce commerce, avec une marge plus
        élevée mais un risque de raid. La corruption réduit la taxe d'État sur vos revenus, au prix d'un risque
        d'audit fédéral.
      </p>

      <div className="card-grid">
        {PLAYABLE_STATE_IDS.map((stateId) => {
          const rep = Math.round(reputation[stateId] ?? 50);
          const corr = corruption[stateId] ?? 0;
          return (
            <div key={stateId} className="state-card">
              <h3>
                {stateNameById[stateId] ?? stateId}
                <span className="rep-value">Réputation {rep}/100</span>
              </h3>

              {LICENSABLE_CATEGORIES.map((category) => {
                const owned = hasLicense(licenses, stateId, category);
                const locked = charterTier < CATEGORY_MIN_TIER[category];
                const repTooLow = rep < MIN_REPUTATION_TO_LICENSE;
                const cost = licenseCost(stateId, category);
                return (
                  <div className="license-row" key={category}>
                    <span>{GOOD_CATEGORY_LABELS[category]}</span>
                    {owned ? (
                      <span className="tag owned">Détenue</span>
                    ) : locked ? (
                      <span className="tag locked" title="Charte insuffisante">Verrouillée</span>
                    ) : (
                      <button type="button" disabled={repTooLow} onClick={() => buyLicense(stateId, category)}>
                        {repTooLow ? 'Réputation insuffisante' : `Acheter (${formatMoney(cost)})`}
                      </button>
                    )}
                  </div>
                );
              })}
              <div className="license-row">
                <span>Alcool</span>
                <span className="tag contraband">Toujours contrebande</span>
              </div>

              <div className="corruption-control">
                <label htmlFor={`corr-${stateId}`}>
                  <span>Corruption locale</span>
                  <span>{corr}/100</span>
                </label>
                <input
                  id={`corr-${stateId}`}
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={corr}
                  onChange={(e) => setCorruption(stateId, Number(e.target.value))}
                />
              </div>

              <h3 style={{ fontSize: 13, marginTop: 14 }}>Concessions exclusives</h3>
              {charterTier < CONCESSION_MIN_TIER ? (
                <p className="hint">Nécessite une Charte d'État.</p>
              ) : (
                LICENSABLE_CATEGORIES.map((category) => {
                  const owned = hasConcession(concessions, stateId, category);
                  const cost = concessionBribeCost(stateId, category);
                  return (
                    <div className="license-row" key={`conc-${category}`}>
                      <span>{GOOD_CATEGORY_LABELS[category]}</span>
                      {owned ? (
                        <span className="tag owned">Exclusive</span>
                      ) : (
                        <button type="button" onClick={() => negotiateConcession(stateId, category)}>
                          Négocier ({formatMoney(cost)})
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      <h3 style={{ color: 'var(--parchment)', marginTop: 24 }}>Gangs & protection</h3>
      <div className="card-grid">
        {GANGS.map((gang) => {
          const paying = gangProtection[gang.id];
          return (
            <div key={gang.id} className="state-card">
              <h3 style={{ fontSize: 14 }}>{gang.name}</h3>
              <p className="panel-subtitle">Territoire : {gang.territoryStateIds.map((id) => stateNameById[id] ?? id).join(', ')}</p>
              <div className="gang-row">
                <span>Protection régulière ({formatMoney(gang.protectionCost)}/tick)</span>
                <button type="button" onClick={() => toggleGangProtection(gang.id)}>
                  {paying ? 'Annuler' : 'Payer'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
