import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Wymaganie: CRM-DELETE-ADMIN-ONLY-INSTALLATIONS (contracts/requirements.contract.mjs).
 *
 * AC dla tego wymagania wymaga trzech NIEZALEŻNYCH warstw ochrony usunięcia instalacji: UI
 * (przycisk "Usuń (Tylko Admin)" widoczny wyłącznie dla `admin`, patrz
 * installations-delete-ui-gate.test.ts), Server Action (bramkowana
 * `can(role, 'installations', 'delete')`, retagowane w installations-authz-gates.test.ts,
 * blok `describe('deleteInstallationAction — bramka roli...')`) i RLS ("bezpośredni DELETE na
 * tabeli instalacje rolą nie-admin jest odrzucony przez bazę"). Ten plik domyka warstwę RLS.
 *
 * BRAK DOCKERA/PSQL/SUPABASE CLI w tym środowisku: test integracyjny wykonujący prawdziwy
 * `DELETE FROM instalacje` jako rola `anon`/`authenticated` na żywym Postgresie jest tu
 * niewykonalny (to samo ograniczenie co w crews-rls-deny-by-default.test.ts i
 * leads-rls-deny-by-default.test.ts — przeczytane jako wzorzec). Jedynym wykonalnym testem
 * jest ASERCJA STATYCZNA nad treścią pliku migracji
 * `20260824185845_security_enable_rls_baseline.sql` jako tekstu.
 *
 * Stan bloku `instalacje` w migracji (przeczytany bezpośrednio przed napisaniem tego testu):
 * `instalacje` leży w SEKCJI 1 ("Tabele bez ŻADNEGO konsumenta przez supabase-js — ENABLE,
 * zero polityk"), dokładnie ten sam wzorzec co `zespoly_monterskie` (crews) — prostszy
 * przypadek niż `leady`, które ma jedną legalną politykę INSERT. Zero legalnych polityk na tej
 * tabeli w ogóle. RLS włączone bez żadnej polityki oznacza odmowę WSZYSTKICH operacji
 * (SELECT/INSERT/UPDATE/DELETE) dla każdej roli poza tą, która omija RLS
 * (`service_role`/`postgres` z `rolbypassrls`).
 *
 * Whitelist, nie blacklist: wzorem
 * .claude/agent-memory/reviewer/feedback_rls_freeze_test_whitelist.md — liczymy WSZYSTKIE
 * `CREATE POLICY` w bloku (nie tylko te z literałem `FOR DELETE`/`FOR ALL`, bo brak klauzuli
 * `FOR` oznacza w Postgresie domyślnie `FOR ALL`) i wymagamy zbioru pustego. Dla tabeli bez
 * żadnej legalnej polityki (jak `zespoly_monterskie`) asercja count === 0 jest wystarczająca
 * i prostsza niż porównanie do listy dozwolonych polityk.
 *
 * AC-INSTALLATIONS-RLS.3 NIE jest ograniczone do jednego pliku migracji. Dowód wyłącznie
 * z `20260824185845_security_enable_rls_baseline.sql` jest za wąski — migracja dodana PO tym
 * pliku, w innym pliku `.sql`, i tworząca politykę na `instalacje`, przeszłaby taki test na
 * zielono mimo złamania deny-by-default. AC.3 skanuje więc `readdirSync('supabase/migrations')`
 * (wszystkie pliki `.sql`, wzorem `security-migrations-static.test.ts`) i wymaga zbioru pustego
 * dopasowań w KAŻDYM z nich. Stan repo w chwili pisania (sprawdzony `grep -n "CREATE POLICY"`
 * na całym katalogu): trzy migracje mają `CREATE POLICY` — plik bazowy (polityki na innych
 * tabelach, m.in. `leady`, `AuthorizedUser`, katalogi publiczne), `20260828120000_kartoteki_
 * storage_policies.sql` i `20260901120100_security_knowledge_base_buckets_private.sql` (obie
 * dotyczą `storage.objects`) — żadna nie dotyczy `instalacje`.
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

describe('RLS deny-by-default zamrożone na instalacje (CRM-DELETE-ADMIN-ONLY-INSTALLATIONS)', () => {
  // @REQ: CRM-DELETE-ADMIN-ONLY-INSTALLATIONS
  it('AC-INSTALLATIONS-RLS.1: instalacje — ENABLE ROW LEVEL SECURITY jest obecne w migracji', () => {
    const sql = readMigration();
    expect(sql).toContain('ALTER TABLE public.instalacje           ENABLE ROW LEVEL SECURITY;');
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INSTALLATIONS
  it('AC-INSTALLATIONS-RLS.2: instalacje leży w bloku "tabele bez konsumenta supabase-js" z zerem CREATE POLICY', () => {
    const sql = readMigration();
    // Blok sekcji 1 to grupa ośmiu ALTER TABLE ... ENABLE bez żadnej polityki, od
    // `zespoly_monterskie` (pierwsza w grupie, `instalacje` druga) do początku sekcji 2
    // (bramka logowania).
    const startMarker = 'ALTER TABLE public.zespoly_monterskie   ENABLE ROW LEVEL SECURITY;';
    const startIdx = sql.indexOf(startMarker);
    expect(startIdx).toBeGreaterThan(-1);

    const sectionEndMarker = 'ALTER TABLE public."AuthorizedUser" ENABLE ROW LEVEL SECURITY;';
    const endIdx = sql.indexOf(sectionEndMarker, startIdx);
    expect(endIdx).toBeGreaterThan(startIdx);

    const section1Block = sql.slice(startIdx, endIdx);

    expect(section1Block).toContain('ALTER TABLE public.instalacje           ENABLE ROW LEVEL SECURITY;');
    // WHITELIST, nie blacklist: liczymy WSZYSTKIE `CREATE POLICY` w całej sekcji 1
    // (niezależnie od tego, czy mają klauzulę `FOR` — jej brak oznacza w Postgresie
    // domyślnie `FOR ALL`, więc blacklista na literał `FOR DELETE`/`FOR ALL` nie łapie
    // takiego mutanta). Cała sekcja 1 (osiem tabel) ma zero polityk jakiegokolwiek typu.
    expect((section1Block.match(/CREATE POLICY/g) ?? []).length).toBe(0);
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INSTALLATIONS
  it('AC-INSTALLATIONS-RLS.3 (dowód globalny, whitelist): w ŻADNYM pliku migracji żadna polityka nie wskazuje instalacje', () => {
    // Dowód ograniczony do jednego pliku (bazowego) jest za wąski — przyszła migracja
    // dodająca politykę na `instalacje` w INNYM pliku przechodziłaby ten test na zielono, mimo
    // że łamie deny-by-default. Skanujemy WSZYSTKIE pliki `.sql` w `supabase/migrations/`, nie
    // tylko `20260824185845_security_enable_rls_baseline.sql`.
    const files = listAllMigrationFiles();
    expect(files.length).toBeGreaterThan(0);

    // Regex tolerancyjny na brak kwalifikatora `public.` — mutant `ON instalacje FOR DELETE
    // ...` (bez `public.`) musi też zostać złapany, nie tylko `ON public.instalacje`.
    const installationsPolicyPattern = /CREATE POLICY[^;]*?\bON\s+(public\.)?instalacje\b[^;]*;/g;

    for (const file of files) {
      const sql = readMigrationByName(file);
      const policiesOnInstallations = sql.match(installationsPolicyPattern) ?? [];

      expect(
        policiesOnInstallations,
        `Plik ${file} zawiera CREATE POLICY na instalacje — narusza deny-by-default.`,
      ).toEqual([]);
    }
  });
});
