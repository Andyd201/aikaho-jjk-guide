// Lien Eyesight par défaut : sert quand ni la carte ni le set n'ont de product_url (et sur l'accueil)
export const EYESIGHT_URL =
  "https://eyesightcollectibles.com/product/aikaho-jujutsu-kaisen-jjk-01-booster-box-anime-trading-cards/";

// URL publique du site, sans / à la fin : sert aux canonical et à l'Open Graph
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "").replace(/\/$/, "");
export const SITE_NAME = "Eyesight Card Guide";

// Avant le multi-set, le guide n'avait que JJK-01 à la racine (/?rarity=ACE, /cards/:id).
// Ces vieux liens (partagés sur LinkedIn) sont redirigés vers ce set.
export const LEGACY_SET_CODE = "JJK-01";

export const HOME_TITLE = `${SITE_NAME} – Anime Trading Card Lists & Rarities`;
// Sans la liste des sets : sert tant qu'ils ne sont pas chargés (ou si l'API est en panne)
export const HOME_DESCRIPTION =
  "Complete card lists for anime trading card sets: every card with its image, card number and rarity.";

// Titre et description d'un set dont on ne connaît que le code (chargement, erreur, set vide)
export function setFallbackTitle(code) {
  return `${code} Card List – All Cards & Rarities`;
}
export function setFallbackDescription(code) {
  return `Complete card list for the ${code} trading card set: every card with its image, card number and rarity.`;
}

// Kanji décoratif de l'en-tête, par jeu (aucun = pas de kanji)
export const GAME_KANJI = {
  "AIKAHO-JJK": "呪術廻戦", // « Jujutsu Kaisen »
};
