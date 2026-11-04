import { describe, it, expect } from "vitest";
import { extractCard } from "./vision.js";

describe("extractCard", () => {
  it("prend le résultat de l'outil record_card", () => {
    const card = extractCard({
      content: [
        { type: "text", text: "Je lis la carte." },
        { type: "tool_use", name: "record_card", input: { name: "Gojo", rarity: "SSR", number: "12", confidence: "high" } },
      ],
    });
    expect(card).toEqual({ name: "Gojo", rarity: "SSR", number: "12", confidence: "high" });
  });

  it("sinon, récupère le JSON écrit dans le texte", () => {
    const card = extractCard({
      content: [{ type: "text", text: 'Voici : ```json\n{"name":"Yuji","rarity":"R","number":"1","confidence":"medium"}\n```' }],
    });
    expect(card).toMatchObject({ name: "Yuji", rarity: "R" });
  });

  it("erreur claire si la réponse ne contient rien d'utilisable", () => {
    expect(() => extractCard({ content: [{ type: "text", text: "Je ne vois pas de carte." }] })).toThrow(/Relancer/);
  });
});
