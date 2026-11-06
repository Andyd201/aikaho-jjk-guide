import { createContext, useContext } from "react";

// Traduction de l'interface. La langue est choisie toute seule :
// 1. le choix du visiteur (bouton FR/EN), gardé dans son navigateur ;
// 2. sinon la langue de son navigateur : français → fr, tout le reste → en.
// Les titres et descriptions pour Google restent en anglais (les recherches se font en anglais).
export const LANGS = ["fr", "en"];

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export const MESSAGES = {
  fr: {
    loading: "Chargement…",
    allGames: "← Tous les jeux",
    backToSet: "← Retour au set",
    cards: (n) => plural(n, "carte", "cartes"),
    sets: (n) => plural(n, "set", "sets"),
    released: (date) => `Sortie ${date}`,
    shop: "Voir la boutique →",
    pageNotFound: "Page introuvable.",
    homeEyebrow: "Base de cartes",
    homeTitle: "Cartes TCG asiatiques",
    homeSubtitle: "Japon · Corée · Chine",
    homeLead: "Toutes les cartes des sets japonais, coréens et chinois : images, numéros et raretés, set par set.",
    partnerShop: "Boutique partenaire : Eyesight Collectibles",
    setsError: "Impossible de charger les sets.",
    noSets: "Aucun set pour l'instant.",
    gameEyebrow: "Jeu",
    gameError: "Impossible de charger le jeu.",
    gameNotFound: "Jeu introuvable.",
    gameBanner: (game) => `Procure-toi du ${game} chez Eyesight`,
    setError: "Impossible de charger le set.",
    setNotFound: "Set introuvable.",
    noCards: "Aucune carte pour l'instant.",
    noMatch: "Aucune carte ne correspond.",
    clearFilters: "Effacer les filtres",
    setBanner: (set) => `Procure-toi tes boîtes ${set} chez Eyesight`,
    searchPlaceholder: "Rechercher un personnage…",
    searchLabel: "Rechercher un personnage",
    rarityFilterLabel: "Filtrer par rareté",
    cardError: "Impossible de charger la carte.",
    cardNotFound: "Carte introuvable.",
    cardNumber: (n) => `n° ${n}`,
    cardBanner: "Procure-toi cette carte chez Eyesight",
    aboutTitle: (set) => `À propos du set ${set}`,
    aboutText: ({ set, game, cardCount, rarityCount, rarest, commonest }) =>
      `${set} est un set de cartes à collectionner de ${game}. Ce guide présente les ${cardCount} cartes du set ` +
      `avec leur image, leur numéro et leur rareté. Le set compte ${plural(rarityCount, "rareté", "raretés")}` +
      (rarityCount > 1 ? `, de ${rarest} (la plus rare) à ${commonest} (la plus commune).` : "."),
    raritiesTitle: "Raretés et nombre de cartes",
    rarity: "Rareté",
    cardsColumn: "Cartes",
    language: "Langue",
    dateLocale: "fr-CA",
  },
  en: {
    loading: "Loading…",
    allGames: "← All games",
    backToSet: "← Back to set",
    cards: (n) => plural(n, "card", "cards"),
    sets: (n) => plural(n, "set", "sets"),
    released: (date) => `Released ${date}`,
    shop: "Visit the shop →",
    pageNotFound: "Page not found.",
    homeEyebrow: "Card database",
    homeTitle: "Asian TCG cards",
    homeSubtitle: "Japan · Korea · China",
    homeLead: "Every card from Japanese, Korean and Chinese sets: images, card numbers and rarities, set by set.",
    partnerShop: "Partner shop: Eyesight Collectibles",
    setsError: "Couldn't load the sets.",
    noSets: "No sets yet.",
    gameEyebrow: "Game",
    gameError: "Couldn't load the game.",
    gameNotFound: "Game not found.",
    gameBanner: (game) => `Get ${game} cards at Eyesight`,
    setError: "Couldn't load the set.",
    setNotFound: "Set not found.",
    noCards: "No cards yet.",
    noMatch: "No card matches.",
    clearFilters: "Clear filters",
    setBanner: (set) => `Get your ${set} boxes at Eyesight`,
    searchPlaceholder: "Search a character…",
    searchLabel: "Search a character",
    rarityFilterLabel: "Filter by rarity",
    cardError: "Couldn't load the card.",
    cardNotFound: "Card not found.",
    cardNumber: (n) => `No. ${n}`,
    cardBanner: "Get this card at Eyesight",
    aboutTitle: (set) => `About the ${set} set`,
    aboutText: ({ set, game, cardCount, rarityCount, rarest, commonest }) =>
      `${set} is a trading card set from ${game}. This guide lists all ${cardCount} cards of the set ` +
      `with their image, card number and rarity. The set has ${plural(rarityCount, "rarity", "rarities")}` +
      (rarityCount > 1 ? `, from ${rarest} (the rarest) to ${commonest} (the most common).` : "."),
    raritiesTitle: "Rarities and card count",
    rarity: "Rarity",
    cardsColumn: "Cards",
    language: "Language",
    dateLocale: "en-CA",
  },
};

const STORAGE_KEY = "lang";

export function detectLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {
    /* navigation privée : on se fie au navigateur */
  }
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  return preferred.some((l) => l?.toLowerCase().startsWith("fr")) ? "fr" : "en";
}

export function saveLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* pas grave : le choix ne sera juste pas retenu */
  }
}

export const LanguageContext = createContext({ lang: "en", setLang: () => {} });

// const { t, lang, setLang } = useT();  →  t.loading, t.cards(3)…
export function useT() {
  const { lang, setLang } = useContext(LanguageContext);
  return { lang, setLang, t: MESSAGES[lang] };
}
