import { Link } from "react-router";
import { formatReleaseDate } from "../format.js";
import { useT } from "../i18n.js";

// Une ligne « ticker » : code, nom, nombre de cartes, date de sortie (accueil et page d'un jeu)
function SetTicker({ set }) {
  const { t } = useT();
  const date = formatReleaseDate(set.release_date, t.dateLocale);
  const cards = t.cards(set.card_count);
  return (
    <Link
      to={`/sets/${set.code}`}
      className="set-ticker"
      aria-label={`${set.code}, ${set.name}, ${cards}${date ? `, ${t.released(date)}` : ""}`}
    >
      <span className="set-code">{set.code}</span>
      <span className="set-name">{set.name}</span>
      <span className="set-meta">
        <span className="set-count">{cards}</span>
        {date && <span className="set-date">{t.released(date)}</span>}
      </span>
      <span className="set-arrow" aria-hidden="true">→</span>
    </Link>
  );
}

export default SetTicker;
