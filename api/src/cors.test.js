import { describe, it, expect } from "vitest";
import { parseOrigins } from "./app.js";

describe("parseOrigins", () => {
  it("retourne une liste vide si rien n'est configuré", () => {
    expect(parseOrigins(undefined)).toEqual([]);
    expect(parseOrigins("")).toEqual([]);
  });

  it("accepte une seule origine", () => {
    expect(parseOrigins("https://aikaho-jjk-guide.onrender.com")).toEqual([
      "https://aikaho-jjk-guide.onrender.com",
    ]);
  });

  it("sépare plusieurs origines, enlève les espaces et le / final", () => {
    expect(
      parseOrigins("https://aikaho-jjk-guide.onrender.com, https://guide.eyesightcollectibles.com/"),
    ).toEqual(["https://aikaho-jjk-guide.onrender.com", "https://guide.eyesightcollectibles.com"]);
  });
});
