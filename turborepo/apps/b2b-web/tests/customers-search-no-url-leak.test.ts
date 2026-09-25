import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: audyt bezpieczeństwa 2026-09-24 (worktree feat/crm-cards), MAJOR —
 * `customers-client.tsx` wpisuje frazę wyszukiwania do query stringu URL-a
 * (`router.push(\`/customers?${params.toString()}\`)`, gdzie `params.set("q", searchQuery...)`).
 * Nazwisko/telefon/e-mail klienta trafia do historii przeglądarki, nagłówka `Referer` i logów
 * serwera — to jest wyciek PII przez kanał, który nie jest bazą danych.
 *
 * Test statyczny nad TEKSTEM źródła (wzorzec `format-date-no-bare-format.test.ts` /
 * `customers-anonymize-rodo.test.ts` AC4), nie nad zachowaniem runtime — plik jest komponentem
 * klienckim ('use client'), a `React UI test infra limits` (pamięć test-authora) ustala, że
 * root `vitest.config.mts` nie ma jsdom/RTL, więc statyczny skan tekstu jest jedyną dostępną
 * warstwą bez zmiany infrastruktury.
 *
 * REGEX OSTROŻNIE: wymaga OBU elementów w niedalekiej odległości — `params.set(...,"q"...)`
 * ORAZ `router.push` z `params.toString()` w tym samym literale szablonu — żeby NIE łapać
 * legalnej nawigacji, która nie dotyka wyszukiwania (np. `router.push(prevHref)` przy
 * paginacji, `router.push(\`/customers/${item.id}\`)` przy kliknięciu wiersza — żadne z nich
 * nie zawiera `params.toString()`).
 *
 * Żadne istniejące ID nie opisuje wprost "fraza wyszukiwania PII w URL-u" — `CRM-KLI-AC2`
 * (fallback wskazany w Work Orderze) jest dziś o wąskim odczycie dla audytora/montera, inny
 * problem w innym pliku. Tag zostaje jako fallback zgodnie z instrukcją zlecenia.
 */

const FILE_PATH = path.resolve(
  __dirname,
  '../src/app/(dashboard)/customers/customers-client.tsx',
);

describe('customers-client.tsx — fraza wyszukiwania nie trafia do URL-a (MAJOR)', () => {
  // @REQ: CRM-KLI-AC2 (fallback — patrz nagłówek pliku)
  it('brak wzorca params.set("q", ...) połączonego z router.push(...params.toString()...) w tym samym literale szablonu', () => {
    const content = readFileSync(FILE_PATH, 'utf-8');

    const leaksSearchQueryToUrl =
      /params\.set\(\s*["']q["'][\s\S]{0,400}?router\.push\(\s*[`'"][^`'"]*\$\{[^}]*params\.toString\(\)[^}]*\}/;

    expect(content).not.toMatch(leaksSearchQueryToUrl);
  });
});
