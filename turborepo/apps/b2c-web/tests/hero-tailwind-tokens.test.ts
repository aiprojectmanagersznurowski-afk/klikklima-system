import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * BLOCKER 3 (recenzja 2026-09-24): `HomePageClient.tsx` (linie ~164, 172, 173) używa
 * `bg-[slate-950]` / `from-[slate-950]/90` / `to-[slate-950]/…` — Tailwind traktuje
 * treść w nawiasach kwadratowych jako WARTOŚĆ CSS dowolną (arbitrary value), nie jako
 * nazwę istniejącego tokenu. `background-color: slate-950` nie jest poprawną deklaracją
 * CSS, więc reguła jest po cichu odrzucana przez przeglądarkę — hero traci tło.
 * Poprawna forma to `bg-slate-950` (bez nawiasów — token już istnieje w palecie).
 *
 * Nie ma dedykowanego ID kontraktowego dla regresji wizualnej tego typu (hero nie ma
 * własnego wymagania, a B2C-NAV-STATE dotyczy nawigacji, nie stylu). Najbliższe pod
 * względem intencji jest UI-NO-HARDCODED-COLORS (ui_ux_guidelines.md §8: „zakaz
 * hardkodowanych wartości Hex/RGB w komponentach — wyłącznie tokeny") — token owinięty
 * w nawias kwadratowy jest tym samym błędem w innej postaci: deklaracją, która obchodzi
 * mechanizm tokenów Tailwind i przestaje być tokenem, mimo że wygląda jak jeden.
 *
 * Wzorzec wykrywany jest OGÓLNIE (nie tylko `slate-950`): nawias kwadratowy Tailwind
 * wokół nazwy koloru z palety + numer odcienia (np. `[slate-950]`, `[blue-600]`) jest
 * ZAWSZE błędem — wartości arbitralne istnieją dla wartości SPOZA palety (hex, rgb,
 * zmienne CSS), nie dla nazw tokenów, które już są klasami samodzielnie.
 */
describe('UI-NO-HARDCODED-COLORS — hero HomePageClient nie używa błędnych wartości arbitralnych Tailwind', () => {
  const homePath = join(process.cwd(), 'apps/b2c-web/app/HomePageClient.tsx');

  // @REQ: UI-NO-HARDCODED-COLORS
  it('plik HomePageClient.tsx istnieje', () => {
    expect(existsSync(homePath)).toBe(true);
  });

  // @REQ: UI-NO-HARDCODED-COLORS
  it('żadna klasa Tailwind nie owija nazwę tokenu palety (kolor-odcień) w nawias kwadratowy', () => {
    const content = readFileSync(homePath, 'utf8');

    // Token Tailwind = nazwa-koloru + myślnik + 2-3 cyfry odcienia, np. slate-950, blue-600.
    // Wewnątrz nawiasu kwadratowego (wartość arbitralna) to zawsze błąd — taki token
    // ma być klasą SAMĄ W SOBIE (bg-slate-950), nie wartością (bg-[slate-950]).
    const brokenArbitraryToken =
      /\[(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\]/g;

    const hits = content.match(brokenArbitraryToken);
    expect(hits).toBeNull();
  });
});
