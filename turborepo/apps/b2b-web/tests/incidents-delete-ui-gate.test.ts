import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * CRM-DELETE-ADMIN-ONLY-INCIDENTS — warstwa UI (contracts/requirements.contract.mjs).
 *
 * Server Action (`deleteIncidentAction`,
 * `apps/b2b-web/src/app/(dashboard)/incidents/actions.ts`) i RLS
 * (incidents-rls-deny-by-default.test.ts) mają już dedykowane testy w tym pakiecie. Warstwa
 * UI jest dziś LUKĄ REALNĄ, nie tylko brakiem pokrycia (stan przeczytany bezpośrednio przed
 * napisaniem tego testu):
 *   - `page.tsx` liczy `actorRole` przez `getCurrentActorRole()` i używa go do `can(actorRole,
 *     "incidents", "read")`, ale renderuje `<IncidentsClient initialIncidents={incidents} />`
 *     BEZ przekazania `actorRole` jako propsa.
 *   - `incidents-client.tsx` przyjmuje wyłącznie `{ initialIncidents }` w propsach, nie
 *     importuje `can` z `@klikklima/contracts` i renderuje przycisk "Usuń (Tylko Admin)"
 *     BEZWARUNKOWO wewnątrz `<DropdownMenuContent>` (linia ~104), dostępny dla KAŻDEJ
 *     zalogowanej roli (dyspozytor, audytor, monter), mimo że Server Action i tak odrzuci
 *     próbę usunięcia.
 * Ten test dowodzi wprost braku tej bramki i pozostanie CZERWONY do czasu, aż
 * `implementer-ui` doda `actorRole` do propsów, przekaże go z `page.tsx`, doda import `can`
 * i owinie przycisk `{canDeleteIncidents && (...)}`.
 *
 * PUŁAPKA ZNANA Z TEGO REPOZYTORIUM (leads-delete-ui-gate.test.ts,
 * .claude/agent-memory/test-author/feedback_three_layer_coverage_closure.md): sprawdzenie
 * tylko PIERWSZEGO wystąpienia przycisku łapie regresję w jednym miejscu, ale nie w drugim,
 * jeśli komponent ma tę samą kontrolkę zduplikowaną. Zweryfikowane `grep -c` przed napisaniem
 * tego testu: `incidents-client.tsx` ma DOKŁADNIE JEDNO wystąpienie tekstu
 * "Usuń (Tylko Admin)". Test poniżej i tak dowodzi liczby wystąpień wprost i sprawdza każde z
 * nich w pętli, żeby nie zostać cicho osłabionym, gdyby ktoś dodał drugi widok później.
 *
 * OGRANICZENIE INFRASTRUKTURALNE (ten sam wzorzec co leads-delete-ui-gate.test.ts /
 * installations-delete-ui-gate.test.ts): root `vitest.config.mts` nie ma aliasu `@/*`, a
 * `incidents-client.tsx` importuje moduły spod `@/...` — pełny render nie jest dziś wykonalny
 * w tym pakiecie. Testy statyczne nad treścią źródła (`page.tsx` i `incidents-client.tsx`).
 */

const PAGE_PATH = path.resolve(__dirname, '../src/app/(dashboard)/incidents/page.tsx');
const CLIENT_PATH = path.resolve(
  __dirname,
  '../src/app/(dashboard)/incidents/incidents-client.tsx',
);

function readPage(): string {
  return readFileSync(PAGE_PATH, 'utf-8');
}

function readIncidentsClient(): string {
  return readFileSync(CLIENT_PATH, 'utf-8');
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

describe('incidents-client.tsx — przycisk "Usuń (Tylko Admin)" widoczny wyłącznie z incidents.delete (CRM-DELETE-ADMIN-ONLY-INCIDENTS)', () => {
  // @REQ: CRM-DELETE-ADMIN-ONLY-INCIDENTS
  it('page.tsx przekazuje actorRole jako props do <IncidentsClient>', () => {
    const content = readPage();

    expect(content).toMatch(
      /<IncidentsClient[^>]*\bactorRole\s*=\s*\{actorRole\}[^>]*\/>/,
    );
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INCIDENTS
  it('incidents-client.tsx przyjmuje actorRole w propsach, importuje can z @klikklima/contracts i wylicza canDeleteIncidents z macierzy RBAC incidents.delete', () => {
    const content = readIncidentsClient();

    expect(content).toMatch(/import\s*\{[^}]*\bcan\b[^}]*\}\s*from\s*["']@klikklima\/contracts["']/);
    expect(content).toMatch(
      /const\s+canDeleteIncidents\s*=\s*!!actorRole\s*&&\s*can\(\s*actorRole\s*,\s*['"]incidents['"]\s*,\s*['"]delete['"]\s*\)\s*===\s*['"]yes['"]/,
    );
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INCIDENTS
  it('sygnatura propsów <IncidentsClient> (destrukturyzacja i typ) zawiera actorRole: Role | null', () => {
    const content = readIncidentsClient();

    const sigStart = content.indexOf('export function IncidentsClient(');
    expect(
      sigStart,
      'Nie znaleziono "export function IncidentsClient(" w incidents-client.tsx',
    ).toBeGreaterThan(-1);

    const bodyStart = content.indexOf(') {', sigStart);
    expect(
      bodyStart,
      'Nie znaleziono ") {" zamykającego sygnaturę funkcji po "export function IncidentsClient("',
    ).toBeGreaterThan(sigStart);

    const signature = content.slice(sigStart, bodyStart + ') {'.length);

    // Rozbite na dwie luźniejsze asercje (zamiast jednej kruchej na dosłowny kształt z
    // dokładną interpunkcją/kolejnością) — dowodzą tego samego faktu (actorRole jest realnie
    // częścią destrukturyzacji I typu propsów <IncidentsClient>), ale są odporne na
    // kosmetyczne zmiany: przecinek końcowy, kolejność pól, alias typu. Wzorem
    // sprawdzenia `InstallationsClient` w installations-delete-ui-gate.test.ts, ale bez
    // wymuszania dokładnej interpunkcji reszty sygnatury.
    expect(
      signature,
      'actorRole nie jest częścią destrukturyzacji propsów <IncidentsClient>',
    ).toMatch(/\{[^}]*\bactorRole\b[^}]*\}:/);
    expect(
      signature,
      'typ propsów <IncidentsClient> nie zawiera "actorRole: Role | null"',
    ).toMatch(/actorRole\s*:\s*Role\s*\|\s*null/);
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INCIDENTS
  it('tekst "Usuń (Tylko Admin)" występuje dokładnie raz w incidents-client.tsx — dowód, że jedyne wystąpienie jest sprawdzone poniżej', () => {
    const content = readIncidentsClient();
    const occurrences = findAllIndices(content, 'Usuń (Tylko Admin)');

    expect(
      occurrences.length,
      'Jeśli dodano legalny drugi widok z przyciskiem "Usuń (Tylko Admin)" (np. widok Kanban ' +
        'obok widoku kart), PODNIEŚ tę liczbę i rozszerz pętlę weryfikującą poniżej o nowe ' +
        'wystąpienie — nie usuwaj ani nie osłabiaj tego testu, żeby przeszedł.',
    ).toBe(1);
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INCIDENTS
  it('KAŻDE wystąpienie przycisku "Usuń (Tylko Admin)" jest owinięte {canDeleteIncidents && (...)}', () => {
    const content = readIncidentsClient();
    const occurrences = findAllIndices(content, 'Usuń (Tylko Admin)');
    expect(occurrences.length).toBeGreaterThan(0);

    for (const labelIndex of occurrences) {
      // Każde wystąpienie leży wewnątrz <DropdownMenuItem ...>...</DropdownMenuItem>, który
      // z kolei jest bezpośrednim dzieckiem gate'u {canDeleteIncidents && (<>...
      const menuItemStart = content.lastIndexOf('<DropdownMenuItem', labelIndex);
      expect(
        menuItemStart,
        `Nie znaleziono "<DropdownMenuItem" przed wystąpieniem na indeksie ${labelIndex}`,
      ).toBeGreaterThan(-1);

      const windowBefore = content.slice(Math.max(0, menuItemStart - 200), menuItemStart);
      expect(windowBefore).toMatch(
        /\{\s*canDeleteIncidents\s*&&\s*\(\s*(<>\s*)?<DropdownMenuSeparator\s*\/>\s*$/,
      );
    }
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INCIDENTS
  it('<DropdownMenuSeparator /> poprzedzający przycisk usuwania NIE leży poza gate\'em {canDeleteIncidents && (...)}', () => {
    const content = readIncidentsClient();

    // Mutant łapany przez ten test: separator przeniesiony PRZED gate
    // (`<DropdownMenuSeparator />{canDeleteIncidents && (<>…`) zamiast wewnątrz niego — taki
    // separator jest osierocony (widoczny dla każdej roli), mimo że przycisk pod nim wciąż
    // jest owinięty gate'em. Powyższa asercja "KAŻDE wystąpienie..." tego nie łapie, bo
    // dopuszcza brak separatora w oknie przed <DropdownMenuItem>.
    expect(content).not.toMatch(/<DropdownMenuSeparator\s*\/>\s*\{\s*canDeleteIncidents/);
  });
});
