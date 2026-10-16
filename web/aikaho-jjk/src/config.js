// src/config.js (ou en haut de EyesightBanner.jsx)
export const EYESIGHT_URL =
  "https://eyesightcollectibles.com/product/aikaho-jujutsu-kaisen-jjk-01-booster-box-anime-trading-cards/";

// URL publique du site, sans / à la fin : sert aux canonical et à l'Open Graph
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "").replace(/\/$/, "");
export const SITE_NAME = "Aikaho JJK Card Guide";
export const SET_NAME = "Aikaho Jujutsu Kaisen JJK-01";

// Sans le nombre de cartes : sert tant que les cartes ne sont pas chargées (ou si l'API est en panne)
export const SET_TITLE = `${SET_NAME} Card List – All Cards & Rarities`;
export const SET_DESCRIPTION = `Complete card list for the ${SET_NAME} set: every card with its image, card number and rarity.`;
