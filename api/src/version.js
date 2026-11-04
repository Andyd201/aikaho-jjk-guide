import { readFileSync } from "node:fs";
import { join } from "node:path";

// Version en ligne = le commit Git du Pi (relu à chaque appel : un merge qui ne touche
// que le front ne recrée pas le conteneur, mais le commit affiché suit quand même).
// docker-compose monte le dossier .git du repo en lecture seule dans le conteneur
// (GIT_DIR_HOST=/app/.git-host). Comme ça, /health dit quel code est en ligne,
// que le déploiement soit automatique ou fait à la main.
export function readVersion(gitDir = process.env.GIT_DIR_HOST) {
  if (!gitDir) return "inconnue";
  try {
    const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
    if (!head.startsWith("ref: ")) return head.slice(0, 7); // HEAD détaché : directement le commit

    const ref = head.slice(5);
    try {
      return readFileSync(join(gitDir, ref), "utf8").trim().slice(0, 7);
    } catch {
      // Ref rangée dans packed-refs (après un git gc)
      const packed = readFileSync(join(gitDir, "packed-refs"), "utf8");
      const line = packed.split("\n").find((l) => l.endsWith(` ${ref}`));
      return line ? line.slice(0, 7) : "inconnue";
    }
  } catch {
    return "inconnue";
  }
}

export const STARTED_AT = new Date().toISOString();
