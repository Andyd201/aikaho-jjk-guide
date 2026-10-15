// Contrôlé : la valeur vient du parent (l'URL), pas d'un état local
function SearchBar({ value, onChange }) {
  return (
    <input
      type="search"
      className="search-bar"
      placeholder="Rechercher un personnage…"
      aria-label="Rechercher un personnage"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default SearchBar;
