import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { fetchCard } from "../api.js";
import { HOME_DESCRIPTION, HOME_TITLE, SITE_NAME } from "../config.js";

// Ancienne URL d'une fiche (/cards/:id, d'avant le multi-set, partagée sur LinkedIn) :
// on cherche le set de la carte et on redirige vers /sets/:code/cards/:id
function LegacyCardRedirect() {
  const { id } = useParams();
  const [result, setResult] = useState({ id: null, card: null, error: null });

  useEffect(() => {
    let ignore = false;
    fetchCard(id)
      .then((card) => !ignore && setResult({ id, card, error: null }))
      .catch((error) => !ignore && setResult({ id, card: null, error }));
    return () => {
      ignore = true;
    };
  }, [id]);

  const loading = result.id !== id;
  const { card, error } = result;
  const back = <Link to="/" className="back-link">← Tous les jeux</Link>;

  // Pas de canonical ici : la vraie page est celle vers laquelle on redirige
  const fallbackHead = (
    <>
      <title>{HOME_TITLE}</title>
      <meta name="description" content={HOME_DESCRIPTION} />
    </>
  );

  if (loading) return <main>{fallbackHead}<p className="status">Chargement…</p></main>;
  if (error) return <main>{fallbackHead}{back}<p className="status">Impossible de charger la carte.</p></main>;
  if (!card) {
    return (
      <main>
        <title>{`Card not found – ${SITE_NAME}`}</title>
        <meta name="robots" content="noindex" />
        {back}
        <p className="status">Carte introuvable.</p>
      </main>
    );
  }

  return <Navigate to={`/sets/${card.set_code}/cards/${card.id}`} replace />;
}

export default LegacyCardRedirect;
