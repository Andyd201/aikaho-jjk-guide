import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { fetchSets } from "../api.js";
import { SITE_NAME, gameFallbackTitle, gameKanji } from "../config.js";
import EyesightBanner from "../components/EyesightBanner.jsx";
import Seo from "../components/Seo.jsx";
import SetTicker from "../components/SetTicker.jsx";

// Un jeu (ex. Demon Slayer) et tous ses sets publiés
function GamePage() {
  const { code } = useParams();
  // On garde le code avec le résultat : s'il ne correspond pas à l'URL, c'est que ça charge
  const [result, setResult] = useState({ code: null, sets: [], error: null });

  useEffect(() => {
    let ignore = false; // évite qu'une vieille réponse écrase le jeu courant
    fetchSets(code)
      .then((sets) => !ignore && setResult({ code, sets, error: null }))
      .catch((error) => !ignore && setResult({ code, sets: [], error }));
    return () => {
      ignore = true;
    };
  }, [code]);

  const loading = result.code !== code;
  const { sets, error } = result;
  const path = `/games/${code}`;
  const back = <Link to="/" className="back-link">← Tous les jeux</Link>;
  const fallbackSeo = (
    <Seo title={gameFallbackTitle(code)} description={`Card lists for every ${code} set.`} path={path} />
  );

  if (loading) return <main>{fallbackSeo}<p className="status">Chargement…</p></main>;
  if (error) return <main>{fallbackSeo}{back}<p className="status">Impossible de charger le jeu.</p></main>;
  // Aucun set publié : jeu inconnu (ou seulement des sets en brouillon)
  if (sets.length === 0) {
    return (
      <main>
        <title>{`Game not found – ${SITE_NAME}`}</title>
        <meta name="robots" content="noindex" />
        {back}
        <p className="status">Jeu introuvable.</p>
      </main>
    );
  }

  const gameName = sets[0].game_name;
  const cardCount = sets.reduce((total, set) => total + set.card_count, 0);
  const kanji = gameKanji(gameName);

  return (
    <main>
      <Seo
        title={`${gameName} Card Lists – All Sets & Rarities | ${SITE_NAME}`}
        description={
          `Complete card lists for ${gameName}: ${sets.map((set) => set.code).join(", ")}. ` +
          `${cardCount} cards with images, card numbers and rarities.`
        }
        path={path}
      />
      <header className="hero hero-set">
        {kanji && <span className="hero-kanji" aria-hidden="true">{kanji}</span>}
        {back}
        <p className="eyebrow">Jeu</p>
        <h1>
          {gameName} <span>{sets.length} {sets.length > 1 ? "sets" : "set"} · {cardCount} cartes</span>
        </h1>
        <EyesightBanner content={code} campaign={code} text={`Procure-toi du ${gameName} chez Eyesight`} />
      </header>
      <ul className="set-list">
        {sets.map((set) => (
          <li key={set.code}>
            <SetTicker set={set} />
          </li>
        ))}
      </ul>
    </main>
  );
}

export default GamePage;
