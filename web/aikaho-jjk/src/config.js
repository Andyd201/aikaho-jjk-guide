// Boutique partenaire : lien par défaut quand ni la carte ni le set n'ont de product_url (et sur l'accueil)
export const EYESIGHT_URL = "https://eyesightcollectibles.com/";

// URL publique du site, sans / à la fin : sert aux canonical et à l'Open Graph
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "").replace(/\/$/, "");
export const SITE_NAME = "Foreign Card TCG";

// Avant le multi-set, le guide n'avait que JJK-01 à la racine (/?rarity=ACE, /cards/:id).
// Ces vieux liens (partagés sur LinkedIn) sont redirigés vers ce set.
export const LEGACY_SET_CODE = "JJK-01";

export const HOME_TITLE = `${SITE_NAME} – Japanese, Korean & Chinese Trading Card Lists`;
// Sans la liste des sets : sert tant qu'ils ne sont pas chargés (ou si l'API est en panne)
export const HOME_DESCRIPTION =
  "Card lists for Asian trading card games (Japanese, Korean and Chinese sets): every card with its image, card number and rarity.";

// Titre et description d'un jeu dont on ne connaît que le code (chargement, erreur)
export function gameFallbackTitle(code) {
  return `${code} Card Lists – All Sets & Rarities | ${SITE_NAME}`;
}

// Titre et description d'un set dont on ne connaît que le code (chargement, erreur, set vide)
export function setFallbackTitle(code) {
  return `${code} Card List – All Cards & Rarities`;
}
export function setFallbackDescription(code) {
  return `Complete card list for the ${code} trading card set: every card with its image, card number and rarity.`;
}

// Titre japonais décoratif de l'en-tête, trouvé d'après le nom du jeu (aucun = pas de décor).
// Par le nom plutôt que le code : un nouveau jeu créé dans /admin l'a tout de suite.
const GAME_KANJI = [
  [/jujutsu/i, "呪術廻戦"],
  [/demon slayer|kimetsu/i, "鬼滅の刃"],
  [/one piece/i, "ワンピース"],
  [/naruto/i, "ナルト"],
  [/pok[eé]mon/i, "ポケモン"],
  [/dragon ball/i, "ドラゴンボール"],
];
export function gameKanji(gameName = "") {
  return GAME_KANJI.find(([pattern]) => pattern.test(gameName))?.[1] ?? null;
}
