// Génère public/sitemap.xml et public/robots.txt à partir des sets publiés de l'API.
// Lancé par « npm run build » (prebuild) : Vite copie ensuite public/ dans dist/.
// Si l'API ne répond pas (Pi en panne, tunnel changé), le build continue avec data/cards.csv (JJK-01).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "vite";

const root = join(import.meta.dirname, "..");
// Même ordre de priorité que Vite : variables du terminal (Render), puis .env.production
const { VITE_SITE_URL, VITE_API_URL } = loadEnv("production", root, "VITE_");
if (!VITE_SITE_URL) {
  throw new Error("VITE_SITE_URL manquante : voir .env.example");
}
const siteUrl = VITE_SITE_URL.replace(/\/$/, "");

// Seul set du CSV : sert de secours si l'API est injoignable
const FALLBACK_SET_CODE = "JJK-01";
const TIMEOUT_MS = 15_000;

async function getJson(path) {
  const res = await fetch(`${VITE_API_URL.replace(/\/$/, "")}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

// [{ code, ids: [...] }] pour chaque set publié
async function setsFromApi() {
  if (!VITE_API_URL) throw new Error("VITE_API_URL manquante");
  const sets = await getJson("/sets");
  return Promise.all(
    sets.map(async (set) => {
      const cards = await getJson(`/sets/${encodeURIComponent(set.code)}/cards`);
      return { code: set.code, ids: cards.map((card) => card.id) };
    }),
  );
}

function setsFromCsv() {
  // Chemin relatif au script, pas au dossier d'où on le lance
  const csv = readFileSync(join(root, "../../data/cards.csv"), "utf8");
  // L'id est la 1re colonne et n'est jamais entre guillemets : pas besoin d'un parseur CSV
  const ids = csv
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => line.split(",")[0]);
  return [{ code: FALLBACK_SET_CODE, ids }];
}

let sets;
try {
  sets = await setsFromApi();
} catch (err) {
  // Pas d'échec du build : un sitemap incomplet vaut mieux qu'un site pas déployé
  console.warn(`⚠️  API injoignable pour le sitemap (${err.message}) : secours sur data/cards.csv`);
  sets = setsFromCsv();
}

const urls = ["/"];
for (const set of sets) {
  const setPath = `/sets/${encodeURIComponent(set.code)}`;
  urls.push(setPath, ...set.ids.map((id) => `${setPath}/cards/${encodeURIComponent(id)}`));
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${siteUrl}${path}</loc></url>`).join("\n")}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

// public/ est vide dans le repo, donc absent après un git clone (sur Render)
mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public/sitemap.xml"), sitemap);
writeFileSync(join(root, "public/robots.txt"), robots);
console.log(`sitemap.xml : ${sets.length} set(s), ${urls.length} URLs (${siteUrl})`);
