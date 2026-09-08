import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Wymaganie: CRM-DELETE-ADMIN-ONLY-INCIDENTS (contracts/requirements.contract.mjs).
 *
 * AC dla tego wymagania wymaga trzech NIEZALEŻNYCH warstw ochrony usunięcia usterki: UI
 * (przycisk "Usuń (Tylko Admin)" widoczny wyłącznie dla `admin`, patrz
 * incidents-delete-ui-gate.test.ts), Server Action (bramkowana
 * `can(role, 'incidents', 'delete')`, retagowane w incidents-authz-gates.test.ts, blok
 * `describe('deleteIncidentAction — bramka roli...')`) i RLS ("bezpośredni DELETE na tabeli
 * usterki_incidents rolą nie-admin jest odrzucony przez bazę"). Ten plik domyka warstwę RLS.
 *
 * BRAK DOCKERA/PSQL/SUPABASE CLI w tym środowisku: test integracyjny wykonujący prawdziwy
 * `DELETE FROM usterki_incidents` jako rola `anon`/`authenticated` na żywym Postgresie jest tu
 * niewykonalny (to samo ograniczenie co w installations-rls-deny-by-default.test.ts,
 * crews-rls-deny-by-default.test.ts i leads-rls-deny-by-default.test.ts — przeczytane jako
 * wzorzec). Jedynym wykonalnym testem jest ASERCJA STATYCZNA nad treścią pliku migracji
 * `20260824185845_security_enable_rls_baseline.sql` jako tekstu.
 *
 * Stan bloku `usterki_incidents` w migracji (przeczytany bezpośrednio przed napisaniem tego
 * testu, linia 72): `usterki_incidents` leży w SEKCJI 1 ("Tabele bez ŻADNEGO konsumenta przez
 * supabase-js — ENABLE, zero polityk"), dokładnie ten sam wzorzec co `zespoly_monterskie`
 * (crews, linia 69, pierwsza tabela sekcji) i `instalacje` (installations, linia 70) —
 * prostszy przypadek niż `leady`, które ma jedną legalną politykę INSERT. Zero legalnych
 * polityk na tej tabeli w ogóle. RLS włączone bez żadnej polityki oznacza odmowę WSZYSTKICH
 * operacji (SELECT/INSERT/UPDATE/DELETE) dla każdej roli poza tą, która omija RLS
 * (`service_role`/`postgres` z `rolbypassrls`).
 *
 * Whitelist, nie blacklist: wzorem
 * .claude/agent-memory/reviewer/feedback_rls_freeze_test_whitelist.md — liczymy WSZYSTKIE
 * `CREATE POLICY` w bloku (nie tylko te z literałem `FOR DELETE`/`FOR ALL`, bo brak klauzuli
 * `FOR` oznacza w Postgresie domyślnie `FOR ALL`) i wymagamy zbioru pustego. Dla tabeli bez
 * żadnej legalnej polityki (jak `usterki_incidents`) asercja count === 0 jest wystarczająca
 * i prostsza niż porównanie do listy dozwolonych polityk.
 *
 * AC-INCIDENTS-RLS.3 NIE jest ograniczone do jednego pliku migracji. Dowód wyłącznie z
 * `20260824185845_security_enable_rls_baseline.sql` jest za wąski — migracja dodana PO tym
 * pliku, w innym pliku `.sql`, i tworząca politykę na `usterki_incidents`, przeszłaby taki
 * test na zielono mimo złamania deny-by-default. AC.3 skanuje więc
 * `readdirSync('supabase/migrations')` (wszystkie pliki `.sql`, wzorem
 * `installations-rls-deny-by-default.test.ts` / `security-migrations-static.test.ts`) i wymaga
 * zbioru pustego dopasowań w KAŻDYM z nich. Stan repo w chwili pisania (sprawdzony
 * `grep -rln "CREATE POLICY" supabase/migrations/`): cztery migracje mają `CREATE POLICY` —
 * plik bazowy (polityki na innych tabelach, m.in. `leady`, `AuthorizedUser`, katalogi
 * publiczne), `20260828120000_kartoteki_storage_policies.sql`,
 * `20260901120100_security_knowledge_base_buckets_private.sql` (obie dotyczą
 * `storage.objects`) i `20260908065000_notification_queue.sql` (kolejka powiadomień, inna
 * tabela) — żadna nie dotyczy `usterki_incidents`.
 */

function migrationsDir(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, '..', '..', '..', 'supabase', 'migrations');
}

function readMigration(): string {
  return readFileSync(
    join(migrationsDir(), '20260824185845_security_enable_rls_baseline.sql'),
    'utf-8',
  );
}

/** Zwraca nazwy WSZYSTKICH plików `.sql` w `supabase/migrations/` (posortowane, deterministyczne). */
function listAllMigrationFiles(): string[] {
  return readdirSync(migrationsDir())
    .filter((name) => name.endsWith('.sql'))
    .sort();
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

describe('RLS deny-by-default zamrożone na usterki_incidents (CRM-DELETE-ADMIN-ONLY-INCIDENTS)', () => {
  // @REQ: CRM-DELETE-ADMIN-ONLY-INCIDENTS
  it('AC-INCIDENTS-RLS.1: usterki_incidents — ENABLE ROW LEVEL SECURITY jest obecne w migracji', () => {
    const sql = readMigration();
    expect(sql).toContain('ALTER TABLE public.usterki_incidents    ENABLE ROW LEVEL SECURITY;');
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INCIDENTS
  it('AC-INCIDENTS-RLS.2: usterki_incidents leży w bloku "tabele bez konsumenta supabase-js" z zerem CREATE POLICY', () => {
    const sql = readMigration();
    // Blok sekcji 1 to grupa ośmiu ALTER TABLE ... ENABLE bez żadnej polityki, od
    // `zespoly_monterskie` (pierwsza w grupie) do początku sekcji 2 (bramka logowania,
    // `AuthorizedUser`). `usterki_incidents` leży w tym samym bloku.
    const startMarker = 'ALTER TABLE public.zespoly_monterskie   ENABLE ROW LEVEL SECURITY;';
    const startIdx = sql.indexOf(startMarker);
    expect(startIdx).toBeGreaterThan(-1);

    const sectionEndMarker = 'ALTER TABLE public."AuthorizedUser" ENABLE ROW LEVEL SECURITY;';
    const endIdx = sql.indexOf(sectionEndMarker, startIdx);
    expect(endIdx).toBeGreaterThan(startIdx);

    const section1Block = sql.slice(startIdx, endIdx);

    expect(section1Block).toContain(
      'ALTER TABLE public.usterki_incidents    ENABLE ROW LEVEL SECURITY;',
    );
    // WHITELIST, nie blacklist: liczymy WSZYSTKIE `CREATE POLICY` w całej sekcji 1
    // (niezależnie od tego, czy mają klauzulę `FOR` — jej brak oznacza w Postgresie
    // domyślnie `FOR ALL`, więc blacklista na literał `FOR DELETE`/`FOR ALL` nie łapie
    // takiego mutanta). Cała sekcja 1 (osiem tabel) ma zero polityk jakiegokolwiek typu.
    expect((section1Block.match(/CREATE POLICY/g) ?? []).length).toBe(0);
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INCIDENTS
  it('AC-INCIDENTS-RLS.3 (dowód globalny, whitelist): w ŻADNYM pliku migracji żadna polityka nie wskazuje usterki_incidents', () => {
    // Dowód ograniczony do jednego pliku (bazowego) jest za wąski — przyszła migracja
    // dodająca politykę na `usterki_incidents` w INNYM pliku przechodziłaby ten test na
    // zielono, mimo że łamie deny-by-default. Skanujemy WSZYSTKIE pliki `.sql` w
    // `supabase/migrations/`, nie tylko `20260824185845_security_enable_rls_baseline.sql`.
    const files = listAllMigrationFiles();
    expect(files.length).toBeGreaterThan(0);

    // Regex tolerancyjny na brak kwalifikatora `public.` — mutant `ON usterki_incidents FOR
    // DELETE ...` (bez `public.`) musi też zostać złapany, nie tylko `ON public.usterki_incidents`.
    const incidentsPolicyPattern = /CREATE POLICY[^;]*?\bON\s+(public\.)?usterki_incidents\b[^;]*;/g;

    for (const file of files) {
      const sql = readMigrationByName(file);
      const policiesOnIncidents = sql.match(incidentsPolicyPattern) ?? [];

      expect(
        policiesOnIncidents,
        `Plik ${file} zawiera CREATE POLICY na usterki_incidents — narusza deny-by-default.`,
      ).toEqual([]);
    }
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INCIDENTS
  it('AC-INCIDENTS-RLS.4: zaden plik migracji nie wylacza RLS na usterki_incidents (DISABLE ROW LEVEL SECURITY nie wystepuje nigdzie)', () => {
    // Testy AC-INCIDENTS-RLS.1-3 dowodza tylko, ze stan polityk jest poprawny w chwili
    // odczytu - nie chronia przed pozniejsza migracja, ktora wylaczy RLS w calosci (`ALTER
    // TABLE ... DISABLE ROW LEVEL SECURITY`), po czym tabela usterki_incidents jest w pelni
    // otwarta na DELETE dla `authenticated`, mimo ze AC.1-3 nadal przechodza (bo dotycza
    // tylko obecnosci CREATE POLICY, nie stanu ENABLE/DISABLE). Skan obejmuje WSZYSTKIE
    // pliki migracji (ten sam readdirSync co AC.3), nie tylko baseline. Wzorzec:
    // AC-AUDITORS-RLS.4 w auditors-rls-deny-by-default.test.ts.
    const sql = readAllMigrations();
    expect(sql).not.toMatch(/ALTER TABLE\s+(public\.)?usterki_incidents\s+DISABLE ROW LEVEL SECURITY/i);
  });
});
