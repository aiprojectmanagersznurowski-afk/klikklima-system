import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Wymaganie: CRM-DELETE-ADMIN-ONLY-SERVICES (contracts/requirements.contract.mjs).
 *
 * AC dla tego wymagania wymaga trzech NIEZALEŻNYCH warstw ochrony usunięcia serwisu: UI
 * (przycisk "Usuń (Tylko Admin)" widoczny wyłącznie dla `admin`, patrz
 * services-delete-ui-gate.test.ts), Server Action (bramkowana
 * `can(role, 'services', 'delete')`, retagowana w services-authz-gates.test.ts, blok
 * `describe('deleteServiceAction — bramka roli...')`) i RLS ("bezpośredni DELETE na tabeli
 * serwisy rolą nie-admin jest odrzucony przez bazę"). Ten plik domyka warstwę RLS.
 *
 * UWAGA O NOTATCE `source` W KONTRAKCIE: wpis `CRM-DELETE-ADMIN-ONLY-SERVICES` niesie
 * dziś nieaktualną notatkę, że ścieżka `prisma.serwisy.delete` jest "martwa". To zostało
 * naprawione w commicie 784d8df (SRV-SOURCE-OF-TRUTH), własny test:
 * services-source-of-truth.test.ts. `ServiceSummary.service_id` jest poprawnym kluczem
 * `serwisy.id`. Ta warstwa RLS chroni więc realną, żywą ścieżkę zapisu.
 *
 * BRAK DOCKERA/PSQL/SUPABASE CLI w tym środowisku: test integracyjny wykonujący prawdziwy
 * `DELETE FROM serwisy` jako rola `anon`/`authenticated` na żywym Postgresie jest tu
 * niewykonalny (to samo ograniczenie co w installations-rls-deny-by-default.test.ts i
 * auditors-rls-deny-by-default.test.ts — przeczytane jako wzorzec). Jedynym wykonalnym
 * testem jest ASERCJA STATYCZNA nad treścią plików migracji jako tekstu.
 *
 * Stan bloku `serwisy` w migracji (przeczytany bezpośrednio przed napisaniem tego testu):
 * `serwisy` leży w SEKCJI 1 ("Tabele bez ŻADNEGO konsumenta przez supabase-js — ENABLE,
 * zero polityk"), dokładnie ten sam wzorzec co `instalacje`/`usterki_incidents` — zero
 * legalnych polityk na tej tabeli w ogóle. RLS włączone bez żadnej polityki oznacza odmowę
 * WSZYSTKICH operacji (SELECT/INSERT/UPDATE/DELETE) dla każdej roli poza tą, która omija RLS
 * (`service_role`/`postgres` z `rolbypassrls`).
 *
 * Whitelist, nie blacklist: wzorem
 * .claude/agent-memory/reviewer/feedback_rls_freeze_test_whitelist.md — liczymy WSZYSTKIE
 * `CREATE POLICY` w bloku (nie tylko te z literałem `FOR DELETE`/`FOR ALL`, bo brak klauzuli
 * `FOR` oznacza w Postgresie domyślnie `FOR ALL`) i wymagamy zbioru pustego dla `serwisy`.
 *
 * AC-SERVICES-RLS.3 skanuje WSZYSTKIE pliki `.sql` w supabase/migrations/ (nie tylko
 * migrację bazową) w poszukiwaniu jakiejkolwiek polityki wskazującej `serwisy`. Stan repo w
 * chwili pisania (`grep -rln "CREATE POLICY.*serwisy" supabase/migrations/*.sql`): brak
 * wyniku — żadna migracja nie tworzy polityki na `serwisy`.
 *
 * AC-SERVICES-RLS.4 (wzorem auditors-rls-deny-by-default.test.ts, MOCNIEJSZY wariant niż
 * crews/leads/installations — patrz
 * .claude/agent-memory/test-author/project_rls_disable_debt_family.md): żaden plik migracji
 * nie wykonuje `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` na `serwisy`. Bez tej asercji
 * AC.1-3 przechodziłyby dalej na zielono przy w pełni otwartej tabeli, bo polityki (albo ich
 * brak) stają się martwym zapisem po globalnym DISABLE. Stan repo w chwili pisania
 * (`grep -rn "DISABLE ROW LEVEL SECURITY" supabase/migrations/*.sql`): brak wyniku.
 */

function migrationsDir(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, '..', '..', '..', 'supabase', 'migrations');
}

function readBaselineMigration(): string {
  return readFileSync(join(migrationsDir(), '20260824185845_security_enable_rls_baseline.sql'), 'utf-8');
}

/** Zwraca nazwy WSZYSTKICH plików `.sql` w `supabase/migrations/` (posortowane, deterministyczne). */
function listAllMigrationFiles(): string[] {
  const dir = migrationsDir();
  return readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
}

function readMigrationByName(filename: string): string {
  return readFileSync(join(migrationsDir(), filename), 'utf-8');
}

/** Konkatenacja treści WSZYSTKICH plików .sql w katalogu migracji, w kolejności nazw pliku. */
function readAllMigrations(): string {
  return listAllMigrationFiles()
    .map((f) => readMigrationByName(f))
    .join('\n\n');
}

describe('RLS deny-by-default zamrożone na serwisy (CRM-DELETE-ADMIN-ONLY-SERVICES)', () => {
  // @REQ: CRM-DELETE-ADMIN-ONLY-SERVICES
  it('AC-SERVICES-RLS.1: serwisy — ENABLE ROW LEVEL SECURITY jest obecne w migracji bazowej', () => {
    const sql = readBaselineMigration();
    expect(sql).toContain('ALTER TABLE public.serwisy              ENABLE ROW LEVEL SECURITY;');
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-SERVICES
  it('AC-SERVICES-RLS.2: serwisy leży w bloku "tabele bez konsumenta supabase-js" z zerem CREATE POLICY', () => {
    const sql = readBaselineMigration();
    // Blok sekcji 1 to grupa ośmiu ALTER TABLE ... ENABLE bez żadnej polityki, od
    // `zespoly_monterskie` (pierwsza w grupie) do początku sekcji 2 (bramka logowania).
    const startMarker = 'ALTER TABLE public.zespoly_monterskie   ENABLE ROW LEVEL SECURITY;';
    const startIdx = sql.indexOf(startMarker);
    expect(startIdx).toBeGreaterThan(-1);

    const sectionEndMarker = 'ALTER TABLE public."AuthorizedUser" ENABLE ROW LEVEL SECURITY;';
    const endIdx = sql.indexOf(sectionEndMarker, startIdx);
    expect(endIdx).toBeGreaterThan(startIdx);

    const section1Block = sql.slice(startIdx, endIdx);

    expect(section1Block).toContain('ALTER TABLE public.serwisy              ENABLE ROW LEVEL SECURITY;');
    // WHITELIST, nie blacklist: liczymy WSZYSTKIE `CREATE POLICY` w całej sekcji 1
    // (niezależnie od tego, czy mają klauzulę `FOR` — jej brak oznacza w Postgresie
    // domyślnie `FOR ALL`, więc blacklista na literał `FOR DELETE`/`FOR ALL` nie łapie
    // takiego mutanta). Cała sekcja 1 (osiem tabel) ma zero polityk jakiegokolwiek typu.
    expect((section1Block.match(/CREATE POLICY/g) ?? []).length).toBe(0);
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-SERVICES
  it('AC-SERVICES-RLS.3 (dowód globalny, whitelist): w ŻADNYM pliku migracji żadna polityka nie wskazuje serwisy', () => {
    // Dowód ograniczony do jednego pliku (bazowego) jest za wąski — przyszła migracja
    // dodająca politykę na `serwisy` w INNYM pliku przechodziłaby ten test na zielono, mimo
    // że łamie deny-by-default. Skanujemy WSZYSTKIE pliki `.sql` w `supabase/migrations/`,
    // nie tylko `20260824185845_security_enable_rls_baseline.sql`.
    const files = listAllMigrationFiles();
    expect(files.length).toBeGreaterThan(0);

    // Regex tolerancyjny na brak kwalifikatora `public.` — mutant `ON serwisy FOR DELETE ...`
    // (bez `public.`) musi też zostać złapany, nie tylko `ON public.serwisy`.
    const servicesPolicyPattern = /CREATE POLICY[^;]*?\bON\s+(public\.)?serwisy\b[^;]*;/g;

    for (const file of files) {
      const sql = readMigrationByName(file);
      const policiesOnServices = sql.match(servicesPolicyPattern) ?? [];

      expect(
        policiesOnServices,
        `Plik ${file} zawiera CREATE POLICY na serwisy — narusza deny-by-default.`,
      ).toEqual([]);
    }
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-SERVICES
  it('AC-SERVICES-RLS.4: żaden plik migracji nie wyłącza RLS na serwisy (DISABLE ROW LEVEL SECURITY nie występuje nigdzie)', () => {
    // Testy AC-SERVICES-RLS.1-3 dowodzą tylko, że polityki są poprawne w chwili odczytu — nie
    // chronią przed późniejszą migracją, która wyłączy RLS w całości (`ALTER TABLE ...
    // DISABLE ROW LEVEL SECURITY`), po czym brak CREATE POLICY staje się bez znaczenia, a
    // tabela serwisy jest w pełni otwarta na DELETE dla `authenticated`. Skan obejmuje
    // WSZYSTKIE pliki migracji (ten sam `readAllMigrations()`), nie tylko baseline.
    const sql = readAllMigrations();
    expect(sql).not.toMatch(/ALTER TABLE\s+(public\.)?serwisy\s+DISABLE ROW LEVEL SECURITY/i);
  });
});
