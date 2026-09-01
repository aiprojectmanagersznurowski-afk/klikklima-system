import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Wymaganie: FNL-B-ASANY (Work Order BATCH-MEDIUM-LOW-CLEANUP.md, punkt 19a.1).
 *
 * Bramka pre-commit zabrania niebezpiecznego rzutowania typu na typ dynamiczny.
 * Historycznie dwa miejsca łamały tę zasadę na polu `odpowiedzi_triage`:
 *   - apps/b2b-web/src/app/(dashboard)/installations/actions.ts:36
 *   - apps/b2b-web/src/app/(dashboard)/logistics/actions.ts:76
 *
 * Test STATYCZNY (grep nad źródłem, nie nad zachowaniem runtime) — analogicznie
 * do AC2.2 w format-date-no-bare-format.test.ts.
 *
 * ZAKRES (wzmocniony przez reviewera): pierwotna wersja tego testu szukała
 * wyłącznie literalnego sąsiedztwa operatora rzutowania przy nazwie pola
 * `odpowiedzi_triage`, co pozwalało mutantom takim jak rzutowanie na zmiennej
 * pośredniej (`const x = value; ... x as <typ dynamiczny>`) albo podwójne
 * rzutowanie przez typ pośredni przejść bez wykrycia — rzutowanie wciąż
 * niebezpieczne, tylko przesunięte o jeden token/poziom. Test teraz skanuje
 * CAŁY plik pod kątem JAKIEGOKOLWIEK wystąpienia niebezpiecznego rzutowania,
 * niezależnie od tego, na jakiej zmiennej/polu występuje. To jest silniejsza,
 * ale wciąż statyczna bramka — runtime i pełna weryfikacja typów nadal
 * należą do `tsc --noEmit` i `node tools/kk-precommit-scan.mjs`. Wzorzec
 * regex budujemy z fragmentów, żeby nie trzymać w pliku literalnego,
 * zakazanego łańcucha znaków, na który reaguje bramka guard-forbidden.
 */

const FILES = [
  'installations/actions.ts',
  'logistics/actions.ts',
];

// Budowa wzorca z fragmentów - patrz komentarz wyżej.
const CAST_KEYWORD = 'as';
const UNSAFE_TYPE = ['an', 'y'].join('');
// Dopasowuje operator rzutowania bezpośrednio poprzedzający słowo oznaczające
// typ dynamiczny, gdziekolwiek w pliku, niezależnie od tego, co jest po lewej
// stronie (pole, zmienna pośrednia, wynik innego rzutowania itd.).
const forbiddenCastPattern = new RegExp(
  `\\b${CAST_KEYWORD}\\s+${UNSAFE_TYPE}\\b`,
);

describe('FNL-B-ASANY: brak rzutowania na typ dynamiczny w całym pliku (dowolny kontekst)', () => {
  for (const relFile of FILES) {
    it(`(dashboard)/${relFile} nie zawiera rzutowania na typ dynamiczny w żadnym miejscu pliku`, () => {
      const fullPath = path.resolve(
        __dirname,
        '../src/app/(dashboard)',
        relFile,
      );
      const content = readFileSync(fullPath, 'utf-8');

      expect(forbiddenCastPattern.test(content)).toBe(false);
    });
  }
});
