// Données structurées schema.org lues par Google.
// < échappé : un nom de carte avec « </script> » ne peut pas fermer la balise
function JsonLd({ data }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export default JsonLd;
