// Contrôlé : la valeur vient du parent (l'URL), pas d'un état local
import { useT } from "../i18n.js";

function SearchBar({ value, onChange }) {
  const { t } = useT();
  return (
    <input
      type="search"
      className="search-bar"
      placeholder={t.searchPlaceholder}
      aria-label={t.searchLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default SearchBar;
