import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { app } from "../app.js";
import { pool } from "../db.js";
import { RARITIES } from "../rarities.js";

const TEST_CARDS = [
  { id: "JJK01-ACE-001", name: "Yuta Okkotsu", rarity: "ACE", number: "001" },
  { id: "JJK01-CHR-001", name: "Satoru Gojo", rarity: "CHR", number: "001" },
  { id: "JJK01-SSR-001", name: "Satoru Gojo", rarity: "SSR", number: "001" },
  { id: "JJK01-R-001", name: "Sukuna", rarity: "R", number: "001" },
  { id: "JJK01-R-002", name: "Panda", rarity: "R", number: "002" },
  { id: "JJK01-SE-001", name: "Yuji Itadori", rarity: "SE", number: "001" },
];

beforeAll(async () => {
  // Garde-fou : le DROP TABLE ne doit jamais toucher la vraie base
  if (!process.env.DATABASE_URL?.includes("_test")) {
    throw new Error("DATABASE_URL doit pointer vers une base *_test");
  }

  await pool.query("DROP TABLE IF EXISTS cards");
  const initSql = readFileSync(
    join(import.meta.dirname, "../../../db/init.sql"),
    "utf8",
  );
  await pool.query(initSql);

  for (const card of TEST_CARDS) {
    await pool.query(
      `INSERT INTO cards (id, name, set_code, number, rarity, rarity_rank)
       VALUES ($1, $2, 'JJK-01', $3, $4, $5)`,
      [card.id, card.name, card.number, card.rarity, RARITIES.indexOf(card.rarity) + 1],
    );
  }
});

afterAll(async () => {
  await pool.end();
});

describe("GET /cards", () => {
  it("retourne toutes les cartes triées par rareté puis numéro", async () => {
    const res = await request(app).get("/cards");

    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.id)).toEqual([
      "JJK01-ACE-001",
      "JJK01-CHR-001",
      "JJK01-SE-001",
      "JJK01-SSR-001",
      "JJK01-R-001",
      "JJK01-R-002",
    ]);
  });

  it("filtre par search (insensible à la casse)", async () => {
    const res = await request(app).get("/cards?search=gojo");

    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.id)).toEqual(["JJK01-CHR-001", "JJK01-SSR-001"]);
  });

  it("filtre par une rareté", async () => {
    const res = await request(app).get("/cards?rarity=R");

    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.id)).toEqual(["JJK01-R-001", "JJK01-R-002"]);
  });

  it("filtre par plusieurs raretés", async () => {
    const res = await request(app).get("/cards?rarity=ACE,SE");

    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.id)).toEqual(["JJK01-ACE-001", "JJK01-SE-001"]);
  });

  it("combine search et rarity", async () => {
    const res = await request(app).get("/cards?search=gojo&rarity=SSR");

    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.id)).toEqual(["JJK01-SSR-001"]);
  });

  it("400 si la rareté est inconnue", async () => {
    const res = await request(app).get("/cards?rarity=XYZ");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Rareté inconnue : XYZ");
  });

  it("400 si search est un tableau", async () => {
    const res = await request(app).get("/cards?search=a&search=b");

    expect(res.status).toBe(400);
  });

  // Régression : un tableau dans rarity faisait planter rarity.split
  it("400 si rarity est un tableau", async () => {
    const res = await request(app).get("/cards?rarity=ACE&rarity=CHR");

    expect(res.status).toBe(400);
  });

  it("ne renvoie pas created_at ni description", async () => {
    const res = await request(app).get("/cards");

    expect(res.body[0]).not.toHaveProperty("created_at");
    expect(res.body[0]).not.toHaveProperty("description");
  });
});

describe("GET /cards/:id", () => {
  it("retourne la carte demandée", async () => {
    const res = await request(app).get("/cards/JJK01-SE-001");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: "JJK01-SE-001",
      name: "Yuji Itadori",
      set_code: "JJK-01",
      number: "001",
      rarity: "SE",
      rarity_rank: 4,
      image_url: null,
    });
  });

  it("404 si la carte n'existe pas", async () => {
    const res = await request(app).get("/cards/JJK99-R-999");

    expect(res.status).toBe(404);
  });
});

describe("GET /rarities", () => {
  it("retourne les 11 raretés avec leur rang", async () => {
    const res = await request(app).get("/rarities");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(11);
    expect(res.body[0]).toEqual({ code: "ACE", rank: 1 });
    expect(res.body[10]).toEqual({ code: "R", rank: 11 });
  });
});

describe("Route inconnue", () => {
  it("répond 404 en JSON", async () => {
    const res = await request(app).get("/route-qui-existe-pas");

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toEqual({ error: "Route introuvable" });
  });
});
