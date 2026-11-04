import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { API_URL, fetchCard, fetchSet } from "../api.js";
import { SITE_NAME, setFallbackDescription, setFallbackTitle } from "../config.js";
import EyesightBanner from "../components/EyesightBanner.jsx";
import JsonLd from "../components/JsonLd.jsx";
import Seo from "../components/Seo.jsx";

function CardPage() {
  const { code, id } = useParams();
  const key = `${code}/${id}`;
  // On garde la clé avec le résultat : si elle ne correspond pas à l'URL, c'est que ça charge
  const [result, setResult] = useState({ key: null, card: null, set: null, error: null });

  // [code, id] : on recharge quand on passe directement d'une fiche à une autre.
  // Carte et set en parallèle : le set donne son nom aux titres
  useEffect(() => {
    let ignore = false; // évite qu'une vieille réponse écrase la fiche courante
    Promise.all([fetchCard(id), fetchSet(code)])
      .then(([card, set]) => !ignore && setResult({ key: `${code}/${id}`, card, set, error: null }))
      .catch((error) => !ignore && setResult({ key: `${code}/${id}`, card: null, set: null, error }));
    return () => {
      ignore = true;
    };
  }, [code, id]);

  const loading = result.key !== key;
  const { card, set, error } = result;

  const back = <Link to={`/sets/${code}`} className="back-link">← Retour au set</Link>;
  const path = `/sets/${code}/cards/${id}`;

  // main.jsx a enlevé les balises par défaut : sans ça, Google verrait une page sans titre
  const fallbackSeo = (
    <Seo title={setFallbackTitle(code)} description={setFallbackDescription(code)} path={path} />
  );

  if (loading) return <main>{fallbackSeo}<p className="status">Chargement…</p></main>;
  // Pas de noindex sur une erreur : si le Pi est en panne pendant que Google passe,
  // la page ne doit pas sortir de l'index
  if (error) return <main>{fallbackSeo}{back}<p className="status">Impossible de charger la carte.</p></main>;

  // La carte existe mais dans un autre set (URL mal tapée ou carte déplacée) : on corrige l'URL
  if (card && card.set_code !== code) {
    return <Navigate to={`/sets/${card.set_code}/cards/${card.id}`} replace />;
  }

  if (!card || !set) {
    return (
      <main>
        <title>{`Card not found – ${SITE_NAME}`}</title>
        <meta name="robots" content="noindex" />
        {back}
        <p className="status">Carte introuvable.</p>
      </main>
    );
  }

  const image = card.image_url ? `${API_URL}${card.image_url}` : undefined;
  const alt = `${card.name} – ${set.name} ${card.rarity} card`;
  const description =
    `${card.name} (${card.rarity}-${card.number}) from the ${set.name} trading card set: ` +
    `card image, rarity and number.`;
  // Product sans prix (offers) : pas d'extrait enrichi dans Google, mais il comprend la page
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${card.name} ${card.rarity}-${card.number}`,
    sku: card.id,
    image,
    description,
    brand: { "@type": "Brand", name: set.game_name },
    category: "Trading Cards",
    additionalProperty: [
      { "@type": "PropertyValue", name: "Set", value: set.name },
      { "@type": "PropertyValue", name: "Rarity", value: card.rarity },
      { "@type": "PropertyValue", name: "Card number", value: card.number },
    ],
  };
  // L'API renvoie le produit de la carte, sinon celui du set : le texte suit
  const ownProduct = card.product_url && card.product_url !== set.product_url;

  return (
    <main className="card-page">
      <Seo
        title={`${card.name} ${card.rarity}-${card.number} – ${set.name}`}
        description={description}
        path={path}
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
            {set.name} · n° {card.number}
          </p>
          <h1>{card.name}</h1>
          <span className="rarity">{card.rarity}</span>
          <EyesightBanner
            url={card.product_url}
            content={card.id}
            text={
              ownProduct
                ? "Procure-toi cette carte chez Eyesight"
                : `Procure-toi tes boîtes ${set.name} chez Eyesight`
            }
          />
        </div>
      </div>
    </main>
  );
}

export default CardPage;
