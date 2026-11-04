import { join } from "node:path";

// Dans Docker : /app/images (via docker-compose). En local : <racine du repo>/images
export const IMAGES_DIR = process.env.IMAGES_DIR ?? join(import.meta.dirname, "../../images");
