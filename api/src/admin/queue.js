import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "../db.js";
import { IMAGES_DIR } from "../config.js";
import { services } from "./services.js";

// File de lecture des photos par Claude Vision, dans le process de l'API.
// 2 photos à la fois : assez rapide, sans dépasser les limites de l'API Anthropic.
const CONCURRENCY = 2;
let running = 0;
let idle = Promise.resolve();
let resolveIdle = null;

export function normalizeNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? digits.padStart(3, "0") : null;
}

export function normalizeRarity(value) {
  const code = String(value ?? "").toUpperCase().replace(/[^A-Z0-9+]/g, "");
  return code || null;
}

// Prend la prochaine photo en attente (FOR UPDATE SKIP LOCKED : jamais deux fois la même)
async function claimNext() {
  const { rows } = await pool.query(`
    UPDATE import_items SET status = 'processing', updated_at = now()
    WHERE id = (
      SELECT id FROM import_items WHERE status = 'pending'
      ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING *`);
  return rows[0] ?? null;
}

async function setContext(setCode) {
  const { rows } = await pool.query(
    `SELECT s.code, s.name, g.name AS game_name,
            ARRAY(SELECT code FROM rarities r WHERE r.set_code = s.code ORDER BY rank) AS rarities
     FROM sets s JOIN games g ON g.code = s.game_code WHERE s.code = $1`,
    [setCode],
  );
  const set = rows[0];
  return { setCode: set.code, setName: set.name, gameName: set.game_name, rarities: set.rarities };
}

async function processItem(item) {
  try {
    // La copie HD si elle existe (lecture des petits codes), sinon la photo du guide
    const base = join(IMAGES_DIR, item.set_code, item.image_file);
    const image = await readFile(base.replace(/\.webp$/, ".hd.webp")).catch(() => readFile(base));
    const card = await services.readCard(image, await setContext(item.set_code));
    await pool.query(
      `UPDATE import_items SET
         status = 'done', error = NULL,
         name = $2, name_original = $3, rarity = $4, number = $5,
         printed_code = $6, confidence = $7, notes = $8, updated_at = now()
       WHERE id = $1`,
      [
        item.id,
        card.name?.trim() || null,
        card.name_original?.trim() || null,
        normalizeRarity(card.rarity),
        normalizeNumber(card.number),
        card.printed_code?.trim() || null,
        ["high", "medium", "low"].includes(card.confidence) ? card.confidence : "low",
        card.notes?.trim() || null,
      ],
    );
  } catch (err) {
    console.error(`Import ${item.id} : lecture échouée :`, err.message);
    await pool.query(
      `UPDATE import_items SET status = 'error', error = $2, updated_at = now() WHERE id = $1`,
      [item.id, err.message.slice(0, 500)],
    );
  }
}

async function worker() {
  for (let item = await claimNext(); item; item = await claimNext()) {
    await processItem(item);
  }
}

// Lance des workers jusqu'à CONCURRENCY ; sans effet si la file tourne déjà.
// Retourne une promesse résolue quand la file est vide (utile pour les tests).
// kicked : une photo est arrivée pendant que les workers tournaient. Un worker qui vient de
// trouver la file vide (juste avant l'arrivée de la photo) relance alors un tour au lieu de s'arrêter.
let kicked = false;

export function kickQueue() {
  if (running === 0) idle = new Promise((resolve) => (resolveIdle = resolve));
  if (running >= CONCURRENCY) kicked = true;
  while (running < CONCURRENCY) {
    running++;
    worker()
      .catch((err) => console.error("File d'import :", err.message))
      .finally(() => {
        running--;
        if (kicked) {
          kicked = false;
          kickQueue();
        }
        if (running === 0) resolveIdle?.();
      });
  }
  return idle;
}

// Au démarrage : une photo restée « processing » (API redémarrée en plein travail) est remise en attente
export async function resumeQueue() {
  await pool.query(`UPDATE import_items SET status = 'pending' WHERE status = 'processing'`);
  const { rows } = await pool.query(`SELECT 1 FROM import_items WHERE status = 'pending' LIMIT 1`);
  if (rows.length) kickQueue();
}
