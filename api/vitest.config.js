import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tous les fichiers de test partagent la même base *_test : un seul à la fois
    fileParallelism: false,
  },
});
