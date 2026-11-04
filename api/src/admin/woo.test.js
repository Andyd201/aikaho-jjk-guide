import { describe, it, expect } from "vitest";
import { matchProduct } from "./woo.js";

const p = (name) => ({ name, url: `https://shop.test/${encodeURIComponent(name)}` });
const card = { rarity: "SSR", number: "012", setCode: "JJK-02" };

describe("matchProduct", () => {
  it("choisit le seul produit qui contient le code", () => {
    const { match } = matchProduct([p("Satoru Gojo SSR-012 Aikaho JJK"), p("Booster box JJK-02")], card);
    expect(match.name).toBe("Satoru Gojo SSR-012 Aikaho JJK");
  });

  it("accepte les variantes d'écriture du code (espace, sans tiret, minuscules)", () => {
    expect(matchProduct([p("Gojo ssr 012")], card).match).not.toBeNull();
    expect(matchProduct([p("Gojo SSR012")], card).match).not.toBeNull();
  });

  it("ne confond pas SR-012 avec SSR-012, ni 012 avec 0123", () => {
    expect(matchProduct([p("Gojo SSR-012")], { ...card, rarity: "SR" }).match).toBeNull();
    expect(matchProduct([p("Gojo SSR-0123")], card).match).toBeNull();
  });

  it("plusieurs produits : garde celui du bon set", () => {
    const { match } = matchProduct([p("Gojo SSR-012 JJK-01"), p("Gojo SSR-012 JJK02")], card);
    expect(match.name).toBe("Gojo SSR-012 JJK02");
  });

  it("plusieurs produits sans indice du set : aucun choix automatique, tous proposés", () => {
    const { match, candidates } = matchProduct([p("Gojo SSR-012"), p("Gojo SSR-012 foil")], card);
    expect(match).toBeNull();
    expect(candidates).toHaveLength(2);
  });

  it("aucun produit avec le code", () => {
    expect(matchProduct([p("Booster box")], card)).toEqual({ match: null, candidates: [] });
  });
});
