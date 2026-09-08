import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Zadanie UI (polecenie bezpośrednie użytkownika, POZA rejestrem wymagań —
 * `contracts/requirements.contract.mjs` nie zawiera żadnego wpisu dotyczącego
 * nawigacji panelu B2B). Czysta restrukturyzacja: menu boczne "Leady" ma stać
 * się rozwijalnym submenu (wzorem istniejącego "CRM"), a filtr "Etap lejka"
 * (dziś `<select>` nad tabelą leadów w `leads-client.tsx`) ma zniknąć stamtąd
 * i stać się listą linków w tym nowym submenu. Zero zmiany logiki biznesowej
 * ani kontraktu — dlatego znaczniki poniżej to `@TASK`, nie `@REQ`: nie ma
 * wymagania w rejestrze, do którego `kk-trace.mjs` mógłby to dopasować, a
 * fałszywy `@REQ` wskazujący na nieistniejące ID tylko zaśmieciłby raport
 * `kk-trace` ostrzeżeniem o nieznanym znaczniku.
 *
 * OGRANICZENIE INFRASTRUKTURALNE (ten sam wzorzec co
 * `crews-client-admin-visibility.test.ts`): root `vitest.config.mts` nie ma
 * skonfigurowanego aliasu `@/*`, a zarówno `layout.tsx`, jak i
 * `leads-client.tsx` importują moduły spod `@/...` (`@/utils/supabase/client`,
 * `@/components/ui/badge`, `@/components/ui/button`, `@repo/database`, …).
 * Próba `await import(...)` tych plików w tym pakiecie testów pada na
 * `Cannot find package '@/components/ui/button'` — zweryfikowane ręcznie
 * przed napisaniem tego pliku, żeby nie zostawić złego REDu (błąd
 * infrastrukturalny zamiast asercji domenowej). Dlatego oba pliki są tu
 * czytane jako tekst źródłowy (`readFileSync`) i parsowane statycznie —
 * DOKŁADNIE ten sam wzorzec dowodowy co w teście dla `crews-client.tsx`.
 *
 * Testy AC2/AC3 mają wymóg "jedno źródło prawdy, nie hardkoduj listy/liczby
 * ID". Skoro pełny `import` modułu `leads-client.tsx` nie jest wykonalny (patrz
 * wyżej), "źródło prawdy" jest tu realizowane przez wyciągnięcie prawdziwej
 * tablicy `LEAD_STAGES` Z TREŚCI PLIKU (parsowanie, nie duplikowanie ręcznie
 * spisanej listy w teście) — jeśli ktoś doda etap do `LEAD_STAGES` w
 * przyszłości, test przeczyta go automatycznie z pliku źródłowego przy
 * następnym uruchomieniu, bez zmiany testu.
 */

const DASHBOARD_DIR = path.resolve(__dirname, '../src/app/(dashboard)');

function readLayout(): string {
  return readFileSync(path.join(DASHBOARD_DIR, 'layout.tsx'), 'utf-8');
}

function readLeadsClient(): string {
  return readFileSync(path.join(DASHBOARD_DIR, 'leads', 'leads-client.tsx'), 'utf-8');
}

/** Wyciąga treść nawiasu klamrowego zaczynającego się w `openIndex` (włącznie), licząc głębokość — bezpieczne wobec zagnieżdżonych `{}` (np. subItems wewnątrz navItem). */
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

/** Analogiczne do `extractBalancedBraces`, ale dla `[]` (tablica `subItems` / `LEAD_STAGES`). */
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

/** Zwraca listę `href` z tablicy `subItems` danego navItem. Pusta tablica, jeśli navItem nie ma w ogóle klucza `subItems` (dzisiejszy stan `leads`) — celowo NIE rzuca wyjątku, żeby porównanie z oczekiwaną listą dało czytelną asercję różnicy, a nie nieobsłużony wyjątek. */
function extractSubItemHrefs(navItemBlock: string): string[] {
  const subItemsDecl = /subItems\s*:\s*\[/.exec(navItemBlock);
  if (!subItemsDecl) return [];
  const openIndex = subItemsDecl.index + subItemsDecl[0].length - 1;
  const arrayBlock = extractBalancedBrackets(navItemBlock, openIndex);
  const hrefRegex = /href:\s*['"]([^'"]+)['"]/g;
  const hrefs: string[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = hrefRegex.exec(arrayBlock))) hrefs.push(hm[1]);
  return hrefs;
}

/** Analogiczne do `extractSubItemHrefs`, ale zwraca listę `label` (a nie `href`) z tablicy `subItems` danego navItem. Ta sama zasada "pusta tablica zamiast wyjątku, gdy brak subItems". */
function extractSubItemLabels(navItemBlock: string): string[] {
  const subItemsDecl = /subItems\s*:\s*\[/.exec(navItemBlock);
  if (!subItemsDecl) return [];
  const openIndex = subItemsDecl.index + subItemsDecl[0].length - 1;
  const arrayBlock = extractBalancedBrackets(navItemBlock, openIndex);
  const labelRegex = /label:\s*'([^']+)'/g;
  const labels: string[] = [];
  let lm: RegExpExecArray | null;
  while ((lm = labelRegex.exec(arrayBlock))) labels.push(lm[1]);
  return labels;
}

/**
 * Wyciąga prawdziwe ID etapów z tablicy `LEAD_STAGES` w `leads-client.tsx` —
 * jedyne źródło prawdy, żaden test nie utrzymuje własnej ręcznej kopii tej
 * listy. UWAGA: deklaracja zawiera adnotację typu z PUSTĄ parą `[]` PRZED
 * właściwym otwarciem tablicy (`... }[] = [`), więc `indexOf('[', decl.index)`
 * łapałby błędnie ten pusty nawias, a nie początek literału — dlatego openIndex
 * liczymy z końca dopasowania regexu (które celowo kończy się literalnym `[`
 * należącym już do samego literału tablicy), a nie przez kolejne szukanie `[`.
 */
function extractLeadStageIds(leadsClientContent: string): string[] {
  const decl = /export const LEAD_STAGES[^=]*=\s*\[/.exec(leadsClientContent);
  if (!decl) {
    throw new Error('Nie znaleziono deklaracji "export const LEAD_STAGES" w leads-client.tsx');
  }
  const openIndex = decl.index + decl[0].length - 1;
  const arrayBlock = extractBalancedBrackets(leadsClientContent, openIndex);
  const idRegex = /id:\s*"([^"]+)"/g;
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = idRegex.exec(arrayBlock))) ids.push(m[1]);
  return ids;
}

/** Analogiczne do `extractLeadStageIds`, ale zwraca listę `title` (a nie `id`) z `LEAD_STAGES`, w tej samej kolejności — jedyne źródło prawdy dla treści etykiet, żaden test nie utrzymuje ręcznej kopii. */
function extractLeadStageTitles(leadsClientContent: string): string[] {
  const decl = /export const LEAD_STAGES[^=]*=\s*\[/.exec(leadsClientContent);
  if (!decl) {
    throw new Error('Nie znaleziono deklaracji "export const LEAD_STAGES" w leads-client.tsx');
  }
  const openIndex = decl.index + decl[0].length - 1;
  const arrayBlock = extractBalancedBrackets(leadsClientContent, openIndex);
  const titleRegex = /title:\s*"([^"]+)"/g;
  const titles: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = titleRegex.exec(arrayBlock))) titles.push(m[1]);
  return titles;
}

describe('Sidebar B2B — "Leady" jako rozwijalne submenu (layout.tsx)', () => {
  // @TASK: UI-LEADS-NAV-SUBMENU
  it('navItem "leads" ma klucz subItems (nie jest już gołym linkiem href bez rozwijania)', () => {
    const block = extractNavItemBlock(readLayout(), 'leads');
    expect(block).toMatch(/subItems\s*:\s*\[/);
  });

  // @TASK: UI-LEADS-NAV-SUBMENU
  it('liczba pozycji w subItems navItem "leads" odpowiada liczbie pozycji w LEAD_STAGES (jedno źródło prawdy, bez hardkodowania liczby)', () => {
    const stageIds = extractLeadStageIds(readLeadsClient());
    // Kontrola sanity samego parsera/źródła — gdyby LEAD_STAGES kiedyś wyparował
    // z pliku (literówka w eksporcie), lepiej dostać czytelny błąd tutaj niż
    // milczące porównanie 0 === 0.
    expect(stageIds.length).toBeGreaterThan(0);

    const subItemHrefs = extractSubItemHrefs(extractNavItemBlock(readLayout(), 'leads'));
    expect(subItemHrefs.length).toBe(stageIds.length);
  });

  // @TASK: UI-LEADS-NAV-SUBMENU
  it('każdy href w subItems navItem "leads" ma postać /leads?status=<id> dla każdego id z LEAD_STAGES, w tej samej kolejności (LEAD_STAGES.map(s => `/leads?status=${s.id}`))', () => {
    const stageIds = extractLeadStageIds(readLeadsClient());
    const expectedHrefs = stageIds.map((id) => `/leads?status=${id}`);

    const subItemHrefs = extractSubItemHrefs(extractNavItemBlock(readLayout(), 'leads'));
    expect(subItemHrefs).toEqual(expectedHrefs);
  });

  // @TASK: UI-LEADS-NAV-SUBMENU
  it('każdy label w subItems navItem "leads" odpowiada title z LEAD_STAGES, w tej samej kolejności (label w layout.tsx ma pochodzić z LEAD_STAGES.title, nie być niezależnym literałem)', () => {
    const stageTitles = extractLeadStageTitles(readLeadsClient());
    expect(stageTitles.length).toBeGreaterThan(0);

    const subItemLabels = extractSubItemLabels(extractNavItemBlock(readLayout(), 'leads'));
    expect(subItemLabels).toEqual(stageTitles);
  });
});

describe('leads-client.tsx — filtr "Etap lejka" usunięty z JSX nad tabelą (przeniesiony do submenu)', () => {
  // @TASK: UI-LEADS-NAV-SUBMENU
  it('treść pliku nie zawiera już etykiety "Etap lejka:" (dowód usunięcia bloku <select>)', () => {
    const content = readLeadsClient();
    expect(content).not.toContain('Etap lejka:');
  });

  // Przypadek "zawsze dopisujesz" — dowód, że usunięcie filtra nie zepsuło
  // paginacji, która współdzieli `buildPageUrl`. Ten test NIE jest RED wobec
  // dzisiejszego stanu pliku (paginacja już dziś woła buildPageUrl 3 razy) —
  // to strażnik regresji na przyszłość, ma zostać zielony przed i po zmianie.
  // @TASK: UI-LEADS-NAV-SUBMENU
  it('buildPageUrl wciąż istnieje i jest wciąż używane przez paginację (≥3 wywołania) po usunięciu bloku filtra', () => {
    const content = readLeadsClient();

    expect(content).toMatch(/const\s+buildPageUrl\s*=/);

    const callSites = content.match(/buildPageUrl\(/g) ?? [];
    expect(callSites.length).toBeGreaterThanOrEqual(3);
  });
});
