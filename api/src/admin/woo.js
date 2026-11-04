// Recherche des produits Eyesight (WooCommerce REST API, clé en lecture seule).
// Variables (.env) : WOO_URL (https://eyesightcollectibles.com), WOO_KEY (ck_…), WOO_SECRET (cs_…)

export function wooConfigured() {
  return Boolean(process.env.WOO_URL && process.env.WOO_KEY && process.env.WOO_SECRET);
}

export async function searchProducts(query) {
  const base = process.env.WOO_URL.replace(/\/$/, "");
  const url = new URL(`${base}/wp-json/wc/v3/products`);
  url.searchParams.set("search", query);
  url.searchParams.set("status", "publish");
  url.searchParams.set("per_page", "50");

  const auth = Buffer.from(`${process.env.WOO_KEY}:${process.env.WOO_SECRET}`).toString("base64");
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`WooCommerce a répondu ${res.status}`);
  const products = await res.json();
  return products.map((p) => ({ id: p.id, name: p.name, url: p.permalink, stock_status: p.stock_status }));
}

// Comparaison sans casse, sans espaces ni tirets : « SSR-012 », « SSR 012 » et « ssr012 » sont égaux
const squash = (text) => text.toUpperCase().replace(/[\s_-]+/g, "");

// Choisit le produit d'une carte parmi les résultats de recherche.
// - candidats = produits dont le nom contient le code (rareté + numéro)
// - choix automatique SEULEMENT si un seul candidat mentionne aussi le set (JJK-01, JJK01)
//   ou le jeu (un mot de 4 lettres et plus du nom du jeu, ex. « Jujutsu ») : sinon un « SR-001 »
//   d'un autre jeu pourrait être choisi. Les autres cas sont proposés dans /admin.
export function matchProduct(products, { rarity, number, setCode, gameName = "" }) {
  const escaped = rarity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Le code ne doit pas être collé à d'autres lettres/chiffres (SR-012 ≠ SSR-012, SSR-0123)
  const codePattern = new RegExp(`(^|[^A-Z0-9])${escaped}[\\s_-]*${number}($|[^0-9])`, "i");
  const candidates = products.filter((p) => codePattern.test(p.name));

  const keys = [squash(setCode), ...gameName.split(/\s+/).filter((w) => w.length >= 4).map(squash)];
  const inContext = candidates.filter((p) => keys.some((key) => squash(p.name).includes(key)));
  const inSet = inContext.filter((p) => squash(p.name).includes(squash(setCode)));

  const match = inSet.length === 1 ? inSet[0] : inSet.length === 0 && inContext.length === 1 ? inContext[0] : null;
  return { match, candidates: inSet.length ? inSet : inContext.length ? inContext : candidates };
}
