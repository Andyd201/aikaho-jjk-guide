import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { fetchSet, fetchSetCards } from "../api.js";
import {
  GAME_KANJI,
  SITE_NAME,
  SITE_URL,
  setFallbackDescription,
  setFallbackTitle,
} from "../config.js";
import CardGrid from "../components/CardGrid.jsx";
import EyesightBanner from "../components/EyesightBanner.jsx";
import JsonLd from "../components/JsonLd.jsx";
import SearchBar from "../components/SearchBar.jsx";
import RarityFilter from "../components/RarityFilter.jsx";
import Seo from "../components/Seo.jsx";
import SetAbout from "../components/SetAbout.jsx";

function SetPage() {
  const { code } = useParams();
  // On garde le code avec le résultat : s'il ne correspond pas à l'URL, c'est que ça charge
  const [result, setResult] = useState({ code: null, set: null, cards: [], error: null });

  // Les filtres vivent dans l'URL (/sets/JJK-01?q=goj&rarity=ACE,CHR) : ils survivent au retour
  // depuis une fiche et une recherche peut se partager
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const rarityParam = searchParams.get("rarity") ?? "";
  const selected = useMemo(
    () => (rarityParam ? rarityParam.split(",") : []),
    [rarityParam],
  );

  // [code] : on recharge quand on passe d'un set à un autre.
  // Set et cartes en parallèle ; si le set n'existe pas, /cards répond 404 → on l'ignore
  useEffect(() => {
    let ignore = false; // évite qu'une vieille réponse écrase le set courant
    Promise.all([fetchSet(code), fetchSetCards(code).catch(() => null)])
      .then(([set, cards]) => {
        if (ignore) return;
        if (set && !cards) throw new Error("Cartes introuvables");
        setResult({ code, set, cards: cards ?? [], error: null });
      })
      .catch((error) => !ignore && setResult({ code, set: null, cards: [], error }));
    return () => {
      ignore = true;
    };
  }, [code]);

  const loading = result.code !== code;
  const { set, cards, error } = result;

  // Ordre des chips = ordre des raretés du set ; on cache celles qui n'ont aucune carte
  const rarities = useMemo(
    () => (set ? set.rarities.filter((rarity) => rarity.card_count > 0) : []),
    [set],
  );

  const filteredCards = useMemo(
    () =>
      cards.filter(
        (card) =>
          card.name.toLowerCase().includes(q.toLowerCase()) &&
          (selected.length === 0 || selected.includes(card.rarity)),
      ),
    [cards, q, selected],
  );

  // Met à jour un paramètre ; une valeur vide l'enlève pour garder l'URL propre
  function setParam(key, value, options) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, options);
  }

  // replace : sinon chaque lettre tapée ajoute une entrée dans l'historique
  function handleSearch(value) {
    setParam("q", value, { replace: true });
  }

  function toggleRarity(rarity) {
    const next = selected.includes(rarity)
      ? selected.filter((r) => r !== rarity)
      : [...selected, rarity];
    setParam("rarity", next.join(","));
  }

  function clearFilters() {
    setSearchParams({});
  }

  const path = `/sets/${code}`;
  const back = <Link to="/" className="back-link">← Tous les sets</Link>;

  // main.jsx a enlevé les balises par défaut : sans ça, Google verrait une page sans titre
  const fallbackSeo = (
    <Seo
      title={set ? `${set.name} Card List – All Cards & Rarities` : setFallbackTitle(code)}
      description={setFallbackDescription(set ? set.name : code)}
      path={path}
    />
  );

  if (loading) return <main>{fallbackSeo}<p className="status">Chargement…</p></main>;
  // Pas de noindex sur une erreur : si le Pi est en panne pendant que Google passe,
  // la page ne doit pas sortir de l'index
  if (error) return <main>{fallbackSeo}{back}<p className="status">Impossible de charger le set.</p></main>;
  if (!set) {
    return (
      <main>
        <title>{`Set not found – ${SITE_NAME}`}</title>
        <meta name="robots" content="noindex" />
        {back}
        <p className="status">Set introuvable.</p>
      </main>
    );
  }
  // Liste vide : sinon le titre dirait « All 0 Cards » et SetAbout n'aurait aucune rareté
  if (cards.length === 0) {
    return <main>{fallbackSeo}{back}<p className="status">Aucune carte pour l'instant.</p></main>;
  }

  // Toujours sur toutes les cartes, pas sur les cartes filtrées
  const title = `${set.name} Card List – All ${cards.length} Cards & Rarities`;
  const description =
    `Complete card list for the ${set.name} set: all ${cards.length} cards with images, ` +
    `card numbers and rarities (${rarities.map((rarity) => rarity.code).join(", ")}).`;
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${set.name} card list`,
    numberOfItems: cards.length,
    itemListElement: cards.map((card, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/sets/${set.code}/cards/${card.id}`,
      name: card.name,
    })),
  };
  const kanji = GAME_KANJI[set.game_code];

  return (
    <main>
      <Seo title={title} description={description} path={path} />
      <JsonLd data={itemList} />
      <header className="hero hero-set">
        {/* Kanji du jeu, purement décoratif */}
        {kanji && <span className="hero-kanji" aria-hidden="true">{kanji}</span>}
        {back}
        <p className="eyebrow">
          {set.game_name} · Set {set.code}
        </p>
        <h1>
          {set.name} <span>Card List</span>
        </h1>
        <EyesightBanner
          url={set.product_url}
          content={set.code}
          campaign={set.code}
          text={`Procure-toi tes boîtes ${set.name} chez Eyesight`}
        />
      </header>
      <div className="filters">
        <SearchBar value={q} onChange={handleSearch} />
        <RarityFilter
          rarities={rarities.map((rarity) => rarity.code)}
          selected={selected}
          onToggle={toggleRarity}
        />
      </div>
      <p className="count">
        {filteredCards.length} {filteredCards.length > 1 ? "cartes" : "carte"}
      </p>
      {filteredCards.length === 0 ? (
        <div className="no-results">
          <p>Aucune carte ne correspond.</p>
          <button type="button" onClick={clearFilters}>
            Effacer les filtres
          </button>
        </div>
      ) : (
        <CardGrid cards={filteredCards} setName={set.name} />
      )}
      <SetAbout set={set} cardCount={cards.length} rarities={rarities} />
    </main>
  );
}

export default SetPage;
