import { join } from "node:path";
import { runner } from "node-pg-migrate";

// Applique les migrations de api/migrations qui n'ont pas encore roulé.
// Appelée au démarrage de l'API (index.js) et par les tests.
export async function migrate(databaseUrl = process.env.DATABASE_URL) {
  return runner({
    databaseUrl,
    dir: join(import.meta.dirname, "../migrations"),
    direction: "up",
    migrationsTable: "pgmigrations",
    checkOrder: true,
    log: (msg) => console.log(`[migrations] ${msg}`),
  });
}
