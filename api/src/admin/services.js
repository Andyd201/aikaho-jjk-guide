import { readCard } from "./vision.js";
import { searchProducts, wooConfigured } from "./woo.js";

// Les services externes (Claude, WooCommerce) passent par cet objet :
// les tests les remplacent par des faux, sans appel réseau ni frais.
export const services = { readCard, searchProducts, wooConfigured };

export function setServices(overrides) {
  Object.assign(services, overrides);
}
