import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { fetchCards } from "../api.js";
import CardGrid from "../components/CardGrid.jsx";
import EyesightBanner from "../components/EyesightBanner.jsx";
import SearchBar from "../components/SearchBar.jsx";
import RarityFilter from "../components/RarityFilter.jsx";

function SetPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Les filtres vivent dans l'URL (/?q=goj&rarity=ACE,CHR) : ils survivent au retour
  // depuis une fiche et une recherche peut se partager
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const rarityParam = searchParams.get("rarity") ?? "";
  const selected = useMemo(
    () => (rarityParam ? rarityParam.split(",") : []),
    [rarityParam],
  );

  // [] : on charge les cartes une seule fois, au premier affichage
  useEffect(() => {
    fetchCards()
      .then((data) => setCards(data))
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, []);

  // CardPage change le titre de l'onglet : on remet celui du set en revenant
  useEffect(() => {
    document.title = "Aikaho JJK-01 · Card Guide";
  }, []);

  // Raretés uniques des cartes chargées, triées par rang : pas besoin d'appeler /rarities
  const rarities = useMemo(() => {
    const ranks = new Map(cards.map((card) => [card.rarity, card.rarity_rank]));
    return [...ranks.keys()].sort((a, b) => ranks.get(a) - ranks.get(b));
  }, [cards]);

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

  if (loading) return <main><p className="status">Chargement…</p></main>;
  if (error) return <main><p className="status">Impossible de charger les cartes.</p></main>;

  return (
    <main>
      <header className="hero">
        {/* « Jujutsu Kaisen » en kanji, purement décoratif */}
        <span className="hero-kanji" aria-hidden="true">呪術廻戦</span>
        <p className="eyebrow">Aikaho · Set JJK-01</p>
        <h1>
          Card Guide <span>Jujutsu Kaisen</span>
        </h1>
        <EyesightBanner />
      </header>
      <div className="filters">
        <SearchBar value={q} onChange={handleSearch} />
        <RarityFilter rarities={rarities} selected={selected} onToggle={toggleRarity} />
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
        <CardGrid cards={filteredCards} />
      )}
    </main>
  );
}

export default SetPage;
