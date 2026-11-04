import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { pool } from "../db.js";
import { resetTestDatabase } from "../test-db.js";

// JJK-01 vient de la migration. On ajoute :
// - TST-01 (publié) : un autre jeu, où SR est la rareté la plus rare (rang 1)
// - TST-02 (brouillon) : ne doit apparaître nulle part
beforeAll(async () => {
  await resetTestDatabase();

  await pool.query(`
    INSERT INTO games (code, name) VALUES ('TEST', 'Jeu de test');
    INSERT INTO sets (code, game_code, name, status, product_url) VALUES
      ('TST-01', 'TEST', 'Test Set 01', 'published', 'https://example.com/tst-01'),
      ('TST-02', 'TEST', 'Test Set 02', 'draft', NULL);
    INSERT INTO rarities (set_code, code, rank) VALUES
      ('TST-01', 'SR', 1), ('TST-01', 'C', 2),
      ('TST-02', 'C', 1);
    INSERT INTO cards (id, name, set_code, number, rarity, product_url) VALUES
      ('JJK01-SR-001', 'Nobara Kugisaki', 'JJK-01', '001', 'SR', NULL),
      ('JJK01-SE-001', 'Yuji Itadori', 'JJK-01', '001', 'SE', NULL),
      ('TST01-C-001', 'Gojo commun', 'TST-01', '001', 'C', NULL),
      ('TST01-SR-001', 'Gojo rare', 'TST-01', '001', 'SR', 'https://example.com/gojo-sr'),
      ('TST02-C-001', 'Carte cachée', 'TST-02', '001', 'C', NULL);
  `);
});

afterAll(async () => {
  await pool.end();
});

describe("GET /games", () => {
  it("liste les jeux qui ont au moins un set publié", async () => {
    const res = await request(app).get("/games");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { code: "AIKAHO-JJK", name: "Aikaho Jujutsu Kaisen", set_count: 1 },
      { code: "TEST", name: "Jeu de test", set_count: 1 },
    ]);
  });
});

describe("GET /sets", () => {
  it("liste seulement les sets publiés, avec leur nombre de cartes", async () => {
    const res = await request(app).get("/sets");

    expect(res.status).toBe(200);
    expect(res.body.map((s) => [s.code, s.card_count])).toEqual([
      ["JJK-01", 2],
      ["TST-01", 2],
    ]);
  });

  it("filtre par jeu", async () => {
    const res = await request(app).get("/sets?game=TEST");

    expect(res.body.map((s) => s.code)).toEqual(["TST-01"]);
  });
});

describe("GET /sets/:code", () => {
  it("retourne le set et ses raretés dans l'ordre, avec le nombre de cartes", async () => {
    const res = await request(app).get("/sets/TST-01");

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Test Set 01");
    expect(res.body.game_name).toBe("Jeu de test");
    expect(res.body.rarities).toEqual([
      { code: "SR", rank: 1, card_count: 1 },
      { code: "C", rank: 2, card_count: 1 },
    ]);
  });

  it("JJK-01 garde ses 11 raretés, SE en premier", async () => {
    const res = await request(app).get("/sets/JJK-01/rarities");

    expect(res.body).toHaveLength(11);
    expect(res.body[0]).toMatchObject({ code: "SE", rank: 1 });
    expect(res.body[10]).toMatchObject({ code: "R", rank: 11 });
  });

  it("404 pour un set inexistant ou en brouillon", async () => {
    expect((await request(app).get("/sets/NOPE")).status).toBe(404);
    expect((await request(app).get("/sets/TST-02")).status).toBe(404);
    expect((await request(app).get("/sets/TST-02/cards")).status).toBe(404);
  });
});

describe("GET /sets/:code/cards", () => {
  it("le rang d'une rareté dépend du set", async () => {
    const jjk = await request(app).get("/sets/JJK-01/cards");
    const tst = await request(app).get("/sets/TST-01/cards");

    expect(jjk.body.map((c) => [c.id, c.rarity_rank])).toEqual([
      ["JJK01-SE-001", 1],
      ["JJK01-SR-001", 9],
    ]);
    expect(tst.body.map((c) => [c.id, c.rarity_rank])).toEqual([
      ["TST01-SR-001", 1],
      ["TST01-C-001", 2],
    ]);
  });

  it("le lien produit de la carte passe avant celui du set", async () => {
    const res = await request(app).get("/sets/TST-01/cards");

    expect(res.body.find((c) => c.id === "TST01-SR-001").product_url).toBe("https://example.com/gojo-sr");
    expect(res.body.find((c) => c.id === "TST01-C-001").product_url).toBe("https://example.com/tst-01");
  });

  it("400 si la rareté n'existe pas dans ce set", async () => {
    const res = await request(app).get("/sets/TST-01/cards?rarity=SE");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Rareté inconnue : SE");
  });

  it("combine search et rarity dans le set", async () => {
    const res = await request(app).get("/sets/TST-01/cards?search=gojo&rarity=C");

    expect(res.body.map((c) => c.id)).toEqual(["TST01-C-001"]);
  });
});

describe("Sets en brouillon", () => {
  it("leurs cartes ne sortent ni dans /cards ni dans /cards/:id", async () => {
    const all = await request(app).get("/cards");
    expect(all.body.map((c) => c.id)).not.toContain("TST02-C-001");
    expect((await request(app).get("/cards/TST02-C-001")).status).toBe(404);
  });
});

describe("Contraintes de la BD", () => {
  it("refuse une carte avec une rareté qui n'existe pas dans son set", async () => {
    await expect(
      pool.query(
        `INSERT INTO cards (id, name, set_code, number, rarity) VALUES ('X', 'X', 'TST-01', '001', 'SE')`,
      ),
    ).rejects.toThrow(/cards_rarity_fk/);
  });
});
