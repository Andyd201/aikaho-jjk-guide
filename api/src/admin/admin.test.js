import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import sharp from "sharp";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { app } from "../app.js";
import { pool } from "../db.js";
import { IMAGES_DIR } from "../config.js";
import { resetTestDatabase } from "../test-db.js";
import { kickQueue } from "./queue.js";
import { setServices } from "./services.js";

// Fausse lecture par Claude. Chaque photo de test a une largeur différente :
// c'est comme ça que le faux lecteur sait quelle carte il « voit » (2 photos sont lues en même temps).
const FAKE_READS = {
  300: { name: "Satoru Gojo", name_original: "五条悟", rarity: "ssr", number: "12", confidence: "high" },
  310: { name: "Yuji Itadori", rarity: "R", number: "001", confidence: "medium", notes: "Reflet" },
  320: "ERREUR",
};
const WIDTHS = { "gojo.jpg": 300, "yuji.jpg": 310, "flou.jpg": 320 };

async function fakeReadCard(image, context) {
  // Le contexte du set est bien passé à Claude
  if (context.setCode !== "TST-03") throw new Error("mauvais contexte");
  const { width } = await sharp(image).metadata();
  const read = FAKE_READS[width];
  if (read === "ERREUR") throw new Error("Photo illisible");
  return read;
}

const png = (filename) =>
  sharp({ create: { width: WIDTHS[filename], height: 420, channels: 3, background: "#336699" } }).png().toBuffer();

const admin = (method, path) => request(app)[method](`/admin/api${path}`);

beforeAll(async () => {
  await resetTestDatabase();
  await rm(IMAGES_DIR, { recursive: true, force: true });
});

afterAll(async () => {
  delete process.env.ADMIN_DEV_BYPASS;
  await pool.end();
});

describe("Accès à /admin", () => {
  beforeEach(() => {
    delete process.env.ADMIN_DEV_BYPASS;
    delete process.env.CF_ACCESS_TEAM_DOMAIN;
    delete process.env.CF_ACCESS_AUD;
  });

  it("fermé (503) si Cloudflare Access n'est pas configuré", async () => {
    expect((await request(app).get("/admin/")).status).toBe(503);
    expect((await admin("get", "/sets")).status).toBe(503);
  });

  it("401 sans jeton Cloudflare Access", async () => {
    process.env.CF_ACCESS_TEAM_DOMAIN = "exemple.cloudflareaccess.com";
    process.env.CF_ACCESS_AUD = "aud-test";
    expect((await admin("get", "/sets")).status).toBe(401);
  });

  it("403 avec un faux jeton", async () => {
    process.env.CF_ACCESS_TEAM_DOMAIN = "exemple.cloudflareaccess.com";
    process.env.CF_ACCESS_AUD = "aud-test";
    const res = await admin("get", "/sets").set("Cf-Access-Jwt-Assertion", "pas.un.jeton");
    expect(res.status).toBe(403);
  });

  it("le contournement de dev est ignoré en production", async () => {
    process.env.ADMIN_DEV_BYPASS = "1";
    process.env.NODE_ENV = "production";
    try {
      expect((await admin("get", "/sets")).status).toBe(503);
    } finally {
      process.env.NODE_ENV = "test";
    }
  });
});

describe("Workflow d'import", () => {
  beforeAll(() => {
    process.env.ADMIN_DEV_BYPASS = "1";
    setServices({ readCard: fakeReadCard, wooConfigured: () => true });
  });

  it("sert l'interface", async () => {
    const res = await request(app).get("/admin/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Admin · Foreign Card TCG");
  });

  it("refuse une requête qui modifie venant d'un autre site (CSRF)", async () => {
    const res = await admin("post", "/sets").set("Origin", "https://pirate.example").send({});
    expect(res.status).toBe(403);
  });

  it("crée un set en brouillon avec un nouveau jeu", async () => {
    const res = await admin("post", "/sets").send({
      code: "tst-03",
      name: "Test Set 03",
      game_code: "TEST-GAME",
      game_name: "Jeu test",
      product_url: "https://shop.test/booster-tst-03",
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ code: "TST-03", status: "draft", game_name: "Jeu test" });
    // Brouillon : invisible dans le guide
    expect((await request(app).get("/sets/TST-03")).status).toBe(404);
  });

  it("refuse un code invalide ou un set en double", async () => {
    expect((await admin("post", "/sets").send({ code: "pas bon!", name: "x", game_code: "TEST-GAME" })).status).toBe(400);
    expect((await admin("post", "/sets").send({ code: "TST-03", name: "x", game_code: "TEST-GAME" })).status).toBe(409);
  });

  it("convertit les photos en WebP et Claude les lit", async () => {
    const res = await admin("post", "/sets/TST-03/photos")
      .attach("photos", await png("gojo.jpg"), "gojo.jpg")
      .attach("photos", await png("yuji.jpg"), "yuji.jpg")
      .attach("photos", await png("flou.jpg"), "flou.jpg");
    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(3);
    expect(existsSync(join(IMAGES_DIR, "TST-03", res.body.created[0].image_file))).toBe(true);
    expect(res.body.created[0].image_file).toMatch(/\.webp$/);
    // Copie HD pour la lecture par Claude
    expect(existsSync(join(IMAGES_DIR, "TST-03", res.body.created[0].image_file.replace(".webp", ".hd.webp")))).toBe(true);

    await kickQueue();

    const { body: set } = await admin("get", "/sets/TST-03");
    const byFile = Object.fromEntries(set.items.map((i) => [i.original_filename, i]));
    // Rareté en majuscules, numéro sur 3 chiffres
    expect(byFile["gojo.jpg"]).toMatchObject({ status: "done", name: "Satoru Gojo", rarity: "SSR", number: "012", confidence: "high" });
    expect(byFile["yuji.jpg"]).toMatchObject({ status: "done", rarity: "R", number: "001", notes: "Reflet" });
    expect(byFile["flou.jpg"]).toMatchObject({ status: "error", error: "Photo illisible" });
  });

  it("refuse de publier tant que tout n'est pas lu, rangé et validé", async () => {
    const res = await admin("post", "/sets/TST-03/publish");
    expect(res.status).toBe(400);
    expect(res.body.problems.join("\n")).toMatch(/ordre des raretés n'est pas défini/);
    expect(res.body.problems.join("\n")).toMatch(/pas encore validée/);
    expect(res.body.problems.join("\n")).toMatch(/flou\.jpg.*manquant/);
  });

  it("une photo illisible peut être corrigée à la main ou supprimée", async () => {
    const { body: set } = await admin("get", "/sets/TST-03");
    const flou = set.items.find((i) => i.original_filename === "flou.jpg");
    const file = join(IMAGES_DIR, "TST-03", flou.image_file);
    expect((await admin("delete", `/items/${flou.id}`)).status).toBe(204);
    expect(existsSync(file)).toBe(false);
  });

  it("exporte les photos en CSV (point-virgule, BOM pour Excel)", async () => {
    const res = await admin("get", "/sets/TST-03/items.csv");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    const lines = res.text.slice(1).trim().split("\r\n");
    expect(lines[0]).toBe("photo_id;fichier;nom;nom_original;rarete;numero;lien_produit;valide");
    expect(lines).toHaveLength(3); // gojo + yuji (flou supprimée)
    expect(res.text).toContain("gojo.jpg;Satoru Gojo;五条悟;SSR;012;;non");
  });

  it("importe un CSV corrigé dans Excel : met à jour et valide d'un coup", async () => {
    const { body: set } = await admin("get", "/sets/TST-03");
    const yuji = set.items.find((i) => i.original_filename === "yuji.jpg");
    const csv = `\uFEFFphoto_id;fichier;nom;nom_original;rarete;numero;lien_produit;valide\r\n${yuji.id};yuji.jpg;Yuji Itadori (corrigé);;r;1;;\r\n`;
    const res = await admin("post", "/sets/TST-03/items.csv").set("Content-Type", "text/csv").send(csv);
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);

    const { body: after } = await admin("get", "/sets/TST-03");
    expect(after.items.find((i) => i.id === yuji.id)).toMatchObject({
      name: "Yuji Itadori (corrigé)",
      rarity: "R",
      number: "001",
      validated: true,
    });
    // On remet comme avant pour la suite des tests
    await admin("patch", `/items/${yuji.id}`).send({ name: "Yuji Itadori", validated: false });
  });

  it("CSV avec virgules et la colonne fichier seulement (écrit à la main)", async () => {
    const csv = "fichier,nom,rarete,numero,valide\ngojo.jpg,Satoru Gojo,SSR,12,non\n";
    const res = await admin("post", "/sets/TST-03/items.csv").set("Content-Type", "text/csv").send(csv);
    expect(res.status).toBe(200);
  });

  it("CSV avec une erreur : rien n'est importé, la liste des problèmes est donnée", async () => {
    const csv = "fichier;nom;rarete;numero;lien_produit;valide\ngojo.jpg;CHANGÉ;SSR;12;;oui\ninconnu.jpg;X;R;1;;\nyuji.jpg;Y;R;1;pas-un-lien;peut-être\n";
    const res = await admin("post", "/sets/TST-03/items.csv").set("Content-Type", "text/csv").send(csv);
    expect(res.status).toBe(400);
    expect(res.body.problems.join("\n")).toMatch(/Ligne 3 : photo introuvable \(inconnu\.jpg\)/);
    expect(res.body.problems.join("\n")).toMatch(/Ligne 4 : valide doit être oui ou non/);
    expect(res.body.problems.join("\n")).toMatch(/Ligne 4 : Lien invalide/);
    const { body: set } = await admin("get", "/sets/TST-03");
    expect(set.items.find((i) => i.original_filename === "gojo.jpg").name).toBe("Satoru Gojo");
  });

  it("CSV sans colonne photo_id ni fichier : refusé", async () => {
    const res = await admin("post", "/sets/TST-03/items.csv").set("Content-Type", "text/csv").send("nom;rarete\nX;R\n");
    expect(res.status).toBe(400);
  });

  it("enregistre l'ordre des raretés", async () => {
    const res = await admin("put", "/sets/TST-03/rarities").send({ order: ["ssr", "R"] });
    expect(res.body).toEqual([
      { code: "SSR", rank: 1 },
      { code: "R", rank: 2 },
    ]);
    expect((await admin("put", "/sets/TST-03/rarities").send({ order: ["R", "R"] })).status).toBe(400);
  });

  it("trouve les produits Eyesight par code, sans écraser un choix manuel", async () => {
    setServices({
      searchProducts: async (query) =>
        query === "SSR-012"
          ? [{ name: "Satoru Gojo SSR-012 TST-03", url: "https://shop.test/gojo-ssr-012" }, { name: "Naruto SSR-012", url: "https://shop.test/naruto" }]
          : [{ name: "Yuji R-001", url: "https://shop.test/yuji-a" }, { name: "Yuji R-001 holo", url: "https://shop.test/yuji-b" }],
    });
    const res = await admin("post", "/sets/TST-03/products");
    expect(res.body).toEqual({ matched: 1, ambiguous: 1, none: 0, kept: 0 });

    const { body: set } = await admin("get", "/sets/TST-03");
    const gojo = set.items.find((i) => i.original_filename === "gojo.jpg");
    const yuji = set.items.find((i) => i.original_filename === "yuji.jpg");
    expect(gojo.product_url).toBe("https://shop.test/gojo-ssr-012");
    expect(yuji.product_url).toBeNull();
    expect(yuji.product_candidates).toHaveLength(2);

    // Choix manuel, puis nouvelle recherche : le choix reste
    await admin("patch", `/items/${yuji.id}`).send({ product_url: "https://shop.test/manuel" });
    const again = await admin("post", "/sets/TST-03/products");
    expect(again.body.kept).toBe(1);
  });

  it("refuse un lien produit qui n'est pas http(s)", async () => {
    const { body: set } = await admin("get", "/sets/TST-03");
    const res = await admin("patch", `/items/${set.items[0].id}`).send({ product_url: "javascript:alert(1)" });
    expect(res.status).toBe(400);
  });

  it("« Tout valider » valide toutes les photos lues", async () => {
    const res = await admin("post", "/sets/TST-03/validate-all");
    expect(res.body.validated).toBe(2);
    const { body: set } = await admin("get", "/sets/TST-03");
    expect(set.items.every((i) => i.validated)).toBe(true);
    for (const item of set.items) await admin("patch", `/items/${item.id}`).send({ validated: false });
  });

  it("refuse deux photos de la même carte", async () => {
    const { body: set } = await admin("get", "/sets/TST-03");
    const [a, b] = set.items;
    await admin("patch", `/items/${b.id}`).send({ rarity: a.rarity, number: a.number });
    for (const item of set.items) await admin("patch", `/items/${item.id}`).send({ validated: true });
    const res = await admin("post", "/sets/TST-03/publish");
    expect(res.status).toBe(400);
    expect(res.body.problems.join("\n")).toMatch(/même carte/);
    await admin("patch", `/items/${b.id}`).send({ rarity: "R", number: "1" });
  });

  it("publie le set : les cartes apparaissent dans le guide avec leur produit", async () => {
    const res = await admin("post", "/sets/TST-03/publish");
    expect(res.status).toBe(200);
    expect(res.body.published).toBe(2);

    const cards = await request(app).get("/sets/TST-03/cards");
    expect(cards.status).toBe(200);
    expect(cards.body.map((c) => [c.id, c.rarity_rank, c.product_url])).toEqual([
      ["TST03-SSR-012", 1, "https://shop.test/gojo-ssr-012"],
      ["TST03-R-001", 2, "https://shop.test/manuel"],
    ]);
    expect(cards.body[0].image_url).toMatch(/^\/images\/TST-03\/.+\.webp$/);
    // La photo est servie par /images
    expect((await request(app).get(cards.body[0].image_url)).status).toBe(200);
  });

  it("retirer une rareté encore utilisée par des cartes publiées est refusé", async () => {
    const res = await admin("put", "/sets/TST-03/rarities").send({ order: ["SSR"] });
    expect(res.status).toBe(400);
  });

  it("changer l'ordre des raretés d'un set publié met à jour le guide", async () => {
    const res = await admin("put", "/sets/TST-03/rarities").send({ order: ["R", "SSR"] });
    expect(res.status).toBe(200);
    const cards = await request(app).get("/sets/TST-03/cards");
    expect(cards.body.map((c) => c.id)).toEqual(["TST03-R-001", "TST03-SSR-012"]);
  });

  it("retirer le set du guide le cache sans perdre les cartes", async () => {
    await admin("post", "/sets/TST-03/unpublish");
    expect((await request(app).get("/sets/TST-03")).status).toBe(404);
    const { body: sets } = await admin("get", "/sets");
    expect(sets.find((s) => s.code === "TST-03")).toMatchObject({ status: "draft", card_count: 2 });
  });

  it("publier un set qui a déjà des cartes (seed) ne les supprime pas", async () => {
    // JJK-01 : une carte venue du seed + une photo importée de la même carte et d'une nouvelle
    await pool.query(
      `INSERT INTO cards (id, name, set_code, number, rarity, image_url)
       VALUES ('JJK01-R-001', 'Sukuna', 'JJK-01', '001', 'R', '/images/photo01_carte01.webp'),
              ('JJK01-R-002', 'Panda', 'JJK-01', '002', 'R', '/images/photo01_carte02.webp')`,
    );
    const upload = await admin("post", "/sets/JJK-01/photos").attach("photos", await png("gojo.jpg"), "gojo.jpg");
    await kickQueue();
    const item = upload.body.created[0];
    // Meilleure photo de Sukuna (R-001)
    await admin("patch", `/items/${item.id}`).send({ name: "Sukuna", rarity: "R", number: "001", validated: true });

    const res = await admin("post", "/sets/JJK-01/publish");
    expect(res.status).toBe(200);
    const cards = await request(app).get("/sets/JJK-01/cards");
    expect(cards.body.map((c) => c.id)).toEqual(["JJK01-R-001", "JJK01-R-002"]);
    expect(cards.body[0].image_url).toBe(`/images/JJK-01/${item.image_file}`);
    expect(cards.body[1].image_url).toBe("/images/photo01_carte02.webp");
  });

  it("id de photo invalide : 400", async () => {
    expect((await admin("patch", "/items/abc").send({})).status).toBe(400);
  });

  it("supprimer un set : refusé tant qu'il est en ligne ou sans confirmation", async () => {
    await admin("post", "/sets").send({ code: "DEL-01", name: "À supprimer", game_code: "DEL-GAME", game_name: "Jeu à supprimer" });
    await admin("put", "/sets/DEL-01/rarities").send({ order: ["R"] });
    const up = await admin("post", "/sets/DEL-01/photos").attach("photos", await png("yuji.jpg"), "yuji.jpg");
    await kickQueue();
    await admin("patch", `/items/${up.body.created[0].id}`).send({ name: "X", rarity: "R", number: "1", validated: true });
    expect((await admin("post", "/sets/DEL-01/publish")).status).toBe(200);

    expect((await admin("delete", "/sets/DEL-01").send({ confirm: "DEL-01" })).status).toBe(409);
    await admin("post", "/sets/DEL-01/unpublish");
    expect((await admin("delete", "/sets/DEL-01").send({ confirm: "mauvais" })).status).toBe(400);
    expect((await admin("delete", "/sets/DEL-01").send({})).status).toBe(400);
  });

  it("supprimer un set efface cartes, raretés, photos, dossier et le jeu devenu vide", async () => {
    const res = await admin("delete", "/sets/DEL-01").send({ confirm: "DEL-01" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: "DEL-01", cards: 1, photos: 1 });
    expect(existsSync(join(IMAGES_DIR, "DEL-01"))).toBe(false);
    const { rows } = await pool.query(
      `SELECT (SELECT COUNT(*) FROM cards WHERE set_code = 'DEL-01')::int AS cards,
              (SELECT COUNT(*) FROM rarities WHERE set_code = 'DEL-01')::int AS rarities,
              (SELECT COUNT(*) FROM games WHERE code = 'DEL-GAME')::int AS games`,
    );
    expect(rows[0]).toEqual({ cards: 0, rarities: 0, games: 0 });
    expect((await admin("get", "/sets/DEL-01")).status).toBe(404);
    // Les autres sets ne sont pas touchés
    expect((await admin("get", "/sets/TST-03")).status).toBe(200);
  });

  it("503 clair si WooCommerce n'est pas configuré", async () => {
    setServices({ wooConfigured: () => false });
    const res = await admin("post", "/sets/TST-03/products");
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/WOO_URL/);
  });
});
