import { Router } from "express";
import { pool } from "../db.js";
import { RARITIES } from "../rarities.js";

const router = Router();

// Colonnes exposées au front (pas de SELECT * : created_at reste côté serveur)
const COLUMNS = "id, name, set_code, number, rarity, rarity_rank, image_url";

router.get("/cards", async (req, res) => {
  const { search, rarity } = req.query;

  if (search !== undefined && typeof search !== "string") {
    return res.status(400).json({ error: "Paramètre search invalide" });
  }
  if (rarity !== undefined && typeof rarity !== "string") {
    return res.status(400).json({ error: "Paramètre rarity invalide" });
  }

  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`name ILIKE $${params.length}`);
  }

  if (rarity) {
    const list = rarity.split(",");
    const unknown = list.find((r) => !RARITIES.includes(r));
    if (unknown) {
      return res.status(400).json({ error: `Rareté inconnue : ${unknown}` });
    }
    // pg convertit le tableau JS en tableau Postgres
    params.push(list);
    conditions.push(`rarity = ANY($${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM cards ${where} ORDER BY rarity_rank, number`,
    params,
  );

  res.json(rows);
});

router.get("/cards/:id", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM cards WHERE id = $1`,
    [req.params.id],
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "Carte introuvable" });
  }

  res.json(rows[0]);
});

router.get("/rarities", (req, res) => {
  res.json(RARITIES.map((code, i) => ({ code, rank: i + 1 })));
});

export default router;
