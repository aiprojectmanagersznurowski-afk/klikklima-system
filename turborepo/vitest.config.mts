import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Rozdział odpowiedzialności testów w monorepo KlikKlima:
 *   *.test.ts  → vitest   (jednostkowe i kontraktowe, warstwa 3 bramki, Prisma zamockowana)
 *   *.itest.ts → vitest.integration.config.mts (żywy Postgres — D-2, FLD-BOOKING-ATOMIC-ASSIGN)
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
      '@repo/pricing': fileURLToPath(
        new URL('./packages/pricing/src/index.ts', import.meta.url),
      ),
      // server-only rzuca zawsze poza warunkiem exports "react-server" (Next.js go
      // ustawia przy buildzie; Vitest nie). REVIEW SERVICE-ROLE-LEADS-PAGE: globalne
      // `resolve.conditions: ['react-server']` naprawiało to, ale zmieniało rozwiązywanie
      // modułów dla CAŁEGO monorepo — w tym react@19, który ma własny wariant
      // "react-server" bez useState/useEffect/createContext. Zamiast warunku globalnego,
      // podmieniamy WYŁĄCZNIE ten jeden pakiet na no-opowy stub — zero wpływu na resztę.
      'server-only': fileURLToPath(new URL('./tools/stubs/server-only.ts', import.meta.url)),
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
      // *.itest.ts nie kolidowałyby z `**/*.test.ts` (inny suffiks), ale wyłączenie
      // jest jawne: te testy potrzebują żywego Postgresa (DATABASE_URL) i mają własną
      // konfigurację (vitest.integration.config.mts) — nigdy nie powinny trafić tutaj.
      '**/*.itest.ts',
    ],
    // Bramka nie ma jeszcze własnych testów jednostkowych. Dopóki ich nie ma,
    // ten etap jest ZIELONY PUSTY — realnym miernikiem pokrycia jest kk-trace.
    passWithNoTests: true,
  },
});
