import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { API_URL, fetchCard } from "../api.js";
import { SET_DESCRIPTION, SET_NAME, SET_TITLE } from "../config.js";
import EyesightBanner from "../components/EyesightBanner.jsx";
import JsonLd from "../components/JsonLd.jsx";
import Seo from "../components/Seo.jsx";

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

  const back = <Link to="/" className="back-link">← Retour au set</Link>;

  // main.jsx a enlevé les balises par défaut : sans ça, Google verrait une page sans titre
  const fallbackSeo = <Seo title={SET_TITLE} description={SET_DESCRIPTION} path={`/cards/${id}`} />;

  if (loading) return <main>{fallbackSeo}<p className="status">Chargement…</p></main>;
  // Pas de noindex sur une erreur : si le Pi est en panne pendant que Google passe,
  // la page ne doit pas sortir de l'index
  if (error) return <main>{fallbackSeo}{back}<p className="status">Impossible de charger la carte.</p></main>;
  if (!card) {
    return (
      <main>
        <title>{`Card not found – ${SET_NAME}`}</title>
        <meta name="robots" content="noindex" />
        {back}
        <p className="status">Carte introuvable.</p>
      </main>
    );
  }

  const image = card.image_url ? `${API_URL}${card.image_url}` : undefined;
  const alt = `${card.name} – ${SET_NAME} ${card.rarity} card`;
  const description =
    `${card.name} (${card.rarity}-${card.number}) from the ${SET_NAME} trading card set: ` +
    `card image, rarity and number.`;
  // Product sans prix (offers) : pas d'extrait enrichi dans Google, mais il comprend la page
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${card.name} ${card.rarity}-${card.number}`,
    sku: card.id,
    image,
    description,
    brand: { "@type": "Brand", name: "Aikaho" },
    category: "Trading Cards",
    additionalProperty: [
      { "@type": "PropertyValue", name: "Set", value: card.set_code },
      { "@type": "PropertyValue", name: "Rarity", value: card.rarity },
      { "@type": "PropertyValue", name: "Card number", value: card.number },
    ],
  };

  return (
    <main className="card-page">
      <Seo
        title={`${card.name} ${card.rarity}-${card.number} – ${SET_NAME}`}
        description={description}
        path={`/cards/${card.id}`}
        image={image}
      />
      <JsonLd data={product} />
      {back}
      <div className="card-detail" data-rarity={card.rarity}>
        <div className="card-art">
          {image && <img src={image} alt={alt} width={197} height={274} />}
        </div>
        <div className="card-info">
          <p className="eyebrow">
            {card.set_code} · n° {card.number}
          </p>
          <h1>{card.name}</h1>
          <span className="rarity">{card.rarity}</span>
          <EyesightBanner cardId={card.id} />
        </div>
      </div>
    </main>
  );
}

export default CardPage;
