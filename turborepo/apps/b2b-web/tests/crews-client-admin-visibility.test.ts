import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Znalezisko code-review (przekazane test-authorowi ad-hoc, bez pliku w
 * docs/workorders/): w `crews-client.tsx` dwie pozycje menu kontekstowego
 * ekipy NIE są warunkowane rolą, w przeciwieństwie do sąsiedniego "Edytuj
 * Zespół" (`{canUpdateCrews && (...)}`, linia ~55 pliku produkcyjnego):
 *
 *   1. Przycisk usunięcia ("Usuń (Tylko Admin)") — narusza AC1 wymagania
 *      `CRM-DELETE-ADMIN-ONLY-CREWS` (contracts/requirements.contract.mjs):
 *      "UI: akcja „Usuń" jest ukryta dla ról dyspozytor, audytor i monter
 *      w widoku Ekip". Server Action (deleteCrewAction) i RLS są już
 *      zamknięte i przetestowane (crews-admin-gates.test.ts, testy
 *      @REQ: CRM-DELETE-ADMIN-ONLY) — brakuje wyłącznie warstwy UI.
 *
 *   2. Przycisk uploadu zdjęcia ("Wgraj zdjęcie zespołu") — narusza
 *      analogiczne AC w `CRM-CREW-UPDATE-ADMIN-ONLY`: "Ukrycie kontrolki
 *      wgrywania zdjęcia dla ról nie-admin jest wymagane [...] stanowi
 *      warstwę osobną od bramki serwerowej". `updateCrewAvatar` już
 *      sprawdza rolę po stronie serwera i jest przetestowane
 *      (crews-admin-gates.test.ts, testy @REQ: CRM-CREW-UPDATE-ADMIN-ONLY),
 *      ale kontrolka w interfejsie nie jest ukryta.
 *
 * OGRANICZENIE INFRASTRUKTURALNE (ten sam wzorzec co
 * `customers-anonymize-ui.test.ts` AC10 i `crews-admin-gates.test.ts`
 * nagłówek "Świadome ograniczenia"): alias `@/*` nie jest skonfigurowany w
 * root `vitest.config.mts`, a `crews-client.tsx` importuje
 * `@/components/ui/button`, `@/components/ui/dropdown-menu` i
 * `@/utils/supabase/client` — pełny render (`@testing-library/react`,
 * `screen.queryByText(...)`) nie jest dziś wykonalny w tym pakiecie testów.
 * Stosujemy dokładnie ten sam wzorzec dowodowy: testy statyczne nad treścią
 * źródła `crews-client.tsx`, sprawdzające, że etykieta menu jest
 * warunkowana odpowiednią bramką roli w kodzie JSX (analogicznie do
 * istniejącego, już-poprawnego `{canUpdateCrews && (...)}` przy "Edytuj
 * Zespół" tuż nad nią) — nie samo `disabled`, a nieobecność w drzewie JSX
 * po stronie warunku renderowania.
 *
 * KONTRAKT Z IMPLEMENTER-UI (analogiczny do `isAnonymizeMenuItemVisible` w
 * customers-client.tsx): `crews-client.tsx` ma zyskać zmienną
 * `canDeleteCrews = !!actorRole && can(actorRole, 'crews', 'delete') === 'yes'`
 * (wzorem istniejącego `canUpdateCrews` dwie linie wyżej) i owinąć nią
 * `DropdownMenuItem` z etykietą "Usuń (Tylko Admin)". Kontrolka uploadu
 * zdjęcia ma zostać owinięta ISTNIEJĄCYM `canUpdateCrews` — capability
 * `crews.update` jest już dokładnie tym, co sprawdza `updateCrewAvatar` po
 * stronie serwera, więc UI ma pytać o to samo, nie o nową zmienną.
 */

const CREWS_DIR = path.resolve(__dirname, '../src/app/(dashboard)/crews');

function readCrewsClient(): string {
  return readFileSync(path.join(CREWS_DIR, 'crews-client.tsx'), 'utf-8');
}

describe('CrewsClient — przycisk "Usuń" warunkowany rolą (CRM-DELETE-ADMIN-ONLY-CREWS)', () => {
  // @REQ: CRM-DELETE-ADMIN-ONLY-CREWS
  it('DropdownMenuItem z etykietą "Usuń (Tylko Admin)" jest bezpośrednio owinięty {canDeleteCrews && (...)} tuż przed otwierającym tagiem (nie disabled, nie gate innej pozycji menu)', () => {
    const content = readCrewsClient();

    const labelIndex = content.indexOf('Usuń (Tylko Admin)');
    expect(labelIndex).toBeGreaterThan(-1);

    // Wzorem testu dla uploadu: punktem odniesienia jest OTWIERAJĄCY tag
    // <DropdownMenuItem tej konkretnej pozycji (className="text-destructive
    // focus:text-destructive focus:bg-destructive/10" + onClick={() =>
    // handleDelete(...)}), nie sama etykieta w <span> zagnieżdżonym głębiej —
    // szerokie okno "przed etykietą" złapałoby też gate zupełnie innej,
    // wcześniejszej pozycji menu ("Zawieś Zespół" / separator), co dałoby
    // fałszywie zielony test.
    const openTagIndex = content.lastIndexOf('<DropdownMenuItem', labelIndex);
    expect(openTagIndex).toBeGreaterThan(-1);

    const immediatelyBefore = content.slice(Math.max(0, openTagIndex - 60), openTagIndex);

    expect(immediatelyBefore.trimEnd()).toMatch(/\{\s*canDeleteCrews\s*&&\s*\(\s*$/);
  });

  // Kontrola pozytywna statyczna: dowód, że `canDeleteCrews` — jeśli w ogóle
  // istnieje w pliku — jest zdefiniowany przez wywołanie kontraktu RBAC
  // (`can(actorRole, 'crews', 'delete') === 'yes'`), a nie przez literał typu
  // `actorRole === 'admin'`, który dubluje macierz i nie propagowałby jej
  // przyszłych zmian (ten sam wymóg co dla `canUpdateCrews` w opisie niżej).
  // @REQ: CRM-DELETE-ADMIN-ONLY-CREWS
  it('canDeleteCrews jest zdefiniowany przez can(actorRole, "crews", "delete") === "yes", nie przez literał roli', () => {
    const content = readCrewsClient();

    expect(content).toMatch(
      /const\s+canDeleteCrews\s*=\s*!!actorRole\s*&&\s*can\(\s*actorRole\s*,\s*['"]crews['"]\s*,\s*['"]delete['"]\s*\)\s*===\s*['"]yes['"]/,
    );
  });
});

describe('CrewsClient — przycisk uploadu zdjęcia warunkowany rolą (CRM-CREW-UPDATE-ADMIN-ONLY)', () => {
  // @REQ: CRM-CREW-UPDATE-ADMIN-ONLY
  it('etykieta "Wgraj zdjęcie zespołu" jest poprzedzona bramką canUpdateCrews DIREKTNIE otaczającą TEN DropdownMenuItem (nie gate sąsiedniej pozycji menu)', () => {
    const content = readCrewsClient();

    const labelIndex = content.indexOf('Wgraj zdjęcie zespołu');
    expect(labelIndex).toBeGreaterThan(-1);

    // Punkt odniesienia: początek OTWIERAJĄCEGO tagu <DropdownMenuItem tej
    // konkretnej pozycji menu (onClick={() => triggerFileUpload(...)}), nie
    // etykiety samej — inaczej okno "przed etykietą" łapie gate sąsiedniej,
    // wcześniejszej pozycji ("Edytuj Zespół"), która jest poprawnie owinięta
    // {canUpdateCrews && (...)} i sąsiaduje z tą pozycją bez separatora.
    const openTagIndex = content.lastIndexOf('<DropdownMenuItem', labelIndex);
    expect(openTagIndex).toBeGreaterThan(-1);

    // Fragment bezpośrednio przed tym tagiem otwierającym, przycięty do
    // białych znaków — jeśli bramka NIE otacza wprost tego elementu (bo np.
    // otacza tylko poprzedni, zamknięty już przez `)}`), ostatni niebiały
    // token przed tagiem NIE będzie `(` z otwarcia `{canUpdateCrews && (`.
    const immediatelyBefore = content.slice(Math.max(0, openTagIndex - 60), openTagIndex);

    expect(immediatelyBefore.trimEnd()).toMatch(/\{\s*canUpdateCrews\s*&&\s*\(\s*$/);
  });

  // Kontrola pozytywna statyczna: dowód, że `canUpdateCrews` faktycznie istnieje
  // i jest zdefiniowany przez can(actorRole, 'crews', 'update') === 'yes' — bez
  // tego test powyżej mógłby przejść przypadkowo dla zmiennej niezwiązanej z
  // macierzą RBAC.
  // @REQ: CRM-CREW-UPDATE-ADMIN-ONLY
  it('canUpdateCrews jest zdefiniowany przez can(actorRole, "crews", "update") === "yes"', () => {
    const content = readCrewsClient();

    expect(content).toMatch(
      /const\s+canUpdateCrews\s*=\s*!!actorRole\s*&&\s*can\(\s*actorRole\s*,\s*['"]crews['"]\s*,\s*['"]update['"]\s*\)\s*===\s*['"]yes['"]/,
    );
  });
});
