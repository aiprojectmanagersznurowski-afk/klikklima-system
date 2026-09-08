import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Zgłoszenie błędu bezpośrednio od użytkownika (nie wymaganie z rejestru —
 * `contracts/requirements.contract.mjs` nie zawiera żadnego wpisu dotyczącego
 * nawigacji panelu B2B), dlatego znaczniki poniżej to `@TASK`, nie `@REQ`.
 *
 * Zgłoszenie: "w menu ustawień strona z użytkownikami jest nadal wyszarzona -
 * nie widzę gdzie mogę zarządzać userami w panelu b2b". Pozycja submenu
 * "Użytkownicy i Uprawnienia" w `navItems` (grupa `settings`) wskazuje dziś na
 * `href: '/settings/rbac'` z flagą `comingSoon: true` (martwy placeholder —
 * `apps/b2b-web/src/app/(dashboard)/settings/rbac/page.tsx` to sam tekst
 * "Moduł w przygotowaniu."). Tymczasem prawdziwa, w pełni działająca strona
 * zarządzania kontami/rolami żyje pod `/settings`
 * (`apps/b2b-web/src/app/(dashboard)/settings/page.tsx` + `SettingsClient.tsx`)
 * i nie ma do niej żadnego linku w menu. Naprawa: pozycja ma wskazywać na
 * `href: '/settings'` i przestać być `comingSoon`.
 *
 * OGRANICZENIE INFRASTRUKTURALNE (ten sam wzorzec co
 * `leads-nav-submenu.test.ts` / `crews-client-admin-visibility.test.ts`): root
 * `vitest.config.mts` nie ma skonfigurowanego aliasu `@/*`, a `layout.tsx`
 * importuje moduły spod `@/...` (`@/utils/supabase/client`, `@/lib/utils`,
 * `@/components/ui/badge`). Próba `await import(...)` tego pliku w tym
 * pakiecie testów pada na "Cannot find package '@/utils/supabase/client'" —
 * zweryfikowane ręcznie przed napisaniem tego pliku, żeby nie zostawić złego
 * REDu (błąd infrastrukturalny zamiast asercji domenowej). Dlatego plik jest
 * tu czytany jako tekst źródłowy (`readFileSync`) i parsowany statycznie,
 * DOKŁADNIE ten sam wzorzec dowodowy co w `leads-nav-submenu.test.ts`.
 */

const DASHBOARD_DIR = path.resolve(__dirname, '../src/app/(dashboard)');

function readLayout(): string {
  return readFileSync(path.join(DASHBOARD_DIR, 'layout.tsx'), 'utf-8');
}

/** Wyciąga treść nawiasu klamrowego zaczynającego się w `openIndex` (włącznie), licząc głębokość — bezpieczne wobec zagnieżdżonych `{}`. */
function extractBalancedBraces(content: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) return content.slice(openIndex, i + 1);
    }
  }
  throw new Error('Nie znaleziono zamykającego "}" — niezbalansowane nawiasy klamrowe.');
}

/** Analogiczne do `extractBalancedBraces`, ale dla `[]` (tablica `subItems`). */
function extractBalancedBrackets(content: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < content.length; i++) {
    if (content[i] === '[') depth++;
    else if (content[i] === ']') {
      depth--;
      if (depth === 0) return content.slice(openIndex, i + 1);
    }
  }
  throw new Error('Nie znaleziono zamykającego "]" — niezbalansowane nawiasy kwadratowe.');
}

/** Wycina cały obiekt navItem o danym `id` z tablicy `navItems` w `layout.tsx`, z brace-balancingiem (żeby nie uciąć na pierwszym `}` napotkanym wewnątrz zagnieżdżonego `subItems`). */
function extractNavItemBlock(layoutContent: string, id: string): string {
  const marker = new RegExp(`\\{\\s*id:\\s*['"]${id}['"]`);
  const m = marker.exec(layoutContent);
  if (!m) {
    throw new Error(`Nie znaleziono navItem o id '${id}' w layout.tsx`);
  }
  const openIndex = layoutContent.indexOf('{', m.index);
  return extractBalancedBraces(layoutContent, openIndex);
}

/** Wyciąga treść tablicy `subItems: [...]` danego navItem (bez otaczającego navItem). Rzuca, jeśli navItem nie ma `subItems` — dla tego testu brak `subItems` w grupie `settings` byłby sam w sobie regresją wartą głośnej awarii, nie cichego pominięcia. */
function extractSubItemsArrayBlock(navItemBlock: string): string {
  const subItemsDecl = /subItems\s*:\s*\[/.exec(navItemBlock);
  if (!subItemsDecl) {
    throw new Error('navItem nie zawiera klucza "subItems" — oczekiwano submenu.');
  }
  const openIndex = subItemsDecl.index + subItemsDecl[0].length - 1;
  return extractBalancedBrackets(navItemBlock, openIndex);
}

/**
 * Wyszukuje w tablicy `subItems` (jako tekst) obiekt zawierający dany `label`
 * i zwraca jego pełną, zbalansowaną treść `{ ... }`. Szukanie po etykiecie
 * (nie po `id`), bo naprawa może przy okazji zmienić `id` wpisu — test nie
 * powinien być na to kruchy, ma pilnować wyłącznie `href`/`comingSoon` dla
 * KONKRETNEJ widocznej dla użytkownika pozycji menu.
 */
function extractSubItemByLabel(subItemsArrayBlock: string, label: string): string {
  const labelMarker = new RegExp(`label:\\s*'${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`);
  const lm = labelMarker.exec(subItemsArrayBlock);
  if (!lm) {
    throw new Error(`Nie znaleziono pozycji subItems o label '${label}'`);
  }
  const objStart = subItemsArrayBlock.lastIndexOf('{', lm.index);
  if (objStart === -1) {
    throw new Error(`Znaleziono label '${label}', ale nie znaleziono poprzedzającego '{' otwierającego obiekt.`);
  }
  return extractBalancedBraces(subItemsArrayBlock, objStart);
}

describe('Sidebar B2B — pozycja "Użytkownicy i Uprawnienia" ma prowadzić do działającej strony /settings (nie do martwego /settings/rbac)', () => {
  // @TASK: UI-SETTINGS-NAV-LINK-FIX
  it('href pozycji "Użytkownicy i Uprawnienia" w subItems grupy settings to dokładnie "/settings" (nie "/settings/rbac")', () => {
    const settingsBlock = extractNavItemBlock(readLayout(), 'settings');
    const subItemsArrayBlock = extractSubItemsArrayBlock(settingsBlock);
    const entry = extractSubItemByLabel(subItemsArrayBlock, 'Użytkownicy i Uprawnienia');

    const hrefMatch = /href:\s*['"]([^'"]+)['"]/.exec(entry);
    expect(hrefMatch).not.toBeNull();
    expect(hrefMatch![1]).toBe('/settings');
  });

  // @TASK: UI-SETTINGS-NAV-LINK-FIX
  it('pozycja "Użytkownicy i Uprawnienia" nie jest już oznaczona jako comingSoon: true', () => {
    const settingsBlock = extractNavItemBlock(readLayout(), 'settings');
    const subItemsArrayBlock = extractSubItemsArrayBlock(settingsBlock);
    const entry = extractSubItemByLabel(subItemsArrayBlock, 'Użytkownicy i Uprawnienia');

    expect(entry).not.toMatch(/comingSoon\s*:\s*true/);
  });

  // @TASK: UI-SETTINGS-NAV-LINK-FIX
  it('wycięty blok subItems grupy "settings" nie zawiera przypadkiem innej pozycji z tym samym href "/settings" (dowód, że asercje wyżej dotyczą wyłącznie właściwego wpisu, a nie złapały coś przez przypadek w całym pliku)', () => {
    const settingsBlock = extractNavItemBlock(readLayout(), 'settings');
    const subItemsArrayBlock = extractSubItemsArrayBlock(settingsBlock);

    const hrefRegex = /href:\s*['"]([^'"]+)['"]/g;
    const hrefs: string[] = [];
    let hm: RegExpExecArray | null;
    while ((hm = hrefRegex.exec(subItemsArrayBlock))) hrefs.push(hm[1]);

    const occurrencesOfSettingsHref = hrefs.filter((h) => h === '/settings').length;
    expect(occurrencesOfSettingsHref).toBe(1);
  });
});
