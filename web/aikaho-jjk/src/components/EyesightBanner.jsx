import { EYESIGHT_URL } from "../config.js";

// url : product_url de la carte ou du set (sinon le lien Eyesight par défaut)
// content : utm_content, dit quelle page a mené à la boutique (id de carte, code de set, « home »)
function EyesightBanner({ url, content, text = "Procure-toi tes cartes chez Eyesight" }) {
  const link = new URL(url || EYESIGHT_URL);
  link.searchParams.set("utm_source", "guide-jjk");
  link.searchParams.set("utm_medium", "banner");
  link.searchParams.set("utm_campaign", "aikaho-jjk01");
  if (content) {
    link.searchParams.set("utm_content", content);
  }

  return (
    <div className="eyesight-banner">
      <p>{text}</p>
      {/* nouvel onglet : le visiteur ne perd pas le guide */}
      <a href={link.toString()} target="_blank" rel="noopener">
        Voir la boutique →
      </a>
    </div>
  );
}

export default EyesightBanner;
