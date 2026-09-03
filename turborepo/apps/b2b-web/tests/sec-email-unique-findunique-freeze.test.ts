import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * WO: docs/workorders/SEC-EMAIL-UNIQUE.md — AC-A7.
 *
 * Baza żywa NIE ma ograniczenia UNIQUE na `audytorzy.email` ani na
 * `zespoly_monterskie.email` (zweryfikowane bezpośrednim zapytaniem do
 * `pg_indexes`/`pg_constraint` 2026-09-03 — WO, sekcja "Baza — brak ograniczenia").
 * `prisma.audytorzy.findUnique({ where: { email } })` i
 * `prisma.zespoly_monterskie.findUnique({ where: { email } })` kompilują się
 * WYŁĄCZNIE dzięki deklaracji `@unique` w `schema.prisma`, która dziś NIE
 * odpowiada rzeczywistości bazy — Prisma zwraca PIERWSZY pasujący wiersz zamiast
 * rzucić błędem "więcej niż jeden wynik", więc przy duplikacie e-maila kod cicho
 * wybiera dowolny z dwóch rekordów.
 *
 * Sześć miejsc do naprawienia (WO, tabela w sekcji "Kod — sześć wywołań
 * findUnique({ where: { email } })"):
 *   1. leads/actions.ts — getLeads
 *   2. leads/[id]/actions.ts — getLeadDetail
 *   3. auditors/actions.ts — setSelfAvailabilityAction
 *   4. auditors/actions.ts — acceptLegalDocumentVersionAction
 *   5. crews/actions.ts — setSelfAvailabilityAction
 *   6. crews/actions.ts — acceptLegalDocumentVersionAction
 *
 * Wzorzec docelowy (D4 z WO, już ustalony w SEC-READ-GATES dla trzech innych
 * funkcji odczytowych): `findMany({ where: { email }, take: 2 })` + odmowa gdy
 * `matches.length !== 1`. `findMany` zrywa zależność od obietnicy `@unique` w
 * schemacie — kod zaczyna weryfikować FAKT (ile wierszy naprawdę pasuje), a nie
 * polegać na deklaracji, która dziś nie odpowiada bazie.
 *
 * CELOWO POZA ZAKRESEM tego testu: `prisma.authorizedUser.findUnique({ where:
 * { email } })` w `utils/supabase/server.ts` — `AuthorizedUser.email` deklaruje
 * `@unique` w schema.prisma (linia 88) I MA odpowiadające ograniczenie na żywej
 * bazie (WO, Ryzyko 2 — sprawdzone jako część tej sesji, `AuthorizedUser.email`
 * to jedyna z trzech kolumn e-mailowych, która faktycznie ma UNIQUE w Postgresie).
 * Zamrożenie objęłoby wtedy wywołanie, które jest dziś w pełni bezpieczne — to
 * byłby zły test, blokujący poprawny kod bez powodu.
 *
 * Metoda: asercja statyczna nad treścią plików źródłowych jako tekstem (ten sam
 * standard dowodowy co `rls-deny-by-default-freeze.test.ts` — brak żywej bazy w
 * tym środowisku wyklucza test integracyjny na tym etapie). Komentarze blokowe
 * (`/** ... *​/`) są usuwane przed skanowaniem, bo trzy z sześciu plików CYTUJĄ
 * dokładnie ten wzorzec w komentarzu dokumentującym poprzednią naprawę
 * (SEC-RLS-AUDITOR-SCOPE) — bez tego usunięcia test liczyłby cytat w komentarzu
 * jako żywy kod.
 */

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      listSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function countLiveFindUniqueByEmail(srcDir: string): { file: string; count: number }[] {
  const files = listSourceFiles(srcDir);
  const hits: { file: string; count: number }[] = [];
  for (const file of files) {
    const raw = readFileSync(file, 'utf-8');
    const withoutBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    const withoutLineComments = withoutBlockComments.replace(/^\s*\/\/.*$/gm, '');
    const collapsed = withoutLineComments.replace(/\s+/g, ' ');
    const matches = collapsed.match(
      /(audytorzy|zespoly_monterskie)\.findUnique\(\s*\{\s*where:\s*\{\s*email\b/g,
    );
    if (matches && matches.length > 0) {
      hits.push({ file, count: matches.length });
    }
  }
  return hits;
}

describe('AC-A7 — zero findUnique({ where: { email } }) na audytorzy/zespoly_monterskie w apps/b2b-web/src', () => {
  it('AC-A7: żaden plik źródłowy nie zawiera już żywego wywołania audytorzy/zespoly_monterskie.findUnique({ where: { email... } })', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const srcDir = join(__dirname, '..', 'src');

    const hits = countLiveFindUniqueByEmail(srcDir);

    expect(hits).toEqual([]);
  });

  it('AC-A7: liczba łączna wystąpień w całym apps/b2b-web/src jest zero (dowód globalny, niezależny od filtra ścieżki powyżej)', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const srcDir = join(__dirname, '..', 'src');

    const total = countLiveFindUniqueByEmail(srcDir).reduce((sum, hit) => sum + hit.count, 0);

    expect(total).toBe(0);
  });

  // Kontrola pozytywna: authorizedUser.findUnique po e-mailu NIE jest objęte tym
  // zamrożeniem (ma realne ograniczenie UNIQUE w bazie) — dowód, że test skanuje
  // dokładnie dwie nazwane tabele, nie każde findUnique z kluczem email w repo.
  it('kontrola pozytywna: prisma.authorizedUser.findUnique({ where: { email } }) w utils/supabase/server.ts NIE jest liczone (ma realny UNIQUE na żywej bazie, poza zakresem WO)', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const serverAuthFile = join(__dirname, '..', 'src', 'utils', 'supabase', 'server.ts');
    const raw = readFileSync(serverAuthFile, 'utf-8');

    expect(raw).toContain('authorizedUser.findUnique');
    const hits = countLiveFindUniqueByEmail(join(__dirname, '..', 'src'));
    const hitOnServerFile = hits.find((hit) => hit.file === serverAuthFile);
    expect(hitOnServerFile).toBeUndefined();
  });
});
