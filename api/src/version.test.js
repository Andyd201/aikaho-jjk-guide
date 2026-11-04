import { describe, it, expect, beforeAll } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { readVersion } from "./version.js";
import { app } from "./app.js";

const SHA = "04fb56f7c529d24bde76af1dd954602d79a8b665";
let dir;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "git-version-"));
});

function gitDir(name, files) {
  const root = join(dir, name);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe("readVersion", () => {
  it("lit le commit de la branche (ref simple)", () => {
    const root = gitDir("loose", { HEAD: "ref: refs/heads/master\n", "refs/heads/master": `${SHA}\n` });
    expect(readVersion(root)).toBe("04fb56f");
  });

  it("lit le commit dans packed-refs", () => {
    const root = gitDir("packed", {
      HEAD: "ref: refs/heads/master\n",
      "packed-refs": `# pack-refs with: peeled fully-peeled sorted\n${SHA} refs/heads/master\n`,
    });
    expect(readVersion(root)).toBe("04fb56f");
  });

  it("HEAD détaché", () => {
    expect(readVersion(gitDir("detached", { HEAD: `${SHA}\n` }))).toBe("04fb56f");
  });

  it("« inconnue » sans dossier .git", () => {
    expect(readVersion(undefined)).toBe("inconnue");
    expect(readVersion(join(dir, "nope"))).toBe("inconnue");
  });
});

describe("GET /health", () => {
  it("donne la version et l'heure de démarrage", async () => {
    const res = await request(app).get("/health");
    expect(res.body).toHaveProperty("version");
    expect(res.body.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
