import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { fetchSets } from "../api.js";
import { HOME_DESCRIPTION, HOME_TITLE, LEGACY_SET_CODE } from "../config.js";
import EyesightBanner from "../components/EyesightBanner.jsx";
import Seo from "../components/Seo.jsx";

// Les anciens liens filtrés pointaient sur la racine (/?q=goj&rarity=ACE) : on garde les filtres
const LEGACY_PARAMS = ["q", "rarity"];

// « 2026-09-15 » → « 15 sept. 2026 ». On ne garde que la partie date :
// pas de new Date("2026-09-15") qui recule d'un jour selon le fuseau du visiteur
const dateFormat = new Intl.DateTimeFormat("fr-CA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
function formatReleaseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!match) return null;
  const [, year, month, day] = match;
  return dateFormat.format(Date.UTC(year, month - 1, day));
}

function HomePage() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  if (LEGACY_PARAMS.some((key) => params.has(key))) {
    return <Navigate to={`/sets/${LEGACY_SET_CODE}${search}`} replace />;
  }
  return <SetList />;
}

function SetList() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // [] : on charge les sets une seule fois, au premier affichage
  useEffect(() => {
    fetchSets()
      .then((data) => setSets(data))
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, []);

  // L'API trie déjà par jeu : on regroupe en gardant cet ordre
  const games = useMemo(() => {
    const byGame = new Map();
    for (const set of sets) {
      if (!byGame.has(set.game_code)) {
        byGame.set(set.game_code, { code: set.game_code, name: set.game_name, sets: [] });
      }
      byGame.get(set.game_code).sets.push(set);
    }
    return [...byGame.values()];
  }, [sets]);

  const description =
    sets.length > 0
      ? `Complete card lists for anime trading card sets: ${sets.map((set) => set.name).join(", ")}. ` +
        "Every card with its image, card number and rarity."
      : HOME_DESCRIPTION;

  const hero = (
    <header className="hero">
      <p className="eyebrow">Eyesight Collectibles</p>
      <h1>
        Card Guide <span>Anime Trading Card Lists</span>
      </h1>
      <EyesightBanner content="home" />
    </header>
  );

  let content;
  if (loading) content = <p className="status">Chargement…</p>;
  else if (error) content = <p className="status">Impossible de charger les sets.</p>;
  else if (sets.length === 0) content = <p className="status">Aucun set pour l'instant.</p>;
  else {
    content = games.map((game) => (
      <section key={game.code} className="game" aria-labelledby={`game-${game.code}`}>
        <h2 id={`game-${game.code}`} className="game-title">
          {game.name}
          <span>
            {game.sets.length} {game.sets.length > 1 ? "sets" : "set"}
          </span>
        </h2>
        <ul className="set-list">
          {game.sets.map((set) => {
            const date = formatReleaseDate(set.release_date);
            return (
              <li key={set.code}>
                <Link to={`/sets/${set.code}`} className="set-ticker">
                  <span className="set-code">{set.code}</span>
                  <span className="set-name">{set.name}</span>
                  <span className="set-meta">
                    <span className="set-count">
                      {set.card_count} {set.card_count > 1 ? "cartes" : "carte"}
                    </span>
                    {date && <span className="set-date">Sortie {date}</span>}
                  </span>
                  <span className="set-arrow" aria-hidden="true">→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    ));
  }

  return (
    <main>
      {/* Titre fixe même pendant le chargement : jamais de page sans titre */}
      <Seo title={HOME_TITLE} description={description} path="/" />
      {hero}
      <div className="sets">{content}</div>
    </main>
  );
}

export default HomePage;
