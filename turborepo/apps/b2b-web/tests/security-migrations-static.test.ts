import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * BATCH-MEDIUM-LOW-CLEANUP, punkty 10 i 11.
 *
 * Obie migracje cytowane tutaj są zacommitowane, ale NIE URUCHOMIONE na żywej
 * bazie (patrz ramka ostrzegawcza na górze każdego z tych plików). Brak
 * dockera/psql/supabase CLI w tym środowisku, więc test integracyjny na
 * prawdziwym Postgresie jest niewykonalny.
 *
 * POKRYCIE STATYCZNE, BRAK INTEGRACYJNEGO — ten plik zamraża wyłącznie TREŚĆ
 * plików migracji (dokładne cytaty), nie stan serwera. Zielony test tutaj NIE
 * jest dowodem, że produkcja jest zabezpieczona — obie migracje jawnie
 * deklarują to samo zastrzeżenie we własnych komentarzach nagłówkowych.
 */

function readMigration(filename: string): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return readFileSync(
    join(__dirname, '..', '..', '..', 'supabase', 'migrations', filename),
    'utf-8',
  );
}

describe('Punkt 11 — REVOKE praw zapisu na public."AuthorizedUser" (statyczne, migracja niezaaplikowana)', () => {
  const FILE = '20260901120000_security_revoke_authorized_user_writes.sql';

  // @REQ: SEC-AUTHZ-USER-MGMT
  it('migracja odbiera INSERT, UPDATE, DELETE, TRUNCATE na public."AuthorizedUser" rolom anon i authenticated', () => {
    const sql = readMigration(FILE);

    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."AuthorizedUser" FROM anon;',
    );
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."AuthorizedUser" FROM authenticated;',
    );
  });

  it('migracja jest osłonięta przez to_regclass, żeby REVOKE na nieistniejącej tabeli nie wywalił uruchomienia', () => {
    const sql = readMigration(FILE);

    expect(sql).toContain("IF to_regclass('public.\"AuthorizedUser\"') IS NULL THEN");
  });
});

describe('Punkt 10 — lockdown bucketów bazawiedzy i urzadzenia (statyczne, migracja niezaaplikowana)', () => {
  const FILE = '20260901120100_security_knowledge_base_buckets_private.sql';

  it('migracja ustawia public = false dla bucketów bazawiedzy i urzadzenia, bez aktywnego public = true dla nich w tym pliku', () => {
    const sql = readMigration(FILE);

    // Tylko kod aktywny — sekcja ROLLBACK w komentarzu na dole pliku świadomie
    // zawiera literał `public = true` jako instrukcję awaryjną, a nie jako
    // wykonywany SQL. Odrzucamy linie zaczynające się od `--` przed asercją
    // negatywną, żeby test nie fałszywie padał na treści komentarza.
    const activeSql = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    expect(sql).toContain('SET public = false');
    expect(sql).toContain("WHERE name IN ('bazawiedzy', 'urzadzenia');");
    expect(activeSql).not.toMatch(/public\s*=\s*true\s+WHERE name IN \('bazawiedzy', 'urzadzenia'\)/);
    expect(activeSql).not.toContain('public: true');
  });

  it('migracja dodaje politykę SELECT dla authenticated na obu bucketach referencyjnych, bez polityki dla anon', () => {
    const sql = readMigration(FILE);

    expect(sql).toContain('CREATE POLICY "authenticated read reference buckets" ON storage.objects');
    expect(sql).toContain('FOR SELECT TO authenticated');
    expect(sql).toContain("USING (bucket_id IN ('bazawiedzy', 'urzadzenia'));");
  });
});

describe('SEC-EMAIL-UNIQUE — przywrócenie UNIQUE na e-mailu pracownika (statyczne, migracja niezaaplikowana)', () => {
  const FILE = '20260903061000_security_employee_email_unique_reassert.sql';

  // Bez tagu @REQ: ten test zamraża wyłącznie TREŚĆ pliku migracji, nie kryteria
  // akceptacji SEC-EMAIL-UNIQUE — wymaganie ma status IMPLEMENTING właśnie dlatego,
  // że inne kryteria (integracyjne, na żywej bazie) nie są tu pokryte. Tag @REQ
  // dałby fałszywą zieleń dla wymagania, które w rzeczywistości nie jest domknięte.

  it('migracja tworzy unikalny indeks na email dla audytorzy i zespoly_monterskie', () => {
    const sql = readMigration(FILE);

    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS audytorzy_email_key');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS zespoly_monterskie_email_key');
  });

  it('migracja zawiera blok DO $$ z RAISE EXCEPTION sprawdzający duplikaty dla obu tabel', () => {
    const sql = readMigration(FILE);

    expect(sql).toContain('DO $$');

    // Musi być dokładnie dwa wystąpienia aktywnego (nie zakomentowanego)
    // RAISE EXCEPTION — jedno per tabela. Plik wspomina "RAISE EXCEPTION"
    // także w prozie komentarza opisującego decyzję projektową, więc liczymy
    // tylko linie spoza komentarzy, żeby nie fałszować liczby wystąpień.
    const activeSql = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    const raiseExceptionMatches = activeSql.match(/RAISE EXCEPTION/g) ?? [];
    expect(raiseExceptionMatches.length).toBe(2);

    expect(sql).toMatch(
      /RAISE EXCEPTION\s*\n\s*'SEC-EMAIL-UNIQUE: tabela public\.audytorzy zawiera/,
    );
    expect(sql).toMatch(
      /RAISE EXCEPTION\s*\n\s*'SEC-EMAIL-UNIQUE: tabela public\.zespoly_monterskie zawiera/,
    );
  });

  it('migracja nie używa CONCURRENTLY w aktywnym kodzie SQL (dopuszczalne wyłącznie w komentarzu)', () => {
    const sql = readMigration(FILE);

    const activeSql = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    // CONCURRENTLY może wystąpić w komentarzu opisującym warunek unieważnienia
    // decyzji (sekcja 2), ale nie wolno mu wystąpić w linii wykonywanego SQL —
    // CREATE INDEX CONCURRENTLY nie działa wewnątrz bloku transakcyjnego.
    expect(sql).toContain('CONCURRENTLY');
    expect(activeSql).not.toContain('CONCURRENTLY');
  });
});
