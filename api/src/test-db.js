import { pool } from "./db.js";
import { migrate } from "./migrate.js";

// Repart d'une base vide puis applique toutes les migrations.
// Garde-fou : ne touche jamais une base dont le nom ne finit pas par _test.
export async function resetTestDatabase() {
  if (!process.env.DATABASE_URL?.includes("_test")) {
    throw new Error("DATABASE_URL doit pointer vers une base *_test");
  }
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await migrate();
}
