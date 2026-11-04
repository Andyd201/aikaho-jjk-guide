import express, { Router } from "express";
import multer from "multer";
import { parse as parseCsv } from "csv-parse/sync";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "../db.js";
import { IMAGES_DIR } from "../config.js";
import { requireAdmin, sameOriginOnly } from "./auth.js";
import { kickQueue, normalizeNumber, normalizeRarity } from "./queue.js";
import { services } from "./services.js";
import { matchProduct } from "./woo.js";

const ADMIN_UI_DIR = join(import.meta.dirname, "../../admin");
const SET_CODE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
const GAME_CODE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

// Photos gardées en mémoire le temps de la conversion en WebP (max 20 Mo chacune, 20 par envoi ;
// l'interface envoie par paquets de 10, Cloudflare refuse les requêtes de plus de 100 Mo)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

// L'id d'une carte : JJK-02 + SSR + 012 → JJK02-SSR-012 (même format que JJK-01)
export const cardId = (setCode, rarity, number) => `${setCode.replace(/-/g, "")}-${rarity}-${number}`;

const router = Router();
router.use(requireAdmin, sameOriginOnly);

const api = Router();
router.use("/api", api);

// /items/abc → 400 au lieu d'une erreur Postgres
api.param("id", (req, res, next, id) => (/^\d+$/.test(id) ? next() : res.status(400).json({ error: "Id invalide" })));
// L'interface (HTML/JS/CSS sans build) : /admin
router.use(express.static(ADMIN_UI_DIR));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

function httpUrl(value) {
  const url = text(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.href;
  } catch {
    /* plus bas */
  }
  throw new HttpError(400, `Lien invalide : ${url}`);
}

async function getSet(code) {
  const { rows } = await pool.query(
    `SELECT s.*, g.name AS game_name FROM sets s JOIN games g ON g.code = s.game_code WHERE s.code = $1`,
    [code],
  );
  if (!rows[0]) throw new HttpError(404, "Set introuvable");
  return rows[0];
}

// ---------- Jeux et sets ----------

api.get("/me", (req, res) => res.json({ email: req.adminEmail }));

api.get("/games", async (req, res) => {
  const { rows } = await pool.query("SELECT code, name FROM games ORDER BY name");
  res.json(rows);
});

api.get("/sets", async (req, res) => {
  const { rows } = await pool.query(`
    SELECT s.code, s.name, s.status, s.game_code, g.name AS game_name, s.product_url, s.release_date,
           (SELECT COUNT(*)::int FROM import_items i WHERE i.set_code = s.code) AS item_count,
           (SELECT COUNT(*)::int FROM import_items i WHERE i.set_code = s.code AND i.validated) AS validated_count,
           (SELECT COUNT(*)::int FROM cards c WHERE c.set_code = s.code) AS card_count
    FROM sets s JOIN games g ON g.code = s.game_code
    ORDER BY s.created_at DESC`);
  res.json(rows);
});

// Nouveau set (et nouveau jeu au besoin), en brouillon
api.post("/sets", async (req, res) => {
  const code = text(req.body.code)?.toUpperCase();
  const name = text(req.body.name);
  const gameCode = text(req.body.game_code)?.toUpperCase();
  const gameName = text(req.body.game_name);
  if (!code || !SET_CODE.test(code)) throw new HttpError(400, "Code de set invalide (ex. JJK-02)");
  if (!name) throw new HttpError(400, "Nom du set obligatoire");
  if (!gameCode || !GAME_CODE.test(gameCode)) throw new HttpError(400, "Code de jeu invalide (ex. AIKAHO-JJK)");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: game } = await client.query("SELECT 1 FROM games WHERE code = $1", [gameCode]);
    if (!game.length) {
      if (!gameName) throw new HttpError(400, "Nouveau jeu : son nom est obligatoire");
      await client.query("INSERT INTO games (code, name) VALUES ($1, $2)", [gameCode, gameName]);
    }
    const { rows: existing } = await client.query("SELECT 1 FROM sets WHERE code = $1", [code]);
    if (existing.length) throw new HttpError(409, `Le set ${code} existe déjà`);
    await client.query(
      `INSERT INTO sets (code, game_code, name, release_date, product_url, status)
       VALUES ($1, $2, $3, $4, $5, 'draft')`,
      [code, gameCode, name, text(req.body.release_date), httpUrl(req.body.product_url)],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  res.status(201).json(await getSet(code));
});

api.patch("/sets/:code", async (req, res) => {
  const set = await getSet(req.params.code);
  const name = req.body.name === undefined ? set.name : text(req.body.name);
  if (!name) throw new HttpError(400, "Nom du set obligatoire");
  await pool.query(`UPDATE sets SET name = $2, release_date = $3, product_url = $4 WHERE code = $1`, [
    set.code,
    name,
    req.body.release_date === undefined ? set.release_date : text(req.body.release_date),
    req.body.product_url === undefined ? set.product_url : httpUrl(req.body.product_url),
  ]);
  res.json(await getSet(set.code));
});

api.get("/sets/:code", async (req, res) => {
  const set = await getSet(req.params.code);
  const [{ rows: rarities }, { rows: items }] = await Promise.all([
    pool.query("SELECT code, rank FROM rarities WHERE set_code = $1 ORDER BY rank", [set.code]),
    pool.query("SELECT * FROM import_items WHERE set_code = $1 ORDER BY id", [set.code]),
  ]);
  res.json({ ...set, rarities, items });
});

// Ordre des raretés du set, de la plus rare à la plus commune
api.put("/sets/:code/rarities", async (req, res) => {
  const set = await getSet(req.params.code);
  const order = Array.isArray(req.body.order) ? req.body.order.map(normalizeRarity).filter(Boolean) : null;
  if (!order?.length) throw new HttpError(400, "Donne au moins une rareté");
  if (new Set(order).size !== order.length) throw new HttpError(400, "Une rareté apparaît deux fois");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Rangs temporaires (+1000) : évite les conflits de unique (set_code, rank) pendant le changement
    await client.query("UPDATE rarities SET rank = rank + 1000 WHERE set_code = $1", [set.code]);
    for (const [i, code] of order.entries()) {
      await client.query(
        `INSERT INTO rarities (set_code, code, rank) VALUES ($1, $2, $3)
         ON CONFLICT (set_code, code) DO UPDATE SET rank = EXCLUDED.rank`,
        [set.code, code, i + 1],
      );
    }
    // Les raretés retirées de la liste disparaissent (refusé si des cartes publiées les utilisent)
    await client.query("DELETE FROM rarities WHERE set_code = $1 AND NOT (code = ANY($2))", [set.code, order]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23503") throw new HttpError(400, "Une rareté retirée est encore utilisée par des cartes publiées");
    throw err;
  } finally {
    client.release();
  }
  const { rows } = await pool.query("SELECT code, rank FROM rarities WHERE set_code = $1 ORDER BY rank", [set.code]);
  res.json(rows);
});

// ---------- Photos ----------

api.post("/sets/:code/photos", upload.array("photos", 20), async (req, res) => {
  const set = await getSet(req.params.code);
  if (!req.files?.length) throw new HttpError(400, "Aucune photo reçue (formats image seulement)");

  const dir = join(IMAGES_DIR, set.code);
  await mkdir(dir, { recursive: true });

  const created = [];
  const failed = [];
  for (const file of req.files) {
    try {
      // rotate() : applique l'orientation EXIF des photos de téléphone.
      // 800 px pour le guide ; une copie 1600 px (.hd.webp) pour que Claude lise les petits codes.
      const oriented = sharp(file.buffer).rotate();
      const [webp, hd] = await Promise.all([
        oriented.clone().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
        oriented.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
      ]);
      const id = randomUUID();
      const imageFile = `${id}.webp`;
      await writeFile(join(dir, imageFile), webp);
      await writeFile(join(dir, `${id}.hd.webp`), hd);
      const { rows } = await pool.query(
        `INSERT INTO import_items (set_code, image_file, original_filename) VALUES ($1, $2, $3) RETURNING *`,
        [set.code, imageFile, file.originalname.slice(0, 200)],
      );
      created.push(rows[0]);
    } catch (err) {
      failed.push({ file: file.originalname, error: err.message });
    }
  }

  kickQueue();
  res.status(201).json({ created, failed });
});

api.patch("/items/:id", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM import_items WHERE id = $1", [req.params.id]);
  const item = rows[0];
  if (!item) throw new HttpError(404, "Photo introuvable");

  const pick = (field, normalize = text) => (req.body[field] === undefined ? item[field] : normalize(req.body[field]));
  const updated = await pool.query(
    `UPDATE import_items SET name = $2, name_original = $3, rarity = $4, number = $5,
       product_url = $6, product_name = $7, validated = $8, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [
      item.id,
      pick("name"),
      pick("name_original"),
      pick("rarity", normalizeRarity),
      pick("number", normalizeNumber),
      pick("product_url", httpUrl),
      pick("product_name"),
      req.body.validated === undefined ? item.validated : Boolean(req.body.validated),
    ],
  );
  res.json(updated.rows[0]);
});

api.delete("/items/:id", async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM import_items i USING sets s WHERE i.id = $1 AND s.code = i.set_code
     RETURNING i.set_code, i.image_file, s.status`,
    [req.params.id],
  );
  if (!rows[0]) throw new HttpError(404, "Photo introuvable");
  // Set déjà publié : la photo reste, une carte en ligne l'utilise peut-être encore
  if (rows[0].status === "draft") {
    const file = join(IMAGES_DIR, rows[0].set_code, rows[0].image_file);
    await unlink(file).catch(() => {});
    await unlink(file.replace(/\.webp$/, ".hd.webp")).catch(() => {});
  }
  res.status(204).end();
});

// Relancer la lecture par Claude (après une erreur, ou pour une 2e opinion)
api.post("/items/:id/retry", async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE import_items SET status = 'pending', error = NULL, validated = false, updated_at = now()
     WHERE id = $1 AND status IN ('done', 'error') RETURNING *`,
    [req.params.id],
  );
  if (!rows[0]) throw new HttpError(409, "Photo introuvable ou déjà en cours de lecture");
  kickQueue();
  res.json(rows[0]);
});

// ---------- Validation en lot et CSV ----------

// Valide d'un coup toutes les photos lues (ou remplies à la main) qui ont nom, rareté et numéro
api.post("/sets/:code/validate-all", async (req, res) => {
  const set = await getSet(req.params.code);
  const { rowCount } = await pool.query(
    `UPDATE import_items SET validated = true, updated_at = now()
     WHERE set_code = $1 AND NOT validated AND status IN ('done', 'error')
       AND name IS NOT NULL AND rarity IS NOT NULL AND number IS NOT NULL`,
    [set.code],
  );
  res.json({ validated: rowCount });
});

const CSV_COLUMNS = ["photo_id", "fichier", "nom", "nom_original", "rarete", "numero", "lien_produit", "valide"];

function csvField(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Export : point-virgule + BOM, pour qu'Excel (en français) l'ouvre en colonnes avec les accents
api.get("/sets/:code/items.csv", async (req, res) => {
  const set = await getSet(req.params.code);
  const { rows } = await pool.query("SELECT * FROM import_items WHERE set_code = $1 ORDER BY id", [set.code]);
  const lines = [
    CSV_COLUMNS.join(";"),
    ...rows.map((i) =>
      [i.id, i.original_filename, i.name, i.name_original, i.rarity, i.number, i.product_url, i.validated ? "oui" : "non"]
        .map(csvField)
        .join(";"),
    ),
  ];
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="${set.code}-cartes.csv"`);
  res.send("\uFEFF" + lines.join("\r\n") + "\r\n");
});

const YES = new Set(["", "oui", "o", "yes", "y", "1", "true", "x", "vrai"]);
const NO = new Set(["non", "n", "no", "0", "false", "faux"]);

// Import : met à jour les photos du set à partir d'un CSV (exporté puis corrigé dans Excel/Sheets,
// ou écrit à la main). Une ligne trouve sa photo par photo_id, sinon par fichier (nom du fichier envoyé).
// Les lignes importées sont validées (colonne valide vide = oui). Tout ou rien : une erreur annule l'import.
api.post("/sets/:code/items.csv", express.text({ type: () => true, limit: "2mb" }), async (req, res) => {
  const set = await getSet(req.params.code);
  const csvText = String(req.body ?? "").replace(/^\uFEFF/, "");
  if (!csvText.trim()) throw new HttpError(400, "CSV vide");
  const header = csvText.split(/\r?\n/, 1)[0];
  const delimiter = header.includes(";") ? ";" : ",";

  let records;
  try {
    records = parseCsv(csvText, {
      delimiter,
      columns: (cols) => cols.map((c) => c.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err) {
    throw new HttpError(400, `CSV illisible : ${err.message}`);
  }
  if (!records.length) throw new HttpError(400, "Aucune ligne dans le CSV");
  const known = Object.keys(records[0]);
  if (!known.includes("photo_id") && !known.includes("fichier")) {
    throw new HttpError(400, "Le CSV doit avoir une colonne photo_id ou fichier");
  }

  const { rows: items } = await pool.query("SELECT * FROM import_items WHERE set_code = $1", [set.code]);
  const byId = new Map(items.map((i) => [String(i.id), i]));
  const byFile = new Map();
  for (const i of items) {
    const key = (i.original_filename ?? "").toLowerCase();
    byFile.set(key, byFile.has(key) ? null : i); // null = nom de fichier en double, ambigu
  }

  const problems = [];
  const updates = [];
  records.forEach((r, index) => {
    const line = index + 2;
    const item = r.photo_id ? byId.get(r.photo_id) : byFile.get((r.fichier ?? "").toLowerCase());
    if (!item) {
      problems.push(`Ligne ${line} : photo introuvable (${r.photo_id || r.fichier || "vide"})`);
      return;
    }
    const valide = (r.valide ?? "").toLowerCase();
    if (!YES.has(valide) && !NO.has(valide)) problems.push(`Ligne ${line} : valide doit être oui ou non`);
    let productUrl = item.product_url;
    if (r.lien_produit !== undefined) {
      try {
        productUrl = httpUrl(r.lien_produit);
      } catch (err) {
        problems.push(`Ligne ${line} : ${err.message}`);
      }
    }
    const pick = (col, field, normalize = text) => (r[col] === undefined ? item[field] : normalize(r[col]));
    updates.push([
      item.id,
      pick("nom", "name"),
      pick("nom_original", "name_original"),
      pick("rarete", "rarity", normalizeRarity),
      pick("numero", "number", normalizeNumber),
      productUrl,
      !NO.has(valide),
    ]);
  });
  if (problems.length) return res.status(400).json({ error: "Import annulé", problems });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const values of updates) {
      // status done : une photo en attente ou en cours de lecture n'est plus modifiée par Claude (le CSV a priorité)
      await client.query(
        `UPDATE import_items SET name = $2, name_original = $3, rarity = $4, number = $5,
           product_url = $6, validated = $7,
           status = 'done',
           error = NULL, updated_at = now()
         WHERE id = $1`,
        values,
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  res.json({ updated: updates.length });
});

// ---------- Produits Eyesight ----------

api.post("/sets/:code/products", async (req, res) => {
  const set = await getSet(req.params.code);
  if (!services.wooConfigured()) {
    throw new HttpError(503, "WooCommerce pas configuré : WOO_URL, WOO_KEY et WOO_SECRET dans .env");
  }
  const { rows: items } = await pool.query(
    `SELECT * FROM import_items WHERE set_code = $1 AND rarity IS NOT NULL AND number IS NOT NULL ORDER BY id`,
    [set.code],
  );

  // Set sans photos dans l'admin (ex. JJK-01, importé par le seed) : on met à jour les cartes directement
  if (!items.length) {
    const { rows: cards } = await pool.query("SELECT id, rarity, number, product_url FROM cards WHERE set_code = $1", [
      set.code,
    ]);
    const summary = { matched: 0, ambiguous: 0, none: 0, kept: 0 };
    const cache = new Map();
    for (const card of cards) {
      const query = `${card.rarity}-${card.number}`;
      if (!cache.has(query)) cache.set(query, await services.searchProducts(query));
      const { match, candidates } = matchProduct(cache.get(query), {
        ...card,
        setCode: set.code,
        gameName: set.game_name,
      });
      if (card.product_url) summary.kept++;
      else if (match) {
        summary.matched++;
        await pool.query("UPDATE cards SET product_url = $2 WHERE id = $1", [card.id, match.url]);
      } else if (candidates.length) summary.ambiguous++;
      else summary.none++;
    }
    return res.json(summary);
  }

  const cache = new Map();
  const summary = { matched: 0, ambiguous: 0, none: 0, kept: 0 };
  for (const item of items) {
    const query = `${item.rarity}-${item.number}`;
    if (!cache.has(query)) cache.set(query, await services.searchProducts(query));
    const { match, candidates } = matchProduct(cache.get(query), {
      rarity: item.rarity,
      number: item.number,
      setCode: set.code,
      gameName: set.game_name,
    });

    // Un lien déjà choisi à la main n'est jamais écrasé
    const keep = item.product_url && !candidates.some((c) => c.url === item.product_url);
    if (keep) summary.kept++;
    else if (match) summary.matched++;
    else if (candidates.length) summary.ambiguous++;
    else summary.none++;

    await pool.query(
      `UPDATE import_items SET product_candidates = $2,
         product_url = CASE WHEN $3 THEN product_url ELSE $4 END,
         product_name = CASE WHEN $3 THEN product_name ELSE $5 END,
         updated_at = now()
       WHERE id = $1`,
      [item.id, JSON.stringify(candidates), keep, match?.url ?? item.product_url, match?.name ?? item.product_name],
    );
  }
  res.json(summary);
});

// ---------- Publication ----------

async function triggerFrontRebuild() {
  // Render reconstruit le front (nouveau sitemap avec les cartes du set)
  const hook = process.env.RENDER_DEPLOY_HOOK_URL;
  if (!hook) return false;
  try {
    const res = await fetch(hook, { method: "POST", signal: AbortSignal.timeout(10_000) });
    return res.ok;
  } catch (err) {
    console.error("Deploy hook Render :", err.message);
    return false;
  }
}

api.post("/sets/:code/publish", async (req, res) => {
  const set = await getSet(req.params.code);
  const [{ rows: rarities }, { rows: items }] = await Promise.all([
    pool.query("SELECT code FROM rarities WHERE set_code = $1", [set.code]),
    pool.query("SELECT * FROM import_items WHERE set_code = $1 ORDER BY id", [set.code]),
  ]);
  const known = new Set(rarities.map((r) => r.code));

  const problems = [];
  if (!items.length) problems.push("Aucune photo dans ce set");
  if (!known.size) problems.push("L'ordre des raretés n'est pas défini");
  const ids = new Map();
  for (const item of items) {
    const label = `Photo ${item.id} (${item.original_filename ?? item.image_file})`;
    if (["pending", "processing"].includes(item.status)) problems.push(`${label} : lecture pas terminée`);
    if (!item.name || !item.rarity || !item.number) problems.push(`${label} : nom, rareté ou numéro manquant`);
    else {
      if (!known.has(item.rarity)) problems.push(`${label} : rareté ${item.rarity} absente de l'ordre des raretés`);
      const id = cardId(set.code, item.rarity, item.number);
      if (ids.has(id)) problems.push(`${label} : même carte que la photo ${ids.get(id)} (${id})`);
      ids.set(id, item.id);
    }
    if (!item.validated) problems.push(`${label} : pas encore validée`);
  }
  if (problems.length) return res.status(400).json({ error: "Publication impossible", problems });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Seules les cartes créées par /admin (photo dans images/<SET>/) qui n'ont plus de photo sont retirées.
    // Les cartes venues d'ailleurs (ex. les 151 de JJK-01 du seed) ne sont jamais supprimées ici.
    await client.query(
      `DELETE FROM cards WHERE set_code = $1 AND image_url LIKE $2 AND NOT (id = ANY($3))`,
      [set.code, `/images/${set.code}/%`, [...ids.keys()]],
    );
    for (const item of items) {
      await client.query(
        `INSERT INTO cards (id, name, set_code, number, rarity, image_url, product_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, number = EXCLUDED.number, rarity = EXCLUDED.rarity,
           image_url = EXCLUDED.image_url, product_url = EXCLUDED.product_url`,
        [
          cardId(set.code, item.rarity, item.number),
          item.name,
          set.code,
          item.number,
          item.rarity,
          `/images/${set.code}/${item.image_file}`,
          item.product_url,
        ],
      );
    }
    await client.query("UPDATE sets SET status = 'published' WHERE code = $1", [set.code]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.json({ published: items.length, frontRebuild: await triggerFrontRebuild() });
});

api.post("/sets/:code/unpublish", async (req, res) => {
  const set = await getSet(req.params.code);
  await pool.query("UPDATE sets SET status = 'draft' WHERE code = $1", [set.code]);
  res.json({ status: "draft", frontRebuild: await triggerFrontRebuild() });
});

// Erreurs de l'admin : messages lisibles plutôt que « Erreur serveur »
router.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof multer.MulterError) return res.status(400).json({ error: `Envoi refusé : ${err.message}` });
  next(err);
});

export default router;
