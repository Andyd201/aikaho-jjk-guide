import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tous les fichiers de test partagent la même base *_test : un seul à la fois
    fileParallelism: false,
    env: {
      // Les photos importées pendant les tests vont dans un dossier temporaire, pas dans images/
      IMAGES_DIR: join(tmpdir(), "aikaho-test-images"),
    },
  },
});
