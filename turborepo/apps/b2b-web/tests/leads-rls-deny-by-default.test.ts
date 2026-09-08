import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Wymaganie: CRM-DELETE-ADMIN-ONLY-LEADS (contracts/requirements.contract.mjs).
 *
 * AC dla tego wymagania wymaga trzech NIEZALEŻNYCH warstw ochrony usunięcia leada: UI
 * (przycisk "Usuń (Tylko Admin)" widoczny wyłącznie dla `admin`, patrz
 * leads-delete-ui-gate.test.ts), Server Action (bramkowana `can(role, 'leads', 'delete')`,
 * patrz leads-delete-admin-only.test.ts) i RLS ("bezpośredni DELETE na tabeli leady rolą
 * nie-admin jest odrzucony przez bazę"). Pierwsze dwie warstwy mają dedykowane testy
 * jednostkowe/integracyjne gdzie indziej w tym pakiecie — tego pliku brakowało: warstwa RLS
 * była dotąd potwierdzona tylko przez wnioskowanie z braku polityki DELETE, bez dedykowanego
 * testu dla `leady`, który by to zamroził i wykrył regresję.
 *
 * BRAK DOCKERA/PSQL/SUPABASE CLI w tym środowisku: test integracyjny wykonujący prawdziwy
 * `DELETE FROM leady` jako rola `anon`/`authenticated` na żywym Postgresie jest tu
 * niewykonalny (to samo ograniczenie co w rls-deny-by-default-freeze.test.ts i
 * crews-rls-deny-by-default.test.ts — przeczytaj te pliki jako wzorzec). Jedynym
 * wykonalnym testem jest ASERCJA STATYCZNA nad treścią pliku migracji
 * `20260824185845_security_enable_rls_baseline.sql` jako tekstu.
 *
 * Ten plik już ma dedykowany test AC13.1a/AC13.1b w rls-deny-by-default-freeze.test.ts,
 * ale ten sprawdza wyłącznie ZERO wystąpień `FOR SELECT` na bloku `leady` — nie sprawdza
 * wprost `FOR DELETE` / `FOR ALL`. To luka analogiczna do tej domkniętej przez AC-A3 dla
 * `klienci` w tym samym pliku. Poniższy test domyka ją dla `leady`, wzorem
 * AC-CREWS-RLS.2/.3 dla `zespoly_monterskie`.
 *
 * Stan bloku `leady` w migracji (przeczytany bezpośrednio przed napisaniem tego testu):
 *   ALTER TABLE public.leady ENABLE ROW LEVEL SECURITY;
 *   DROP POLICY IF EXISTS "Allow anon insert on leady" ON public.leady;
 *   CREATE POLICY "Allow anon insert on leady" ON public.leady
 *     FOR INSERT TO anon WITH CHECK (true);
 * Dokładnie jedna polityka (INSERT dla `anon`), zero DELETE/ALL — RLS włączone bez
 * polityki DELETE oznacza odmowę usuwania dla każdej roli poza tą, która omija RLS
 * (`service_role`/`postgres` z `rolbypassrls`).
 *
 * POPRAWKA PO REVIEWIE (2026-09-08, patrz
 * .claude/agent-memory/reviewer/feedback_rls_freeze_test_whitelist.md): AC-LEADS-RLS.3
 * pierwotnie asertowała BLACKLISTĘ (zero `FOR DELETE`/`FOR ALL` na `public.leady`).
 * Mutation testing znalazło dwóch przeżywających mutantów, którzy realnie dają DELETE:
 * 1. `CREATE POLICY "x" ON public.leady TO authenticated USING (true);` — brak klauzuli
 *    `FOR` oznacza w Postgresie DOMYŚLNIE `FOR ALL`, więc literał `FOR DELETE`/`FOR ALL`
 *    nigdy nie występuje w tekście, a blacklista przechodzi mimo faktycznego DELETE.
 * 2. `CREATE POLICY "x" ON leady FOR DELETE ...` — bez kwalifikatora `public.`, regex
 *    `ON public\.leady\b` nie dopasowuje.
 * Test poniżej używa WHITELISTY: zbiera WSZYSTKIE polityki wskazujące `leady` (regex
 * tolerujący brak `public.`) i wymaga, żeby ten zbiór miał dokładnie jeden element,
 * który jest dokładnie oczekiwaną polityką INSERT dla `anon`. Każdy dodatkowy mutant —
 * niezależnie od tego, czy ma klauzulę `FOR`, czy kwalifikator `public.` — podnosi
 * liczność zbioru z 1 do 2 i test pada.
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

describe('RLS deny-by-default zamrożone na leady (CRM-DELETE-ADMIN-ONLY-LEADS)', () => {
  // @REQ: CRM-DELETE-ADMIN-ONLY-LEADS
  it('AC-LEADS-RLS.1: leady — ENABLE ROW LEVEL SECURITY jest obecne w migracji', () => {
    const sql = readMigration();
    expect(sql).toContain('ALTER TABLE public.leady ENABLE ROW LEVEL SECURITY;');
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-LEADS
  it('AC-LEADS-RLS.2: blok leady — dokładnie JEDNA polityka CREATE POLICY (whitelist, nie blacklist na FOR DELETE/FOR ALL)', () => {
    const sql = readMigration();
    const startMarker = 'ALTER TABLE public.leady ENABLE ROW LEVEL SECURITY;';
    const startIdx = sql.indexOf(startMarker);
    expect(startIdx).toBeGreaterThan(-1);

    const afterStart = sql.slice(startIdx + startMarker.length);
    const nextSectionIdx = afterStart.indexOf('\n\n\n');
    const leadyBlock = nextSectionIdx === -1 ? afterStart : afterStart.slice(0, nextSectionIdx);

    // WHITELIST, nie blacklist: liczymy WSZYSTKIE `CREATE POLICY` w bloku (niezależnie od
    // tego, czy mają klauzulę `FOR` — jej brak oznacza w Postgresie domyślnie `FOR ALL`,
    // więc blacklista na literał `FOR DELETE`/`FOR ALL` nie łapie takiego mutanta) i
    // wymagamy dokładnie jednej, o dokładnie oczekiwanej treści.
    const policyCount = (leadyBlock.match(/CREATE POLICY/g) ?? []).length;
    expect(policyCount).toBe(1);
    expect(leadyBlock).toContain('FOR INSERT TO anon WITH CHECK (true);');
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-LEADS
  it('AC-LEADS-RLS.3 (dowód globalny, whitelist): w CAŁYM pliku dokładnie JEDNA polityka wskazuje leady, i jest to FOR INSERT TO anon', () => {
    const sql = readMigration();
    // Regex tolerancyjny na brak kwalifikatora `public.` — mutant `ON leady FOR DELETE ...`
    // (bez `public.`) musi też zostać złapany, nie tylko `ON public.leady`.
    const leadyPolicyPattern = /CREATE POLICY[^;]*?\bON\s+(public\.)?leady\b[^;]*;/gs;
    const policiesOnLeady = sql.match(leadyPolicyPattern) ?? [];

    // Dokładnie jedna legalna polityka — każdy dodatkowy mutant (z klauzulą `FOR` lub bez,
    // z kwalifikatorem `public.` lub bez) podnosi tę liczbę z 1 do 2, niezależnie od
    // swojej formy, więc test pada.
    expect(policiesOnLeady).toHaveLength(1);
    expect(policiesOnLeady[0]).toMatch(/FOR INSERT\s+TO anon\s+WITH CHECK \(true\)/);
  });
});
