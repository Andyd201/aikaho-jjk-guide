import { describe, it, expect } from "vitest";
import { matchProduct } from "./woo.js";

const p = (name) => ({ name, url: `https://shop.test/${encodeURIComponent(name)}` });
const card = { rarity: "SSR", number: "012", setCode: "JJK-02", gameName: "Aikaho Jujutsu Kaisen" };

describe("matchProduct", () => {
  it("choisit le seul produit qui contient le code et le jeu", () => {
    const { match } = matchProduct([p("Satoru Gojo SSR-012 Aikaho Jujutsu Kaisen"), p("Booster box JJK-02")], card);
    expect(match.name).toBe("Satoru Gojo SSR-012 Aikaho Jujutsu Kaisen");
  });

  it("accepte les variantes d'écriture du code (espace, sans tiret, minuscules)", () => {
    expect(matchProduct([p("Gojo ssr 012 Jujutsu")], card).match).not.toBeNull();
    expect(matchProduct([p("Gojo SSR012 JJK02")], card).match).not.toBeNull();
  });

  it("ne confond pas SR-012 avec SSR-012, ni 012 avec 0123", () => {
    expect(matchProduct([p("Gojo SSR-012 JJK-02")], { ...card, rarity: "SR" }).match).toBeNull();
    expect(matchProduct([p("Gojo SSR-0123 JJK-02")], card).match).toBeNull();
  });

  it("un seul produit avec le code mais d'un autre jeu : pas de choix automatique", () => {
    const { match, candidates } = matchProduct([p("Naruto Kayou SSR-012")], card);
    expect(match).toBeNull();
    expect(candidates).toHaveLength(1);
  });

  it("plusieurs produits : garde celui du bon set", () => {
    const { match } = matchProduct([p("Gojo SSR-012 Jujutsu JJK-01"), p("Gojo SSR-012 Jujutsu JJK02")], card);
    expect(match.name).toBe("Gojo SSR-012 Jujutsu JJK02");
  });

  it("plusieurs produits du jeu sans indice du set : aucun choix automatique, tous proposés", () => {
    const { match, candidates } = matchProduct([p("Gojo SSR-012 Jujutsu"), p("Gojo SSR-012 Jujutsu foil")], card);
    expect(match).toBeNull();
    expect(candidates).toHaveLength(2);
  });

  it("un code de rareté avec des caractères spéciaux ne fait pas planter", () => {
    expect(() => matchProduct([p("Gojo SR+-012")], { ...card, rarity: "SR+" })).not.toThrow();
    expect(matchProduct([p("Gojo SRR-012 JJK-02")], { ...card, rarity: "SR+" }).match).toBeNull();
  });

  it("aucun produit avec le code", () => {
    expect(matchProduct([p("Booster box")], card)).toEqual({ match: null, candidates: [] });
  });
});
