import { Link } from "react-router";
import { SITE_NAME } from "../config.js";

// Barre du haut, sur toutes les pages : le logo ramène à l'accueil
function SiteHeader() {
  return (
    <div className="site-header">
      <Link to="/" className="site-logo" aria-label={`${SITE_NAME} – accueil`}>
        <span className="site-logo-mark" aria-hidden="true">外</span>
        <span>
          Foreign Card <strong>TCG</strong>
        </span>
      </Link>
    </div>
  );
}

export default SiteHeader;
