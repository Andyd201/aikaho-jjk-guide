// Génère public/sitemap.xml et public/robots.txt à partir de data/cards.csv.
// Lancé par « npm run build » (prebuild) : Vite copie ensuite public/ dans dist/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "vite";

const root = join(import.meta.dirname, "..");
// Même ordre de priorité que Vite : variables du terminal (Render), puis .env.production
const { VITE_SITE_URL } = loadEnv("production", root, "VITE_");
if (!VITE_SITE_URL) {
  throw new Error("VITE_SITE_URL manquante : voir .env.example");
}
const siteUrl = VITE_SITE_URL.replace(/\/$/, "");

// Chemin relatif au script, pas au dossier d'où on le lance
const csv = readFileSync(join(root, "../../data/cards.csv"), "utf8");
// L'id est la 1re colonne et n'est jamais entre guillemets : pas besoin d'un parseur CSV
const ids = csv
  .split(/\r?\n/)
  .slice(1)
  .filter((line) => line.trim())
  .map((line) => line.split(",")[0]);

const urls = ["/", ...ids.map((id) => `/cards/${encodeURIComponent(id)}`)];
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
console.log(`sitemap.xml : ${urls.length} URLs (${siteUrl})`);
