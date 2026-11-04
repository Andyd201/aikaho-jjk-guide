export const API_URL = import.meta.env.VITE_API_URL;

// notFoundAsNull : un 404 (set ou carte inexistant) est un résultat normal, pas une panne
async function getJson(path, { notFoundAsNull = false } = {}) {
  const res = await fetch(`${API_URL}${path}`);

  if (notFoundAsNull && res.status === 404) {
    return null;
  }

  // fetch ne lance une erreur que si le réseau est coupé : un 500 de l'API passe quand même
  if (!res.ok) {
    throw new Error(`Erreur API : ${res.status}`);
  }

  return res.json();
}

// Sets publiés, déjà triés par jeu par l'API
export function fetchSets() {
  return getJson("/sets");
}

// Un set + ses raretés dans l'ordre ; null si inexistant ou en brouillon
export function fetchSet(code) {
  return getJson(`/sets/${encodeURIComponent(code)}`, { notFoundAsNull: true });
}

// Toutes les cartes du set : la recherche et les filtres se font côté front
export function fetchSetCards(code) {
  return getJson(`/sets/${encodeURIComponent(code)}/cards`);
}

export function fetchCard(id) {
  return getJson(`/cards/${encodeURIComponent(id)}`, { notFoundAsNull: true });
}
