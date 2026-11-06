import { Link } from "react-router";
import { formatReleaseDate } from "../format.js";

// Une ligne « ticker » : code, nom, nombre de cartes, date de sortie (accueil et page d'un jeu)
function SetTicker({ set }) {
  const date = formatReleaseDate(set.release_date);
  const cards = `${set.card_count} ${set.card_count > 1 ? "cartes" : "carte"}`;
  return (
    <Link
      to={`/sets/${set.code}`}
      className="set-ticker"
      aria-label={`${set.code}, ${set.name}, ${cards}${date ? `, sortie ${date}` : ""}`}
    >
      <span className="set-code">{set.code}</span>
      <span className="set-name">{set.name}</span>
      <span className="set-meta">
        <span className="set-count">{cards}</span>
        {date && <span className="set-date">Sortie {date}</span>}
      </span>
      <span className="set-arrow" aria-hidden="true">→</span>
    </Link>
  );
}

export default SetTicker;
