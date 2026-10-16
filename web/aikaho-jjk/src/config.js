// src/config.js (ou en haut de EyesightBanner.jsx)
export const EYESIGHT_URL =
  "https://eyesightcollectibles.com/product/aikaho-jujutsu-kaisen-jjk-01-booster-box-anime-trading-cards/";

// URL publique du site, sans / à la fin : sert aux canonical et à l'Open Graph
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "").replace(/\/$/, "");
export const SITE_NAME = "Aikaho JJK Card Guide";
export const SET_NAME = "Aikaho Jujutsu Kaisen JJK-01";
