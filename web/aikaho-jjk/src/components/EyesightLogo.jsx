import { EYESIGHT_URL } from "../config.js";

// Logo texte d'Eyesight Collectibles, comme sur eyesightcollectibles.com (Poppins gras, majuscules).
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
      Eyesight
      <br />
      Collectibles
    </a>
  );
}

export default EyesightLogo;
