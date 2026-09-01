import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Punkt 23, docs/workorders/BATCH-MEDIUM-LOW-CLEANUP.md.
 *
 * Migracja `supabase/migrations/20260821130000_fld_consent_docs.sql` jest już
 * uruchomiona na produkcji (2026-08-27). Brak dockera/psql/supabase CLI w tym
 * środowisku, więc test integracyjny na żywym Postgresie (triggery, indeks
 * częściowy jako ograniczenie egzekwowane przez silnik) jest tu NIEWYKONALNY.
 *
 * POKRYCIE STATYCZNE, BRAK INTEGRACYJNEGO — środowisko bez Postgres. Ten plik
 * zamraża wyłącznie OBECNOŚĆ czterech mechanizmów w treści pliku migracji, nie
 * ich faktyczne działanie w silniku bazy. Nie podnosi statusu FLD-CONSENT-ACCEPT
 * ani FLD-LEGAL-DOC-VERSION do DONE (patrz AC23.2) — oba zostają TODO, dopóki nie
 * powstanie test integracyjny na prawdziwym Postgresie (AC23.3, wpis BLOCKED
 * w rejestrze wymagań, zadanie contract-steward w tym samym oknie).
 *
 * Cztery mechanizmy i dokładne fragmenty SQL, które ten plik cytuje (przepisane
 * z migracji, nie zgadywane):
 *
 *   1. FREEZE (wersja opublikowana niezmienna) — funkcja
 *      `legal_document_versions_freeze_published()` + trigger BEFORE UPDATE
 *      na `legal_document_versions`, realizuje FLD-LEGAL-DOC-VERSION
 *      ("Zmiana treści wersji już opublikowanej jest odrzucana przez bazę").
 *   2. APPEND-ONLY (rejestr akceptacji nieedytowalny) — funkcja
 *      `employee_consents_append_only()` + trigger BEFORE UPDATE na
 *      `employee_consents`, realizuje FLD-CONSENT-ACCEPT
 *      ("Wpisu w rejestrze nie da się zmienić — UPDATE jest odrzucany... łącznie
 *      z administratorem").
 *   3. VERSION-MUST-BE-CURRENT (akceptować wolno wyłącznie wersję obowiązującą
 *      w chwili zapisu) — funkcja `employee_consents_version_must_be_current()`
 *      + trigger BEFORE INSERT na `employee_consents`, realizuje
 *      FLD-CONSENT-ACCEPT ("Akceptacja wskazująca wersję, która nie jest w tym
 *      momencie obowiązująca... jest odrzucona przez bazę").
 *   4. CZĘŚCIOWY INDEKS UNIKALNY (dokładnie jedna wersja obowiązująca na rodzaj
 *      dokumentu) — `CREATE UNIQUE INDEX ... ON public.legal_document_versions
 *      (document_kind) WHERE is_current`, realizuje FLD-LEGAL-DOC-VERSION
 *      ("W danym momencie dokładnie jedna wersja danego rodzaju dokumentu jest
 *      obowiązująca; próba oznaczenia drugiej jest odrzucona przez częściowy
 *      indeks unikalny").
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
    '20260821130000_fld_consent_docs.sql',
  );
  return readFileSync(migrationPath, 'utf-8');
}

describe('FLD-CONSENT-ACCEPT / FLD-LEGAL-DOC-VERSION — pokrycie statyczne czterech mechanizmów bazodanowych (punkt 23, brak Postgres w tym środowisku)', () => {
  // Mechanizm 1: freeze wersji opublikowanej.
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('mechanizm FREEZE: funkcja legal_document_versions_freeze_published() i trigger BEFORE UPDATE na legal_document_versions są obecne', () => {
    const sql = readMigration();

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.legal_document_versions_freeze_published()',
    );
    expect(sql).toContain(
      "wersja opublikowana jest niezmienna (AC1). Wolno zmienic wylacznie is_current. Nowa tresc = NOWA WERSJA.",
    );
    expect(sql).toContain('CREATE TRIGGER legal_document_versions_freeze_published_trg');
    expect(sql).toContain('BEFORE UPDATE ON public.legal_document_versions');
    expect(sql).toContain(
      'EXECUTE FUNCTION public.legal_document_versions_freeze_published();',
    );
  });

  // Mechanizm 2: append-only na employee_consents.
  // @REQ: FLD-CONSENT-ACCEPT
  it('mechanizm APPEND-ONLY: funkcja employee_consents_append_only() i trigger BEFORE UPDATE na employee_consents są obecne', () => {
    const sql = readMigration();

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.employee_consents_append_only()');
    expect(sql).toContain(
      'employee_consents: rejestr akceptacji jest append-only (AC5). Wpisu nie edytuje sie',
    );
    expect(sql).toContain('CREATE TRIGGER employee_consents_append_only_trg');
    expect(sql).toContain('BEFORE UPDATE ON public.employee_consents');
    expect(sql).toContain('EXECUTE FUNCTION public.employee_consents_append_only();');
  });

  // Mechanizm 3: version-must-be-current na INSERT.
  // @REQ: FLD-CONSENT-ACCEPT
  it('mechanizm VERSION-MUST-BE-CURRENT: funkcja employee_consents_version_must_be_current() i trigger BEFORE INSERT są obecne', () => {
    const sql = readMigration();

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.employee_consents_version_must_be_current()',
    );
    expect(sql).toContain(
      'SELECT 1 FROM public.legal_document_versions v\n     WHERE v.id = NEW.version_id AND v.is_current',
    );
    expect(sql).toContain('CREATE TRIGGER employee_consents_version_must_be_current_trg');
    expect(sql).toContain('BEFORE INSERT ON public.employee_consents');
    expect(sql).toContain(
      'EXECUTE FUNCTION public.employee_consents_version_must_be_current();',
    );
  });

  // Mechanizm 4: częściowy indeks unikalny.
  // @REQ: FLD-LEGAL-DOC-VERSION
  it('mechanizm CZĘŚCIOWY INDEKS UNIKALNY: dokładnie jedna wersja obowiązująca na rodzaj dokumentu jest wymuszona indeksem', () => {
    const sql = readMigration();

    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS legal_document_versions_current_per_kind_key',
    );
    expect(sql).toContain('ON public.legal_document_versions (document_kind)');
    expect(sql).toContain('WHERE is_current;');
  });

  // AC23.2 (nie dowód testowy, dowód dokumentacyjny — sprawdzamy, że plik WO
  // i ten plik testu jawnie mówią "pokrycie statyczne", nie że kryterium jest
  // wykonalne przez sam odczyt kodu źródłowego testu przez maszynę).
  it('AC23.2: ten plik jawnie deklaruje pokrycie statyczne bez integracyjnego (dowód przez treść komentarza nagłówkowego tego pliku)', () => {
    const thisFile = readFileSync(fileURLToPath(import.meta.url), 'utf-8');
    expect(thisFile).toContain('POKRYCIE STATYCZNE, BRAK INTEGRACYJNEGO');
    expect(thisFile).toContain('środowisko bez Postgres');
  });
});
