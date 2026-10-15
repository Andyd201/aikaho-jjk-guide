import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { API_URL, fetchCard } from "../api.js";
import EyesightBanner from "../components/EyesightBanner.jsx";

function CardPage() {
  const { id } = useParams();
  // On garde l'id avec le résultat : si l'id de l'URL ne correspond pas, c'est que ça charge
  const [result, setResult] = useState({ id: null, card: null, error: null });

  // [id] : on recharge quand on passe directement d'une fiche à une autre
  useEffect(() => {
    let ignore = false; // évite qu'une vieille réponse écrase la fiche courante
    fetchCard(id)
      .then((card) => !ignore && setResult({ id, card, error: null }))
      .catch((error) => !ignore && setResult({ id, card: null, error }));
    return () => {
      ignore = true;
    };
  }, [id]);

  const loading = result.id !== id;
  const { card, error } = result;

  useEffect(() => {
    if (card) {
      document.title = `${card.name} (${card.rarity}) · Aikaho JJK-01`;
    }
  }, [card]);

  const back = <Link to="/">← Retour au set</Link>;

  if (loading) return <p>Chargement…</p>;
  if (error) return <main>{back}<p>Impossible de charger la carte.</p></main>;
  if (!card) return <main>{back}<p>Carte introuvable.</p></main>;

  return (
    <main className="card-page">
      {back}
      {card.image_url && (
        <img src={`${API_URL}${card.image_url}`} alt={card.name} width={197} height={274} />
      )}
      <h1>{card.name}</h1>
      <p>
        {card.set_code} · n° {card.number} · <span className="rarity">{card.rarity}</span>
      </p>
      <EyesightBanner cardId={card.id} />
    </main>
  );
}

export default CardPage;
