import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * CRM-DELETE-ADMIN-ONLY-AUDITORS — warstwa UI (contracts/requirements.contract.mjs).
 *
 * Server Action (`deleteAuditorAction`, `apps/b2b-web/src/app/(dashboard)/auditors/actions.ts`)
 * i RLS (auditors-rls-deny-by-default.test.ts) mają już dedykowane testy w tym pakiecie.
 * Brakowało warstwy UI: `auditors-client.tsx` renderuje przycisk "Usuń (Tylko Admin)" w
 * JEDNYM miejscu (jedna karta audytora w widoku siatki, wewnątrz
 * `<DropdownMenuContent>` menu akcji) — implementacja przeczytana bezpośrednio przed
 * napisaniem tego testu (`grep -c "Usuń (Tylko Admin)"` → 1), owinięte
 * `{canDeleteAuditors && (...)}`, gdzie `canDeleteAuditors` jest wyliczane z macierzy RBAC
 * (`can(actorRole, "auditors", "delete") === "yes"`), nie z literału roli.
 *
 * PUŁAPKA ZNANA Z TEGO REPOZYTORIUM (leads-client.tsx, dwa wystąpienia; crews-client.tsx,
 * osierocony separator): sprawdzenie tylko PIERWSZEGO wystąpienia przycisku łapie
 * regresję w jednym miejscu, ale nie w drugim, gdy jest ich więcej — i sprawdzenie
 * samego gate'u bez sąsiadującego separatora nie łapie separatora POZOSTAWIONEGO poza
 * warunkiem, gdy gate zostanie przesunięty. Ten test dowodzi WPROST liczby wystąpień (1)
 * i sprawdza je pętlą (na wypadek gdyby przyszła zmiana dodała drugie miejsce bez
 * rozszerzenia testu — wtedy AC poniżej pada na liczbie, nie cicho przechodzi), a
 * DODATKOWO jawnie sprawdza, że separator bezpośrednio poprzedzający przycisk (jeśli
 * istnieje) jest owinięty RAZEM z przyciskiem, nie osierocony PRZED gate'em.
 *
 * Stan bezpośrednio przed przyciskiem (przeczytany bezpośrednio przed napisaniem tego
 * testu, auditors-client.tsx linie ~238-257):
 *   {canUpdateAuditors && (
 *     <>
 *       <DropdownMenuItem ...>{...Zawieś/Odblokuj Konto...}</DropdownMenuItem>
 *       <DropdownMenuSeparator />
 *     </>
 *   )}
 *   {canDeleteAuditors && (
 *     <DropdownMenuItem ...>
 *       <ShieldAlert ... />
 *       <span>Usuń (Tylko Admin)</span>
 *     </DropdownMenuItem>
 *   )}
 * Separator sąsiadujący z przyciskiem "Usuń" żyje WEWNĄTRZ gate'u `canUpdateAuditors`
 * poprzedzającego blok (nie jest osierocony przed `canDeleteAuditors`) — test poniżej
 * dowodzi wprost, że bezpośrednio przed `{canDeleteAuditors &&` NIE stoi samodzielny
 * `<DropdownMenuSeparator />` poza jakimkolwiek gate'em.
 *
 * OGRANICZENIE INFRASTRUKTURALNE (ten sam wzorzec co leads-delete-ui-gate.test.ts /
 * crews-client-admin-visibility.test.ts): root `vitest.config.mts` nie ma aliasu `@/*`, a
 * `auditors-client.tsx` importuje moduły spod `@/...` — pełny render nie jest dziś
 * wykonalny w tym pakiecie. Testy statyczne nad treścią źródła.
 */

const AUDITORS_CLIENT_PATH = path.resolve(
  __dirname,
  '../src/app/(dashboard)/auditors/auditors-client.tsx',
);

function readAuditorsClient(): string {
  return readFileSync(AUDITORS_CLIENT_PATH, 'utf-8');
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

describe('auditors-client.tsx — przycisk "Usuń (Tylko Admin)" widoczny wyłącznie z auditors.delete (CRM-DELETE-ADMIN-ONLY-AUDITORS)', () => {
  // @REQ: CRM-DELETE-ADMIN-ONLY-AUDITORS
  it('importuje can z @klikklima/contracts i definiuje canDeleteAuditors z macierzy RBAC auditors.delete, nie z literału roli', () => {
    const content = readAuditorsClient();

    expect(content).toMatch(/import\s*\{[^}]*\bcan\b[^}]*\}\s*from\s*["']@klikklima\/contracts["']/);
    expect(content).toMatch(
      /const\s+canDeleteAuditors\s*=\s*!!actorRole\s*&&\s*can\(\s*actorRole\s*,\s*['"]auditors['"]\s*,\s*['"]delete['"]\s*\)\s*===\s*['"]yes['"]/,
    );
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-AUDITORS
  it('tekst "Usuń (Tylko Admin)" występuje dokładnie raz — dowód, że to jedyne miejsce sprawdzane poniżej', () => {
    const content = readAuditorsClient();
    const occurrences = findAllIndices(content, 'Usuń (Tylko Admin)');

    expect(
      occurrences.length,
      'Jeśli dodano legalne drugie miejsce z przyciskiem "Usuń (Tylko Admin)" (np. nowy ' +
        'tryb widoku listy/tabeli), PODNIEŚ tę liczbę i rozszerz pętlę weryfikującą poniżej ' +
        'o nowe wystąpienie — nie usuwaj ani nie osłabiaj tego testu, żeby przeszedł.',
    ).toBe(1);
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-AUDITORS
  it('KAŻDE wystąpienie przycisku "Usuń (Tylko Admin)" jest owinięte {canDeleteAuditors && (...)}', () => {
    const content = readAuditorsClient();
    const occurrences = findAllIndices(content, 'Usuń (Tylko Admin)');
    expect(occurrences.length).toBeGreaterThan(0);

    for (const labelIndex of occurrences) {
      // Każde wystąpienie leży wewnątrz <DropdownMenuItem ...>...</DropdownMenuItem>,
      // który z kolei jest bezpośrednim dzieckiem gate'u {canDeleteAuditors && (...
      const menuItemStart = content.lastIndexOf('<DropdownMenuItem', labelIndex);
      expect(menuItemStart, `Nie znaleziono "<DropdownMenuItem" przed wystąpieniem na indeksie ${labelIndex}`).toBeGreaterThan(-1);

      const windowBefore = content.slice(Math.max(0, menuItemStart - 100), menuItemStart);
      expect(windowBefore).toMatch(/\{\s*canDeleteAuditors\s*&&\s*\(\s*$/);
    }
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-AUDITORS
  it('separator bezpośrednio poprzedzający przycisk "Usuń" NIE jest osierocony poza gate: to co stoi tuż przed {canDeleteAuditors && (...)} nie jest samodzielny <DropdownMenuSeparator />', () => {
    const content = readAuditorsClient();
    const gateMarker = '{canDeleteAuditors && (';
    const gateIdx = content.indexOf(gateMarker);
    expect(gateIdx).toBeGreaterThan(-1);
    // Dokładnie jedno wystąpienie gate'u — spójne z dokładnie jednym wystąpieniem przycisku.
    expect(content.indexOf(gateMarker, gateIdx + 1)).toBe(-1);

    const windowBefore = content.slice(Math.max(0, gateIdx - 60), gateIdx);
    // Osierocony separator wyglądałby jak "...<DropdownMenuSeparator />\n{canDeleteAuditors...".
    // Legalny kształt (separator sąsiadujący z przyciskiem żyje WEWNĄTRZ poprzedzającego
    // gate'u canUpdateAuditors, zamknięty przez "</>\n)}" przed tym oknem) nie kończy się
    // samym znacznikiem separatora tuż przed nawiasem otwierającym ten gate.
    expect(windowBefore.trim()).not.toMatch(/<DropdownMenuSeparator\s*\/>\s*$/);
  });
});
