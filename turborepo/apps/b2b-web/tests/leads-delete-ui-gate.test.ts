import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * CRM-DELETE-ADMIN-ONLY-LEADS — warstwa UI (contracts/requirements.contract.mjs).
 *
 * Server Action (`deleteLeadAction`, `apps/b2b-web/src/app/(dashboard)/leads/actions.ts`)
 * i RLS (leads-rls-deny-by-default.test.ts) mają już dedykowane testy w tym pakiecie.
 * Brakowało warstwy UI: `leads-client.tsx` renderuje przycisk "Usuń (Tylko Admin)" w
 * DWÓCH miejscach niezależnie (widok Kanban linia ~410 i widok listy linia ~528, oba
 * wewnątrz `<DropdownMenuContent>` różnych menu akcji) — implementacja przeczytana
 * bezpośrednio przed napisaniem tego testu, oba wystąpienia owinięte
 * `{canDeleteLeads && (...)}`, gdzie `canDeleteLeads` jest wyliczane z macierzy RBAC
 * (`can(actorRole, "leads", "delete") === "yes"`), nie z literału roli.
 *
 * PUŁAPKA ZNANA Z TEGO REPOZYTORIUM (leads-detail-edit-ui-gate.test.ts): sprawdzenie
 * tylko PIERWSZEGO wystąpienia przycisku łapie regresję w jednym miejscu, ale nie w
 * drugim, jeśli komponent ma tę samą kontrolkę zduplikowaną w dwóch widokach. Ten test
 * dowodzi WPROST liczby wystąpień (2) i sprawdza KAŻDE z nich osobno.
 *
 * OGRANICZENIE INFRASTRUKTURALNE (ten sam wzorzec co crews-client-admin-visibility.test.ts
 * / leads-detail-edit-ui-gate.test.ts): root `vitest.config.mts` nie ma aliasu `@/*`, a
 * `leads-client.tsx` importuje moduły spod `@/...` — pełny render nie jest dziś
 * wykonalny w tym pakiecie. Testy statyczne nad treścią źródła.
 */

const LEADS_CLIENT_PATH = path.resolve(
  __dirname,
  '../src/app/(dashboard)/leads/leads-client.tsx',
);

function readLeadsClient(): string {
  return readFileSync(LEADS_CLIENT_PATH, 'utf-8');
}

/** Zwraca WSZYSTKIE indeksy wystąpień `needle` w `haystack`. */
function findAllIndices(haystack: string, needle: string): number[] {
  const indices: number[] = [];
  let fromIndex = 0;
  while (true) {
    const idx = haystack.indexOf(needle, fromIndex);
    if (idx === -1) break;
    indices.push(idx);
    fromIndex = idx + needle.length;
  }
  return indices;
}

describe('leads-client.tsx — przycisk "Usuń (Tylko Admin)" widoczny wyłącznie z leads.delete (CRM-DELETE-ADMIN-ONLY-LEADS)', () => {
  // @REQ: CRM-DELETE-ADMIN-ONLY-LEADS
  it('importuje can z @klikklima/contracts i definiuje canDeleteLeads z macierzy RBAC leads.delete, nie z literału roli', () => {
    const content = readLeadsClient();

    expect(content).toMatch(/import\s*\{[^}]*\bcan\b[^}]*\}\s*from\s*["']@klikklima\/contracts["']/);
    expect(content).toMatch(
      /const\s+canDeleteLeads\s*=\s*!!actorRole\s*&&\s*can\(\s*actorRole\s*,\s*['"]leads['"]\s*,\s*['"]delete['"]\s*\)\s*===\s*['"]yes['"]/,
    );
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-LEADS
  it('tekst "Usuń (Tylko Admin)" występuje dokładnie dwa razy (widok Kanban i widok listy) — dowód, że oba miejsca są sprawdzane poniżej', () => {
    const content = readLeadsClient();
    const occurrences = findAllIndices(content, 'Usuń (Tylko Admin)');

    expect(
      occurrences.length,
      'Jeśli dodano legalny trzeci widok z przyciskiem "Usuń (Tylko Admin)" (np. nowy tryb ' +
        'listy/tabeli), PODNIEŚ tę liczbę i rozszerz pętlę weryfikującą poniżej o nowe ' +
        'wystąpienie — nie usuwaj ani nie osłabiaj tego testu, żeby przeszedł.',
    ).toBe(2);
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-LEADS
  it('KAŻDE wystąpienie przycisku "Usuń (Tylko Admin)" jest owinięte {canDeleteLeads && (...)}', () => {
    const content = readLeadsClient();
    const occurrences = findAllIndices(content, 'Usuń (Tylko Admin)');
    expect(occurrences.length).toBeGreaterThan(0);

    for (const labelIndex of occurrences) {
      // Każde wystąpienie leży wewnątrz <DropdownMenuItem ...>...</DropdownMenuItem>,
      // który z kolei jest bezpośrednim dzieckiem gate'u {canDeleteLeads && (<>...
      const menuItemStart = content.lastIndexOf('<DropdownMenuItem', labelIndex);
      expect(menuItemStart, `Nie znaleziono "<DropdownMenuItem" przed wystąpieniem na indeksie ${labelIndex}`).toBeGreaterThan(-1);

      // Gate szukany wstecz od <DropdownMenuItem — dopuszczamy pośredni <> (fragment)
      // wzorem obu istniejących wystąpień w pliku.
      const windowBefore = content.slice(Math.max(0, menuItemStart - 200), menuItemStart);
      expect(windowBefore).toMatch(/\{\s*canDeleteLeads\s*&&\s*\(\s*(<>\s*)?(<DropdownMenuSeparator\s*\/>\s*)?$/);
    }
  });
});
