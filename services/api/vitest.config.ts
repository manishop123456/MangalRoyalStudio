import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Per-run random seed passwords (no credentials in source).
    setupFiles: ['./src/test-support/seed-credentials.setup.ts'],
  },
});
