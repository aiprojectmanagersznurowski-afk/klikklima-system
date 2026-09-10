import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * D-2 (docs/workorders/FLD-BOOKING-ATOMIC-ASSIGN.md): testy współbieżności na
 * `bookings_no_overlap_per_resource` (i inne ograniczenia bazy) nie da się dowieść na
 * atrapie Prismy — atrapa dowodzi wyłącznie tego, jak została zaprogramowana, nie tego,
 * jak zachowuje się Postgres pod dwoma równoległymi żądaniami. Ta konfiguracja jest
 * DRUGIM, osobnym projektem vitest — zamierzenie, nie przez pominięcie:
 *
 *   *.test.ts  → vitest.config.mts (ten plik NIE dotyczy)  — Prisma zamockowana, bez sieci
 *   *.itest.ts → TA konfiguracja                            — żywy Postgres, DATABASE_URL wymagany
 *
 * Uruchomienie lokalne: `supabase start` w katalogu repo (aplikuje migracje z
 * `supabase/migrations/` automatycznie), potem `npm run test:integration`.
 * Uruchomienie w CI: job `integracja` w `.github/workflows/kk-gate.yml`.
 *
 * Ta konfiguracja NIE ma `passWithNoTests: true` — w odróżnieniu od `vitest.config.mts`,
 * zero testów integracyjnych przy istniejącym pliku `*.itest.ts` jest sygnałem błędu
 * konfiguracji (np. złej ścieżki `include`), nie prawdziwym brakiem testów.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@klikklima/contracts': fileURLToPath(
        new URL('./packages/contracts/src/generated/index.ts', import.meta.url),
      ),
      'server-only': fileURLToPath(new URL('./tools/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['**/*.itest.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/e2e/**', 'examples/**'],
    // Testy współbieżności otwierają realne połączenia równoległe do jednej bazy —
    // domyślna izolacja procesów vitest (workery) i wspólny stan bazy między testami
    // nie mieszają się dobrze z domyślnym paralelizmem plików testowych.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
