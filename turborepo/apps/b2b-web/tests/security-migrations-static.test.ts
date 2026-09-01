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
