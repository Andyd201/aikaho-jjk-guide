function RarityFilter({ rarities, selected, onToggle }) {
  return (
    <div className="rarity-filter" role="group" aria-label="Filtrer par rareté">
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
