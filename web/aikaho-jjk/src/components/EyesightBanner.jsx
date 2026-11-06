import { EYESIGHT_URL } from "../config.js";
import { useT } from "../i18n.js";

// Seuls les liens https vers la boutique Eyesight sont acceptés : un lien mal tapé dans /admin
// (ou autre chose qu'Eyesight) ne doit ni faire planter la page, ni envoyer ailleurs.
function shopUrl(url) {
  try {
    const link = new URL(url);
    const host = link.hostname.toLowerCase();
    if (link.protocol === "https:" && (host === "eyesightcollectibles.com" || host.endsWith(".eyesightcollectibles.com"))) {
      return link;
    }
  } catch {
    /* lien invalide : lien par défaut */
  }
  return new URL(EYESIGHT_URL);
}

// url : product_url de la carte ou du set (sinon le lien Eyesight par défaut)
// content : utm_content, dit quelle page a mené à la boutique (id de carte, code de set, « home »)
// campaign : utm_campaign, un par set (ex. jjk-01) pour comparer les sets dans WooCommerce
function EyesightBanner({ url, content, campaign = "guide", text }) {
  const { t } = useT();
  const link = shopUrl(url);
  link.searchParams.set("utm_source", "foreigncardtcg");
  link.searchParams.set("utm_medium", "banner");
  link.searchParams.set("utm_campaign", campaign.toLowerCase());
  if (content) {
    link.searchParams.set("utm_content", content);
  }

  return (
    <div className="eyesight-banner">
      <p>{text ?? t.partnerShop}</p>
      {/* nouvel onglet : le visiteur ne perd pas le guide */}
      <a href={link.toString()} target="_blank" rel="noopener">
        {t.shop}
      </a>
    </div>
  );
}

export default EyesightBanner;
