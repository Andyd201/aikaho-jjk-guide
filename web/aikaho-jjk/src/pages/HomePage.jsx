import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import SetTicker from "../components/SetTicker.jsx";
import { fetchSets } from "../api.js";
import { HOME_DESCRIPTION, HOME_TITLE, LEGACY_SET_CODE } from "../config.js";
import EyesightBanner from "../components/EyesightBanner.jsx";
import Seo from "../components/Seo.jsx";

// Les anciens liens filtrés pointaient sur la racine (/?q=goj&rarity=ACE) : on garde les filtres
const LEGACY_PARAMS = ["q", "rarity"];

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
      ? `Card lists for Asian trading card games: ${sets.map((set) => set.name).join(", ")}. ` +
        "Every card with its image, card number and rarity."
      : HOME_DESCRIPTION;

  const hero = (
    <header className="hero">
      <p className="eyebrow">Base de cartes</p>
      <h1>
        Cartes TCG asiatiques <span>Japon · Corée · Chine</span>
      </h1>
      <p className="hero-lead">
        Toutes les cartes des sets japonais, coréens et chinois : images, numéros et raretés, set par set.
      </p>
      <EyesightBanner content="home" text="Boutique partenaire : Eyesight Collectibles" />
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
          <Link to={`/games/${game.code}`}>{game.name}</Link>
          <span>
            {game.sets.length} {game.sets.length > 1 ? "sets" : "set"}
          </span>
        </h2>
        <ul className="set-list">
          {game.sets.map((set) => (
            <li key={set.code}>
              <SetTicker set={set} />
            </li>
          ))}
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
