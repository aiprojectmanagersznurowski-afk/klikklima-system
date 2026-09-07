import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Wymaganie: CRM-DELETE-ADMIN-ONLY-CREWS (contracts/requirements.contract.mjs).
 *
 * AC dla tego wymagania wymaga trzech NIEZALEŻNYCH warstw ochrony usunięcia zespołu
 * montażowego: UI (przycisk usuwania widoczny wyłącznie dla `admin`), Server Action
 * (bramkowana `can(role, 'crews', 'delete')`) i RLS ("bezpośredni DELETE na tabeli
 * zespoly_monterskie rolą nie-admin jest odrzucony przez bazę"). Pierwsze dwie warstwy
 * mają dedykowane testy jednostkowe/integracyjne gdzie indziej w tym pakiecie — tego
 * pliku brakowało: warstwa RLS była dotąd potwierdzona tylko przez wnioskowanie
 * z braku polityki, bez testu, który by to zamroził i wykrył regresję.
 *
 * BRAK DOCKERA/PSQL/SUPABASE CLI w tym środowisku: test integracyjny wykonujący
 * prawdziwy `DELETE FROM zespoly_monterskie` jako rola `anon`/`authenticated` na żywym
 * Postgresie jest tu niewykonalny (to samo ograniczenie co w
 * rls-deny-by-default-freeze.test.ts — przeczytaj ten plik jako wzorzec). Jedynym
 * wykonalnym testem jest ASERCJA STATYCZNA nad treścią pliku migracji
 * `20260824185845_security_enable_rls_baseline.sql` jako tekstu.
 *
 * Stan żywej bazy zweryfikowany BEZPOŚREDNIM zapytaniem w tej sesji (2026-09-07):
 * `zespoly_monterskie` ma `relrowsecurity = true` i ZERO wierszy w `pg_policies` dla
 * tej tabeli. W Postgresie RLS włączone bez żadnej polityki oznacza odmowę WSZYSTKICH
 * operacji (SELECT/INSERT/UPDATE/DELETE) dla każdej roli poza tą, która omija RLS
 * (`service_role`/`postgres` z `rolbypassrls`). Treść pliku migracji i stan żywej
 * bazy są dziś zgodne — ten test zamraża treść pliku, która jest źródłem tego stanu.
 *
 * Potwierdzenie mutacyjne (wykonane ręcznie w scratchpadzie, NIE zacommitowane):
 * dopisanie do lokalnej kopii pliku
 *   CREATE POLICY "tmp" ON public.zespoly_monterskie FOR ALL TO authenticated USING (true);
 * bezpośrednio po `ALTER TABLE public.zespoly_monterskie ENABLE ROW LEVEL SECURITY;`
 * powoduje FAIL testu AC-CREWS-RLS.2 poniżej (liczba wystąpień `CREATE POLICY` w bloku
 * sekcji 1 przechodzi z 0 na 1, i pojawia się dopasowanie `ON public.zespoly_monterskie`
 * w globalnym przeszukaniu policyChunks). Lokalna kopia w scratchpadzie usunięta po
 * weryfikacji, plik w repozytorium nietknięty.
 */

function readMigration(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const migrationPath = join(
    __dirname,
    '..',
    '..',
    '..',
    'supabase',
    'migrations',
    '20260824185845_security_enable_rls_baseline.sql',
  );
  return readFileSync(migrationPath, 'utf-8');
}

describe('RLS deny-by-default zamrożone na zespoly_monterskie (CRM-DELETE-ADMIN-ONLY-CREWS)', () => {
  // @REQ: CRM-DELETE-ADMIN-ONLY-CREWS
  it('AC-CREWS-RLS.1: zespoly_monterskie — ENABLE ROW LEVEL SECURITY jest obecne w migracji', () => {
    const sql = readMigration();
    expect(sql).toContain('ALTER TABLE public.zespoly_monterskie   ENABLE ROW LEVEL SECURITY;');
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-CREWS
  it('AC-CREWS-RLS.2: zespoly_monterskie leży w bloku "tabele bez konsumenta supabase-js" z zerem CREATE POLICY', () => {
    const sql = readMigration();
    // Blok sekcji 1 to grupa ośmiu ALTER TABLE ... ENABLE bez żadnej polityki, od
    // `zespoly_monterskie` (pierwsza w grupie) do początku sekcji 2 (bramka logowania).
    const startMarker = 'ALTER TABLE public.zespoly_monterskie   ENABLE ROW LEVEL SECURITY;';
    const startIdx = sql.indexOf(startMarker);
    expect(startIdx).toBeGreaterThan(-1);

    const sectionEndMarker = 'ALTER TABLE public."AuthorizedUser" ENABLE ROW LEVEL SECURITY;';
    const endIdx = sql.indexOf(sectionEndMarker, startIdx);
    expect(endIdx).toBeGreaterThan(startIdx);

    const crewsSectionBlock = sql.slice(startIdx, endIdx);

    // Cała sekcja 1 (osiem tabel) ma zero wystąpień CREATE POLICY jakiegokolwiek typu —
    // nie tylko FOR DELETE. Zero polityk oznacza odmowę wszystkiego, nie tylko usuwania.
    expect((crewsSectionBlock.match(/CREATE POLICY/g) ?? []).length).toBe(0);
    expect(crewsSectionBlock).toContain('ALTER TABLE public.zespoly_monterskie   ENABLE ROW LEVEL SECURITY;');
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-CREWS
  it('AC-CREWS-RLS.3 (dowód globalny): w CAŁYM pliku żadna polityka CREATE POLICY nie wskazuje public.zespoly_monterskie', () => {
    const sql = readMigration();
    const policyChunks = sql.split('CREATE POLICY').slice(1);
    const anyPolicyOnCrews = policyChunks.filter((chunk) => {
      const header = chunk.split('\n\n')[0] ?? chunk.slice(0, 200);
      return /ON public\.zespoly_monterskie\b/.test(header);
    });

    expect(anyPolicyOnCrews).toEqual([]);
  });
});
