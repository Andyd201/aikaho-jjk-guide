import { Router } from "express";
import { pool } from "../db.js";
import { listCards } from "./cards.js";

const router = Router();

// Jeux qui ont au moins un set publié
router.get("/games", async (req, res) => {
  const { rows } = await pool.query(`
    SELECT g.code, g.name, COUNT(s.code)::int AS set_count
    FROM games g
    JOIN sets s ON s.game_code = g.code AND s.status = 'published'
    GROUP BY g.code, g.name
    ORDER BY g.name`);
  res.json(rows);
});

const SET_COLUMNS = `
  s.code, s.name, s.game_code, g.name AS game_name, s.release_date, s.product_url,
  (SELECT COUNT(*)::int FROM cards c WHERE c.set_code = s.code) AS card_count`;

// Sets publiés, filtrables par jeu (?game=AIKAHO-JJK)
router.get("/sets", async (req, res) => {
  const { game } = req.query;
  if (game !== undefined && typeof game !== "string") {
    return res.status(400).json({ error: "Paramètre game invalide" });
  }
  const { rows } = await pool.query(
    `SELECT ${SET_COLUMNS}
     FROM sets s JOIN games g ON g.code = s.game_code
     WHERE s.status = 'published' AND ($1::text IS NULL OR s.game_code = $1)
     ORDER BY g.name, s.release_date DESC NULLS LAST, s.code`,
    [game || null],
  );
  res.json(rows);
});

async function findPublishedSet(code) {
  const { rows } = await pool.query(
    `SELECT ${SET_COLUMNS}
     FROM sets s JOIN games g ON g.code = s.game_code
     WHERE s.code = $1 AND s.status = 'published'`,
    [code],
  );
  return rows[0] ?? null;
}

async function setRarities(code) {
  const { rows } = await pool.query(
    `SELECT r.code, r.rank, COUNT(c.id)::int AS card_count
     FROM rarities r
     LEFT JOIN cards c ON c.set_code = r.set_code AND c.rarity = r.code
     WHERE r.set_code = $1
     GROUP BY r.code, r.rank
     ORDER BY r.rank`,
    [code],
  );
  return rows;
}

// Un set + ses raretés (avec le nombre de cartes de chacune)
router.get("/sets/:code", async (req, res) => {
  const set = await findPublishedSet(req.params.code);
  if (!set) return res.status(404).json({ error: "Set introuvable" });
  res.json({ ...set, rarities: await setRarities(set.code) });
});

router.get("/sets/:code/rarities", async (req, res) => {
  const set = await findPublishedSet(req.params.code);
  if (!set) return res.status(404).json({ error: "Set introuvable" });
  res.json(await setRarities(set.code));
});

router.get("/sets/:code/cards", async (req, res) => {
  const set = await findPublishedSet(req.params.code);
  if (!set) return res.status(404).json({ error: "Set introuvable" });
  const { search, rarity } = req.query;
  const { status, body } = await listCards({ setCode: set.code, search, rarity });
  res.status(status).json(body);
});

export default router;
