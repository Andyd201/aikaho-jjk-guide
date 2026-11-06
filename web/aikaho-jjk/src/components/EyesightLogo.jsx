import { EYESIGHT_URL } from "../config.js";

// Logo d'Eyesight Collectibles (badge rond + nom), comme sur eyesightcollectibles.com (Poppins gras, majuscules).
// Mène toujours à l'accueil de la boutique ; content : d'où vient le clic (utm_content)
function EyesightLogo({ content = "logo", small = false }) {
  const link = new URL(EYESIGHT_URL);
  link.searchParams.set("utm_source", "foreigncardtcg");
  link.searchParams.set("utm_medium", "logo");
  link.searchParams.set("utm_content", content);

  return (
    <a
      href={link.toString()}
      className={`eyesight-logo${small ? " eyesight-logo-small" : ""}`}
      target="_blank"
      rel="noopener"
      aria-label="Eyesight Collectibles"
    >
      <img src="/eyesight-logo.webp" alt="" width="150" height="150" className="eyesight-logo-badge" />
      <span>
        Eyesight
        <br />
        Collectibles
      </span>
    </a>
  );
}

export default EyesightLogo;
