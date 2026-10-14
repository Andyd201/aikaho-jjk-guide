import express from "express";
import cors from "cors";
import { join } from "node:path";
import { pool } from "./db.js";
import cardsRouter from "./routes/cards.js";

// Dans Docker : /app/images (via docker-compose). En local : <racine du repo>/images
const IMAGES_DIR =
  process.env.IMAGES_DIR ?? join(import.meta.dirname, "../../images");

export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (err) {
    console.error("Health check échoué :", err.code || err.message);
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

app.use(cardsRouter);

app.use("/images", express.static(IMAGES_DIR, { maxAge: "7d" }));

// Route inconnue
app.use((req, res) => {
  res.status(404).json({ error: "Route introuvable" });
});

// Les 4 paramètres sont obligatoires pour qu'Express le reconnaisse comme gestionnaire d'erreurs
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur serveur" });
});
