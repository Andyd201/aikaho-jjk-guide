import { useT } from "../i18n.js";

function RarityFilter({ rarities, selected, onToggle }) {
  const { t } = useT();
  return (
    <div className="rarity-filter" role="group" aria-label={t.rarityFilterLabel}>
      {rarities.map((rarity) => (
        <button
          key={rarity}
          type="button"
          aria-pressed={selected.includes(rarity)}
          onClick={() => onToggle(rarity)}
        >
          {rarity}
        </button>
      ))}
    </div>
  );
}

export default RarityFilter;
