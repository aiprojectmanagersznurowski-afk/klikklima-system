import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: docs/workorders/FLD-QUOTE-BASKET-SELECT.md — ROZSTRZYGNIĘTY 2026-09-16.
 * Wymaganie: `FLD-QUOTE-BASKET-SELECT` (contracts/requirements.contract.mjs, status TODO).
 *
 * Kontynuacja domykania (contract-steward, 2026-09-16, "dziura 2"): AC1 wymaga, żeby wycena
 * historyczna dalej poprawnie wyświetlała etykietę koszyka, którego użyła — nawet jeśli ten
 * koszyk zostanie potem wycofany (`isActive: false`) albo jego `labelPl` się zmieni w
 * słowniku. Ten plik dowodzi statycznie, że NOWY komponent
 * `apps/b2b-web/src/app/(dashboard)/leads/[id]/lead-bookings-list.tsx` znajduje etykietę
 * WYŁĄCZNIE przez `findBasketById` (odczyt ze słownika w chwili renderowania), nigdy z pola
 * zapisanego bezpośrednio na wierszu rezerwacji (`booking.basketLabel`/literał).
 *
 * Wzorzec identyczny co `create-booking-dialog-static.test.ts` / `lead-create-booking-dialog-
 * props.test.ts` (memoria "React UI test infra limits" — brak jsdom/aliasu `@/*` w root
 * `vitest.config.mts` wyklucza pełny render Testing Library). Plik jeszcze nie istnieje —
 * `readFileSync` na nieistniejącej ścieżce rzuca `ENOENT` synchronicznie: poprawny, czytelny
 * RED tej tury.
 */

const COMPONENT_PATH = path.resolve(
  __dirname,
  '../src/app/(dashboard)/leads/[id]/lead-bookings-list.tsx',
);

function readComponent(): string {
  return readFileSync(COMPONENT_PATH, 'utf-8');
}

describe('lead-bookings-list.tsx — AC1 (etykieta koszyka odczytana ze słownika, nie zapisana na rezerwacji)', () => {
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('źródło importuje findBasketById z basket-select.ts', () => {
    const content = readComponent();
    const importMatch = content.match(
      /import\s*\{([^}]*)\}\s*from\s*["'][^"']*lib\/schedule\/basket-select["']/,
    );
    expect(importMatch).not.toBeNull();
    expect(importMatch![1]).toMatch(/\bfindBasketById\b/);
  });

  // Wołanie musi faktycznie wystąpić — sam import bez użycia nie dowodzi zachowania. Sygnatura
  // rzeczywista (`basket-select.ts`): `findBasketById(baskets: ScheduleBasket[], id: string)`.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('źródło woła findBasketById(...) w treści komponentu', () => {
    const content = readComponent();
    expect(content).toMatch(/findBasketById\(/);
  });

  // Kontrola negatywna: żadne pole typu `basketLabel`/`labelPl` NIE jest czytane wprost z
  // obiektu rezerwacji (`booking.labelPl`/`booking.basketLabel`) — jedyna droga do etykiety to
  // wynik findBasketById(...).labelPl.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('źródło nie odczytuje etykiety wprost z obiektu rezerwacji (booking.labelPl / booking.basketLabel)', () => {
    const content = readComponent();
    expect(content).not.toMatch(/booking\.labelPl/);
    expect(content).not.toMatch(/booking\.basketLabel/);
    expect(content).not.toMatch(/\.basketLabel\b/);
  });

  // Renderowana etykieta musi pochodzić z `.labelPl` na wyniku wyszukania w słowniku, a nie z
  // literału zaszytego w JSX.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('źródło renderuje .labelPl na wyniku findBasketById', () => {
    const content = readComponent();
    expect(content).toMatch(/\.labelPl\b/);
  });
});
