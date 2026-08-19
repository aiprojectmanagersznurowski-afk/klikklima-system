import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Rozdział odpowiedzialności testów w monorepo KlikKlima:
 *   *.test.ts  → vitest   (jednostkowe i kontraktowe, warstwa 3 bramki)
 *   *.spec.ts  → Playwright (E2E, osobny runner: npm run test:e2e)
 *
 * Bez tego rozdziału vitest wciąga specyfikacje Playwrighta i wywala się na
 * `test.describe() was not expected to be called here`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@klikklima/contracts': fileURLToPath(
        new URL('./packages/contracts/src/generated/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/e2e/**',
      '**/tests/e2e/**',
      // examples/ to WZORCE do skopiowania, nie testy — importują celowo
      // nieistniejące moduły domenowe (np. @/server/leads/state-machine).
      'examples/**',
    ],
    // Bramka nie ma jeszcze własnych testów jednostkowych. Dopóki ich nie ma,
    // ten etap jest ZIELONY PUSTY — realnym miernikiem pokrycia jest kk-trace.
    passWithNoTests: true,
  },
});
