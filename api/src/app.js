import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import cardsRouter from "./routes/cards.js";
import setsRouter from "./routes/sets.js";
import adminRouter from "./admin/router.js";
import { IMAGES_DIR } from "./config.js";

export const app = express();

// CORS_ORIGIN peut contenir plusieurs origines séparées par des virgules
// (ex. l'URL onrender.com et le futur domaine, le temps de la transition)
export function parseOrigins(value) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

const origins = parseOrigins(process.env.CORS_ORIGIN);
// Aucune origine configurée : comportement par défaut de cors (toutes les origines), comme avant
app.use(cors(origins.length ? { origin: origins } : {}));
app.use(express.json());

// Page d'import des sets : protégée par Cloudflare Access (voir src/admin/auth.js)
app.use("/admin", adminRouter);

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
app.use(setsRouter);

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
