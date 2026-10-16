import { SITE_NAME, SITE_URL } from "../config.js";

// React 19 remonte tout seul <title>, <meta> et <link> dans le <head>
// path : chemin de la page sans query string (/?q=goj et / ont la même canonical)
function Seo({ title, description, path, image }) {
  const url = `${SITE_URL}${path}`;
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* Aperçus Discord, Facebook, LinkedIn */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      {image && <meta property="og:image" content={image} />}

      <meta name="twitter:card" content={image ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}
    </>
  );
}

export default Seo;
