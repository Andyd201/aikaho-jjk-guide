import { useEffect, useState } from "react";
import { fetchCards } from "../api.js";
import CardGrid from "../components/CardGrid.jsx";
import EyesightBanner from "../components/EyesightBanner.jsx";

function SetPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) return <p>Chargement…</p>;
  if (error) return <p>Impossible de charger les cartes.</p>;

  return (
    <main>
      <h1>Aikaho JJK-01 · Card Guide</h1>
      <EyesightBanner />
      <p>{cards.length} cartes</p>
      <CardGrid cards={cards} />
    </main>
  );
}

export default SetPage;
