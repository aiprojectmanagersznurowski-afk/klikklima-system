import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * CRM-DELETE-ADMIN-ONLY-INSTALLATIONS — warstwa UI (contracts/requirements.contract.mjs).
 *
 * Server Action (`deleteInstallationAction`,
 * `apps/b2b-web/src/app/(dashboard)/installations/actions.ts`) i RLS
 * (installations-rls-deny-by-default.test.ts) mają już dedykowane testy w tym pakiecie.
 * Warstwa UI jest dziś LUKĄ REALNĄ, nie tylko brakiem pokrycia (stan przeczytany bezpośrednio
 * przed napisaniem tego testu):
 *   - `page.tsx` liczy `actorRole` przez `getCurrentActorRole()` i używa go do `can(actorRole,
 *     "installations", "read")`, ale renderuje `<InstallationsClient initialInstallations=
 *     {installations} />` BEZ przekazania `actorRole` jako propsa.
 *   - `installations-client.tsx` przyjmuje wyłącznie `{ initialInstallations }` w propsach,
 *     nie importuje `can` z `@klikklima/contracts` i renderuje przycisk "Usuń (Tylko Admin)"
 *     BEZWARUNKOWO wewnątrz `<DropdownMenuContent>` (linia ~237), dostępny dla KAŻDEJ
 *     zalogowanej roli (dyspozytor, audytor, monter), mimo że Server Action i tak odrzuci
 *     próbę usunięcia.
 * Ten test dowodzi wprost braku tej bramki i pozostanie CZERWONY do czasu, aż
 * `implementer-ui` doda `actorRole` do propsów, przekaże go z `page.tsx`, doda import `can`
 * i owinie przycisk `{canDeleteInstallations && (...)}`.
 *
 * PUŁAPKA ZNANA Z TEGO REPOZYTORIUM (leads-delete-ui-gate.test.ts,
 * .claude/agent-memory/test-author/feedback_three_layer_coverage_closure.md): sprawdzenie
 * tylko PIERWSZEGO wystąpienia przycisku łapie regresję w jednym miejscu, ale nie w drugim,
 * jeśli komponent ma tę samą kontrolkę zduplikowaną. Zweryfikowane `grep -c` przed napisaniem
 * tego testu: `installations-client.tsx` ma DOKŁADNIE JEDNO wystąpienie tekstu
 * "Usuń (Tylko Admin)" — inaczej niż `leads-client.tsx` (dwa widoki). Test poniżej i tak
 * dowodzi liczby wystąpień wprost i sprawdza każde z nich w pętli, żeby nie zostać cicho
 * osłabionym, gdyby ktoś dodał drugi widok później.
 *
 * OGRANICZENIE INFRASTRUKTURALNE (ten sam wzorzec co leads-delete-ui-gate.test.ts): root
 * `vitest.config.mts` nie ma aliasu `@/*`, a `installations-client.tsx` importuje moduły spod
 * `@/...` — pełny render nie jest dziś wykonalny w tym pakiecie. Testy statyczne nad treścią
 * źródła (`page.tsx` i `installations-client.tsx`).
 */

const PAGE_PATH = path.resolve(__dirname, '../src/app/(dashboard)/installations/page.tsx');
const CLIENT_PATH = path.resolve(
  __dirname,
  '../src/app/(dashboard)/installations/installations-client.tsx',
);

function readPage(): string {
  return readFileSync(PAGE_PATH, 'utf-8');
}

function readInstallationsClient(): string {
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

describe('installations-client.tsx — przycisk "Usuń (Tylko Admin)" widoczny wyłącznie z installations.delete (CRM-DELETE-ADMIN-ONLY-INSTALLATIONS)', () => {
  // @REQ: CRM-DELETE-ADMIN-ONLY-INSTALLATIONS
  it('page.tsx przekazuje actorRole jako props do <InstallationsClient>', () => {
    const content = readPage();

    expect(content).toMatch(
      /<InstallationsClient[^>]*\bactorRole\s*=\s*\{actorRole\}[^>]*\/>/,
    );
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INSTALLATIONS
  it('installations-client.tsx przyjmuje actorRole w propsach, importuje can z @klikklima/contracts i wylicza canDeleteInstallations z macierzy RBAC installations.delete', () => {
    const content = readInstallationsClient();

    expect(content).toMatch(/import\s*\{[^}]*\bcan\b[^}]*\}\s*from\s*["']@klikklima\/contracts["']/);
    expect(content).toMatch(
      /const\s+canDeleteInstallations\s*=\s*!!actorRole\s*&&\s*can\(\s*actorRole\s*,\s*['"]installations['"]\s*,\s*['"]delete['"]\s*\)\s*===\s*['"]yes['"]/,
    );
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INSTALLATIONS
  it('sygnatura propsów <InstallationsClient> (destrukturyzacja i typ) zawiera actorRole: Role | null', () => {
    const content = readInstallationsClient();

    const sigStart = content.indexOf('export function InstallationsClient(');
    expect(
      sigStart,
      'Nie znaleziono "export function InstallationsClient(" w installations-client.tsx',
    ).toBeGreaterThan(-1);

    const bodyStart = content.indexOf(') {', sigStart);
    expect(
      bodyStart,
      'Nie znaleziono ") {" zamykającego sygnaturę funkcji po "export function InstallationsClient("',
    ).toBeGreaterThan(sigStart);

    const signature = content.slice(sigStart, bodyStart + ') {'.length);

    // Sprawdza dokładny kształt propsów tego komponentu (destrukturyzacja + typ inline), nie
    // sam fakt, że słowo "actorRole" gdzieś w pliku występuje — to dowodzi, że `actorRole` jest
    // realnie częścią sygnatury <InstallationsClient>, wzorem sprawdzenia
    // `EditLeadModalProps` w leads-detail-edit-ui-gate.test.ts.
    expect(signature).toMatch(
      /\{\s*initialInstallations\s*,\s*actorRole\s*,?\s*\}:\s*\{\s*initialInstallations:\s*InstallationSummary\[\]\s*actorRole:\s*Role\s*\|\s*null\s*\}/,
    );
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INSTALLATIONS
  it('tekst "Usuń (Tylko Admin)" występuje dokładnie raz w installations-client.tsx — dowód, że jedyne wystąpienie jest sprawdzone poniżej', () => {
    const content = readInstallationsClient();
    const occurrences = findAllIndices(content, 'Usuń (Tylko Admin)');

    expect(
      occurrences.length,
      'Jeśli dodano legalny drugi widok z przyciskiem "Usuń (Tylko Admin)" (np. widok ' +
        'Kanban obok widoku listy), PODNIEŚ tę liczbę i rozszerz pętlę weryfikującą poniżej ' +
        'o nowe wystąpienie — nie usuwaj ani nie osłabiaj tego testu, żeby przeszedł.',
    ).toBe(1);
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INSTALLATIONS
  it('KAŻDE wystąpienie przycisku "Usuń (Tylko Admin)" jest owinięte {canDeleteInstallations && (...)}', () => {
    const content = readInstallationsClient();
    const occurrences = findAllIndices(content, 'Usuń (Tylko Admin)');
    expect(occurrences.length).toBeGreaterThan(0);

    for (const labelIndex of occurrences) {
      // Każde wystąpienie leży wewnątrz <DropdownMenuItem ...>...</DropdownMenuItem>, który
      // z kolei jest bezpośrednim dzieckiem gate'u {canDeleteInstallations && (<>...
      const menuItemStart = content.lastIndexOf('<DropdownMenuItem', labelIndex);
      expect(
        menuItemStart,
        `Nie znaleziono "<DropdownMenuItem" przed wystąpieniem na indeksie ${labelIndex}`,
      ).toBeGreaterThan(-1);

      const windowBefore = content.slice(Math.max(0, menuItemStart - 200), menuItemStart);
      expect(windowBefore).toMatch(
        /\{\s*canDeleteInstallations\s*&&\s*\(\s*(<>\s*)?<DropdownMenuSeparator\s*\/>\s*$/,
      );
    }
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-INSTALLATIONS
  it('<DropdownMenuSeparator /> poprzedzający przycisk usuwania NIE leży poza gate\'em {canDeleteInstallations && (...)}', () => {
    const content = readInstallationsClient();

    // Mutant łapany przez ten test: separator przeniesiony PRZED gate
    // (`<DropdownMenuSeparator />{canDeleteInstallations && (<>…`) zamiast wewnątrz niego —
    // taki separator jest osierocony (widoczny dla każdej roli), mimo że przycisk pod nim
    // wciąż jest owinięty gate'em. Powyższa asercja "KAŻDE wystąpienie..." tego nie łapie,
    // bo dopuszcza brak separatora w oknie przed <DropdownMenuItem>.
    expect(content).not.toMatch(/<DropdownMenuSeparator\s*\/>\s*\{\s*canDeleteInstallations/);
  });
});
