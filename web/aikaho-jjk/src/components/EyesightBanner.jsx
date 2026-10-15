import { EYESIGHT_URL } from "../config.js";

// cardId optionnel : sur une fiche, utm_content dit quelle carte a mené à la boutique
function EyesightBanner({ cardId }) {
  const url = new URL(EYESIGHT_URL);
  url.searchParams.set("utm_source", "guide-jjk");
  url.searchParams.set("utm_medium", "banner");
  url.searchParams.set("utm_campaign", "aikaho-jjk01");
  if (cardId) {
    url.searchParams.set("utm_content", cardId);
  }

  return (
    <div className="eyesight-banner">
      <p>Procure-toi tes boîtes Aikaho JJK chez Eyesight</p>
      {/* nouvel onglet : le visiteur ne perd pas le guide */}
      <a href={url.toString()} target="_blank" rel="noopener">
        Voir la boutique →
      </a>
    </div>
  );
}

export default EyesightBanner;
