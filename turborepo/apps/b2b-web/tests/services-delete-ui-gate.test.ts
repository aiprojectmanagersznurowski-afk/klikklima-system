import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * CRM-DELETE-ADMIN-ONLY-SERVICES — warstwa UI (contracts/requirements.contract.mjs).
 *
 * Server Action (`deleteServiceAction`, retagowana w services-authz-gates.test.ts) i RLS
 * (services-rls-deny-by-default.test.ts) mają już dedykowane testy w tym pakiecie. Warstwa
 * UI jest dziś LUKĄ REALNĄ, nie tylko brakiem pokrycia (stan przeczytany bezpośrednio przed
 * napisaniem tego testu):
 *   - `page.tsx` liczy `actorRole` przez `getCurrentActorRole()` i używa go do `can(actorRole,
 *     "services", "read")`, ale renderuje `<ServicesClient initialServices={services} />` BEZ
 *     przekazania `actorRole` jako propsa.
 *   - `services-client.tsx` przyjmuje wyłącznie `{ initialServices }` w propsach, nie
 *     importuje `can` z `@klikklima/contracts` i warunkuje przycisk "Usuń (Tylko Admin)"
 *     WYŁĄCZNIE przez `isDeleteMenuItemVisible(service)` — funkcja, która sprawdza jedynie,
 *     czy wiersz jest realnym serwisem (`source === "service"`), a NIE rolę. Przycisk jest
 *     więc dostępny dla KAŻDEJ zalogowanej roli (dyspozytor, audytor, monter) na każdym
 *     wierszu realnego serwisu, mimo że Server Action i tak odrzuci próbę usunięcia.
 * Ten test dowodzi wprost braku tej bramki i pozostanie CZERWONY do czasu, aż
 * `implementer-ui` doda `actorRole` do propsów, przekaże go z `page.tsx`, doda import `can`,
 * wyliczy `canDeleteServices` i owinie przycisk `{isDeleteMenuItemVisible(service) &&
 * canDeleteServices && (...)}`.
 *
 * DECYZJA ARCHITEKTONICZNA (test-author, uzasadnienie w podsumowaniu tury): NIE zmieniamy
 * sygnatury `isDeleteMenuItemVisible` w `menu-visibility.ts`. Ta funkcja i jej JEDNOARGUMENTOWE
 * wywołanie mają już własny, ZIELONY test przypisany do INNEGO wymagania
 * (`services-source-of-truth.test.ts`, AC9, `@REQ: SRV-SOURCE-OF-TRUTH`) — rozszerzenie jej
 * sygnatury o rolę zepsułoby ten istniejący test bez potrzeby, bo `isDeleteMenuItemVisible`
 * odpowiada za pytanie "czy wiersz jest realnym serwisem", nie za "czy ta rola może usuwać".
 * Zamiast tego, wzorem `incidents-client.tsx` / `installations-client.tsx`, dokładamy w
 * `services-client.tsx` DRUGI, NIEZALEŻNY warunek `canDeleteServices` obok istniejącego
 * `isDeleteMenuItemVisible(service)` — obie funkcje/zmienne muszą dać `true`, żeby przycisk
 * się wyrenderował. `grep -rn "isDeleteMenuItemVisible"` (wykonane przed napisaniem tego
 * testu) potwierdza jedno miejsce użycia w całym `apps/b2b-web/src` — zmiana sygnatury
 * miałaby więc tylko jednego konsumenta, ale i tak nie jest potrzebna do zamknięcia luki.
 *
 * PUŁAPKA ZNANA Z TEGO REPOZYTORIUM (leads-delete-ui-gate.test.ts,
 * .claude/agent-memory/test-author/feedback_three_layer_coverage_closure.md): sprawdzenie
 * tylko PIERWSZEGO wystąpienia przycisku łapie regresję w jednym miejscu, ale nie w drugim,
 * jeśli komponent ma tę samą kontrolkę zduplikowaną. Zweryfikowane `grep -c` przed napisaniem
 * tego testu: `services-client.tsx` ma DOKŁADNIE JEDNO wystąpienie tekstu
 * "Usuń (Tylko Admin)". Test poniżej i tak dowodzi liczby wystąpień wprost i sprawdza każde z
 * nich w pętli, żeby nie zostać cicho osłabionym, gdyby ktoś dodał drugi widok później.
 *
 * OGRANICZENIE INFRASTRUKTURALNE (ten sam wzorzec co installations-delete-ui-gate.test.ts):
 * root `vitest.config.mts` nie ma aliasu `@/*`, a `services-client.tsx` importuje moduły spod
 * `@/...` — pełny render nie jest dziś wykonalny w tym pakiecie. Testy statyczne nad treścią
 * źródła (`page.tsx` i `services-client.tsx`).
 */

const PAGE_PATH = path.resolve(__dirname, '../src/app/(dashboard)/services/page.tsx');
const CLIENT_PATH = path.resolve(
  __dirname,
  '../src/app/(dashboard)/services/services-client.tsx',
);

function readPage(): string {
  return readFileSync(PAGE_PATH, 'utf-8');
}

function readServicesClient(): string {
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

describe('services-client.tsx — przycisk "Usuń (Tylko Admin)" widoczny wyłącznie z services.delete (CRM-DELETE-ADMIN-ONLY-SERVICES)', () => {
  // @REQ: CRM-DELETE-ADMIN-ONLY-SERVICES
  it('page.tsx przekazuje actorRole jako props do <ServicesClient>', () => {
    const content = readPage();

    expect(content).toMatch(
      /<ServicesClient[^>]*\bactorRole\s*=\s*\{actorRole\}[^>]*\/>/,
    );
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-SERVICES
  it('services-client.tsx przyjmuje actorRole w propsach, importuje can z @klikklima/contracts i wylicza canDeleteServices z macierzy RBAC services.delete', () => {
    const content = readServicesClient();

    expect(content).toMatch(/import\s*\{[^}]*\bcan\b[^}]*\}\s*from\s*["']@klikklima\/contracts["']/);
    expect(content).toMatch(
      /const\s+canDeleteServices\s*=\s*!!actorRole\s*&&\s*can\(\s*actorRole\s*,\s*['"]services['"]\s*,\s*['"]delete['"]\s*\)\s*===\s*['"]yes['"]/,
    );
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-SERVICES
  it('sygnatura propsów ServicesClient (destrukturyzacja i typ) zawiera actorRole: Role | null', () => {
    const content = readServicesClient();

    const sigStart = content.indexOf('export function ServicesClient(');
    expect(
      sigStart,
      'Nie znaleziono "export function ServicesClient(" w services-client.tsx',
    ).toBeGreaterThan(-1);

    const bodyStart = content.indexOf(') {', sigStart);
    expect(
      bodyStart,
      'Nie znaleziono ") {" zamykającego sygnaturę funkcji po "export function ServicesClient("',
    ).toBeGreaterThan(sigStart);

    const signature = content.slice(sigStart, bodyStart + ') {'.length);

    // Rozbite na dwie luźniejsze asercje (zamiast jednej kruchej na dosłowny kształt z
    // dokładną interpunkcją/kolejnością) — dowodzą tego samego faktu (actorRole jest realnie
    // częścią destrukturyzacji I typu propsów <ServicesClient>), ale są odporne na kosmetyczne
    // zmiany: przecinek końcowy, kolejność pól, alias typu. Wzorem
    // incidents-delete-ui-gate.test.ts, po uwadze MINOR z review o kruchości dopasowania na
    // dosłowny kształt sygnatury.
    expect(
      signature,
      'actorRole nie jest częścią destrukturyzacji propsów <ServicesClient>',
    ).toMatch(/\{[^}]*\bactorRole\b[^}]*\}:/);
    expect(
      signature,
      'typ propsów <ServicesClient> nie zawiera "actorRole: Role | null"',
    ).toMatch(/actorRole\s*:\s*Role\s*\|\s*null/);
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-SERVICES
  it('tekst "Usuń (Tylko Admin)" występuje dokładnie raz w services-client.tsx — dowód, że jedyne wystąpienie jest sprawdzone poniżej', () => {
    const content = readServicesClient();
    const occurrences = findAllIndices(content, 'Usuń (Tylko Admin)');

    expect(
      occurrences.length,
      'Jeśli dodano legalny drugi widok z przyciskiem "Usuń (Tylko Admin)" (np. widok Kanban ' +
        'obok widoku listy), PODNIEŚ tę liczbę i rozszerz pętlę weryfikującą poniżej o nowe ' +
        'wystąpienie — nie usuwaj ani nie osłabiaj tego testu, żeby przeszedł.',
    ).toBe(1);
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-SERVICES
  it('KAŻDE wystąpienie przycisku "Usuń (Tylko Admin)" jest owinięte gate\'em zawierającym ZARÓWNO isDeleteMenuItemVisible(service) JAK I canDeleteServices', () => {
    const content = readServicesClient();
    const occurrences = findAllIndices(content, 'Usuń (Tylko Admin)');
    expect(occurrences.length).toBeGreaterThan(0);

    for (const labelIndex of occurrences) {
      // Każde wystąpienie leży wewnątrz <DropdownMenuItem ...>...</DropdownMenuItem>, który
      // z kolei jest bezpośrednim dzieckiem gate'u
      // {isDeleteMenuItemVisible(service) && canDeleteServices && (<>...
      const menuItemStart = content.lastIndexOf('<DropdownMenuItem', labelIndex);
      expect(
        menuItemStart,
        `Nie znaleziono "<DropdownMenuItem" przed wystąpieniem na indeksie ${labelIndex}`,
      ).toBeGreaterThan(-1);

      const windowBefore = content.slice(Math.max(0, menuItemStart - 250), menuItemStart);

      // Tolerancyjne na kolejność obu warunków — mutant, który zostawia TYLKO jeden z dwóch
      // (np. przywraca stary stan `isDeleteMenuItemVisible(service) && (...)` bez
      // `canDeleteServices`, albo odwrotnie: `canDeleteServices && (...)` bez sprawdzenia
      // source), musi failować tę asercję, bo brakujący warunek nie występuje w oknie.
      expect(windowBefore).toMatch(/isDeleteMenuItemVisible\(\s*service\s*\)/);
      expect(windowBefore).toMatch(/\bcanDeleteServices\b/);
      expect(windowBefore).toMatch(
        /\{\s*(?:isDeleteMenuItemVisible\(\s*service\s*\)\s*&&\s*canDeleteServices|canDeleteServices\s*&&\s*isDeleteMenuItemVisible\(\s*service\s*\))\s*&&\s*\(\s*(<>\s*)?<DropdownMenuSeparator\s*\/>\s*$/,
      );
    }
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-SERVICES
  it('<DropdownMenuSeparator /> poprzedzający przycisk usuwania NIE leży poza gate\'em canDeleteServices', () => {
    const content = readServicesClient();

    // Mutant łapany przez ten test: separator przeniesiony PRZED gate
    // (`<DropdownMenuSeparator />{canDeleteServices && ...` albo
    // `<DropdownMenuSeparator />{isDeleteMenuItemVisible(service) && ...`) zamiast wewnątrz
    // niego — taki separator jest osierocony (widoczny dla każdej roli/każdego source), mimo
    // że przycisk pod nim wciąż jest owinięty gate'em. Powyższa asercja "KAŻDE wystąpienie..."
    // tego nie łapie, bo dopuszcza brak separatora w oknie przed <DropdownMenuItem>.
    expect(content).not.toMatch(/<DropdownMenuSeparator\s*\/>\s*\{\s*canDeleteServices/);
    expect(content).not.toMatch(
      /<DropdownMenuSeparator\s*\/>\s*\{\s*isDeleteMenuItemVisible\(\s*service\s*\)\s*&&\s*(?!\s*canDeleteServices)/,
    );
  });
});
