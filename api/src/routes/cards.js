import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

// Colonnes exposées au front (pas de SELECT * : created_at reste côté serveur).
// rarity_rank vient de la table rarities (le rang dépend du set).
// product_url : produit Eyesight de la carte, sinon celui du set.
export const CARD_COLUMNS = `
  c.id, c.name, c.set_code, c.number, c.rarity, r.rank AS rarity_rank, c.image_url,
  COALESCE(c.product_url, s.product_url) AS product_url`;

// Seulement les cartes des sets publiés : un set en préparation dans /admin reste invisible
export const CARD_FROM = `
  FROM cards c
  JOIN sets s ON s.code = c.set_code AND s.status = 'published'
  JOIN rarities r ON r.set_code = c.set_code AND r.code = c.rarity`;

// Liste filtrée des cartes. setCode : limite à un set (null = tous les sets publiés).
// Retourne { status, body } pour que /cards et /sets/:code/cards partagent la même logique.
export async function listCards({ setCode = null, search, rarity }) {
  if (search !== undefined && typeof search !== "string") {
    return { status: 400, body: { error: "Paramètre search invalide" } };
  }
  if (rarity !== undefined && typeof rarity !== "string") {
    return { status: 400, body: { error: "Paramètre rarity invalide" } };
  }

  const conditions = [];
  const params = [];

  if (setCode) {
    params.push(setCode);
    conditions.push(`c.set_code = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`c.name ILIKE $${params.length}`);
  }

  if (rarity) {
    const list = rarity.split(",");
    // Les raretés valides sont celles du set (ou de tous les sets publiés)
    const { rows: known } = await pool.query(
      `SELECT DISTINCT r.code FROM rarities r
       JOIN sets s ON s.code = r.set_code AND s.status = 'published'
       WHERE $1::text IS NULL OR r.set_code = $1`,
      [setCode],
    );
    const codes = new Set(known.map((row) => row.code));
    const unknown = list.find((r) => !codes.has(r));
    if (unknown) {
      return { status: 400, body: { error: `Rareté inconnue : ${unknown}` } };
    }
    // pg convertit le tableau JS en tableau Postgres
    params.push(list);
    conditions.push(`c.rarity = ANY($${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT ${CARD_COLUMNS} ${CARD_FROM} ${where} ORDER BY c.set_code, r.rank, c.number`,
    params,
  );

  return { status: 200, body: rows };
}

router.get("/cards", async (req, res) => {
  const { set, search, rarity } = req.query;
  if (set !== undefined && typeof set !== "string") {
    return res.status(400).json({ error: "Paramètre set invalide" });
  }
  const { status, body } = await listCards({ setCode: set || null, search, rarity });
  res.status(status).json(body);
});

router.get("/cards/:id", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${CARD_COLUMNS} ${CARD_FROM} WHERE c.id = $1`,
    [req.params.id],
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "Carte introuvable" });
  }

  res.json(rows[0]);
});

export default router;
