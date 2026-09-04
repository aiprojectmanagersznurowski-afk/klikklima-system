import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROLES, AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * Reviewer MAJOR (SEC-AUDIT-LOG-ROLE-CHANGE, AC13): `RoleChangeDialog`
 * (`apps/b2b-web/src/app/(dashboard)/settings/role-change-dialog.tsx`) nie miał ŻADNEGO
 * testu — `grep -rn "role-change-dialog|RoleChangeDialog" apps/b2b-web/tests/` dawał zero
 * trafień przed tym plikiem.
 *
 * OGRANICZENIE INFRASTRUKTURALNE (dziedziczone z `customers-anonymize-ui.test.ts` i z bloku
 * AC12 w `sec-audit-log-role-change.test.ts`): alias `@/*` NIE jest skonfigurowany w root
 * `vitest.config.mts`, a dopisanie go jest zablokowane hookiem `guard-paths.mjs` dla roli
 * `test-author`. `role-change-dialog.tsx` importuje `@/components/ui/button` — pełny render
 * (`@testing-library/react`) nie jest dziś wykonalny w tym pakiecie testów, ani nawet
 * *dynamiczny import* modułu (padłby na nierozwiązanym module, nie na asercji — zły RED).
 * Stosujemy DOKŁADNIE ten sam wzorzec dowodu co `customers-anonymize-ui.test.ts` / AC12:
 * testy statyczne nad treścią źródła, z ekstrakcją zbalansowanych bloków funkcji, żeby
 * asercje trafiały w konkretne wyrażenia, a nie w przypadkowe podłańcuchy pliku.
 *
 * AC13 (kontrakt, `contracts/requirements.contract.mjs`): dialog niemożliwy do zatwierdzenia
 * bez wypełnienia roli/uzasadnienia/podstawy prawnej, brak `window.confirm` jako ścieżki,
 * słowniki (`ROLES`, `AUDIT_REQUIREMENTS.legalBases`) z kontraktu, nie hardkodowane.
 */

const SETTINGS_DIR = path.resolve(__dirname, '../src/app/(dashboard)/settings');

function readDialog(): string {
  return readFileSync(path.join(SETTINGS_DIR, 'role-change-dialog.tsx'), 'utf-8');
}

function readSettingsClient(): string {
  return readFileSync(path.join(SETTINGS_DIR, 'SettingsClient.tsx'), 'utf-8');
}

/**
 * Odtwarza balansowanie nawiasów klamrowych z `sec-audit-log-role-change.test.ts`
 * (`extractEnclosingBlock`), ale startując od DOWOLNEGO literalnego markera źródłowego
 * (np. początku deklaracji funkcji strzałkowej), nie tylko od słów kluczowych `export`.
 * Rzuca, jeśli marker albo domykający nawias nie zostaną znalezione — awaria testu ma być
 * czytelna (błąd asercji na etapie `expect`), nie cichym `undefined`.
 */
function extractBalancedBlock(content: string, startMarker: string): string {
  const start = content.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Marker nieznaleziony w źródle: ${startMarker}`);
  }
  const braceOpen = content.indexOf('{', start);
  if (braceOpen === -1) {
    throw new Error(`Brak otwierającego nawiasu klamrowego po markerze: ${startMarker}`);
  }
  let depth = 0;
  for (let i = braceOpen; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        return content.slice(start, i + 1);
      }
    }
  }
  throw new Error(`Nawiasy klamrowe niezbalansowane od markera: ${startMarker}`);
}

// ─────────────────────── Przycisk zatwierdzenia zablokowany do poprawności formularza ───────────────────────

describe('RoleChangeDialog — przycisk zatwierdzenia disabled dopóki formularz niepoprawny (SEC-AUDIT-LOG-ROLE-CHANGE, AC13)', () => {
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('przycisk type="submit" ma disabled={!isValid || isSubmitting}', () => {
    const content = readDialog();
    const submitIdx = content.indexOf('type="submit"');
    expect(submitIdx).toBeGreaterThan(-1);

    const window = content.slice(submitIdx, submitIdx + 200);
    expect(window).toMatch(/disabled=\{!isValid \|\| isSubmitting\}/);
  });

  // Bez `mode: "onChange"` `isValid` nie przelicza się na bieżąco przy wpisywaniu — przycisk
  // pozostałby faktycznie martwy (zawsze disabled albo zawsze enabled po pierwszym submicie).
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('useForm jest skonfigurowany z mode: "onChange"', () => {
    const content = readDialog();
    const block = extractBalancedBlock(content, 'useForm<RoleChangeInput>(');
    expect(block).toMatch(/mode:\s*["']onChange["']/);
  });

  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('resolver formularza to zodResolver(roleChangeSchema) — walidacja dzieli się z warstwą serwerową', () => {
    const content = readDialog();
    expect(content).toMatch(
      /import\s*\{[\s\S]*?\broleChangeSchema\b[\s\S]*?\}\s*from\s*["']@\/lib\/audit\/role-change-schema["']/,
    );
    const block = extractBalancedBlock(content, 'useForm<RoleChangeInput>(');
    expect(block).toMatch(/resolver:\s*zodResolver\(roleChangeSchema\)/);
  });

  // Formularz nie preselekcjonuje żadnego z trzech wymaganych pól — operator musi je świadomie
  // wypełnić, dokładnie ten sam wzorzec co `DeleteJustificationDialog`/`AnonymizeClientModal`.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('defaultValues nie preselekcjonuje role ani legalBasis (undefined, nie pierwsza wartość słownika)', () => {
    const content = readDialog();
    const block = extractBalancedBlock(content, 'useForm<RoleChangeInput>(');
    expect(block).toMatch(/role:\s*undefined/);
    expect(block).toMatch(/legalBasis:\s*undefined/);
    expect(block).not.toMatch(/ROLES\[0\]/);
    expect(block).not.toMatch(/legalBases\[0\]/);
  });
});

// ────────────────────────── Select roli: dokładnie ROLES minus currentRole ──────────────────────────

describe('RoleChangeDialog — <select> roli zawiera dokładnie ROLES minus currentRole (SEC-AUDIT-LOG-ROLE-CHANGE, AC13)', () => {
  // Dowód wyrażenia źródłowego: filtr musi porównywać z `currentRole` (propsem), nie z
  // zamrożonym literałem ani z warunkiem, który przepuszcza wszystko.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('availableRoles = (ROLES as readonly Role[]).filter((role) => role !== currentRole)', () => {
    const content = readDialog();
    expect(content).toMatch(
      /const availableRoles = \(ROLES as readonly Role\[\]\)\.filter\(\s*\(role\)\s*=>\s*role !== currentRole\s*\)/,
    );
  });

  // Select musi mapować `availableRoles` (wynik filtra), NIE `ROLES` bezpośrednio — inaczej
  // aktualna rola konta pojawiłaby się jako opcja wyboru.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('<select id="role"> mapuje availableRoles, nie ROLES bezpośrednio', () => {
    const content = readDialog();
    const selectIdx = content.indexOf('id="role"');
    expect(selectIdx).toBeGreaterThan(-1);
    const selectEnd = content.indexOf('</select>', selectIdx);
    expect(selectEnd).toBeGreaterThan(selectIdx);

    const block = content.slice(selectIdx, selectEnd);
    expect(block).toMatch(/availableRoles\.map\(\s*\(role\)\s*=>/);
    expect(block).not.toMatch(/\bROLES\.map\(/);
  });

  // Kontrola pozytywna kontraktu: ROLES ma więcej niż jeden element — bez tego wykluczenie
  // currentRole mogłoby (przypadkiem) zostawić pustą listę wyboru dla każdej roli.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('kontrola pozytywna — ROLES z kontraktu ma więcej niż jedną wartość', () => {
    expect(ROLES.length).toBeGreaterThan(1);
  });
});

// ───────────────────── Select podstawy prawnej: dokładnie AUDIT_REQUIREMENTS.legalBases ─────────────────────

describe('RoleChangeDialog — <select> podstawy prawnej zawiera dokładnie AUDIT_REQUIREMENTS.legalBases, bez preselekcji (SEC-AUDIT-LOG-ROLE-CHANGE, AC13)', () => {
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('<select id="legalBasis"> mapuje AUDIT_REQUIREMENTS.legalBases w całości, bez pośredniego filtrowania', () => {
    const content = readDialog();
    const selectIdx = content.indexOf('id="legalBasis"');
    expect(selectIdx).toBeGreaterThan(-1);
    const selectEnd = content.indexOf('</select>', selectIdx);
    expect(selectEnd).toBeGreaterThan(selectIdx);

    const block = content.slice(selectIdx, selectEnd);
    expect(block).toMatch(/AUDIT_REQUIREMENTS\.legalBases\.map\(\s*\(basis\)\s*=>/);
  });

  // Wzorzec zamrożony po recenzji `CLIENT-ANONYMIZATION-RODO` (MAJOR #1 tamtej fazy):
  // `legalBases[0]` jako wartość domyślna formularza to regresja zgadywania podstawy prawnej.
  // Legalne jest WYŁĄCZNIE mapowanie opcji <select>.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('poza mapowaniem opcji <select> wzorzec legalBases[0] nie występuje nigdzie w pliku', () => {
    const content = readDialog();
    const occurrences = [...content.matchAll(/legalBases\[0\]/g)];
    expect(occurrences.length).toBe(0);
  });

  // Kontrola pozytywna: dokładnie pięć wartości kontraktu — jeśli kontrakt kiedyś doda
  // szóstą podstawę prawną, ten test (razem z regexem powyżej) wymusi świadomą rewizję.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('kontrola pozytywna — AUDIT_REQUIREMENTS.legalBases ma pięć wartości', () => {
    expect(AUDIT_REQUIREMENTS.legalBases.length).toBe(5);
  });
});

// ────────────────────────── Zatwierdzenie woła onConfirm z wpisanymi wartościami ──────────────────────────

describe('RoleChangeDialog — zatwierdzenie woła onConfirm z dokładnie wartościami formularza (SEC-AUDIT-LOG-ROLE-CHANGE, AC13)', () => {
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('onSubmit woła "await onConfirm(values)" — bez wzbogacania/okrajania payloadu', () => {
    const content = readDialog();
    const block = extractBalancedBlock(content, 'const onSubmit = async (values: RoleChangeInput)');

    expect(block).toMatch(/await onConfirm\(values\)/);
    expect(block).not.toMatch(/onConfirm\(\s*\{\s*\.\.\.values/);
  });

  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('handleSubmit(onSubmit) jest podłączony do onSubmit formularza — jedyna ścieżka zatwierdzenia', () => {
    const content = readDialog();
    expect(content).toMatch(/<form onSubmit=\{handleSubmit\(onSubmit\)\}/);
  });
});

// ───────────────────────── Obsługa wyniku: result.changed musi dotrzeć do wywołującego ─────────────────────────

describe('RoleChangeDialog — obsługa wyniku (result.changed) musi dotrzeć do onSuccess (SEC-AUDIT-LOG-ROLE-CHANGE, AC13)', () => {
  /**
   * Historia tego bloku (dowód, że test mierzy realne zachowanie, nie przypadkowo trafia
   * w istniejący kod): w chwili pierwszego czytania komponentu przez `test-author`,
   * `role-change-dialog.tsx` deklarował `onSuccess: () => void` i wołał `onSuccess()`
   * BEZ ARGUMENTU, mimo że jedyny wywołujący (`SettingsClient.tsx`) podłącza
   * `onSuccess={handleRoleChangeSuccess}`, gdzie
   * `handleRoleChangeSuccess = (result: UpdateAuthorizedUserRoleResult) => { ... result.changed ... }`.
   * Wywołanie bezargumentowe oznaczało `result === undefined` w `handleRoleChangeSuccess`
   * i `TypeError` przy KAŻDEJ udanej zmianie roli. Między odczytem pliku a napisaniem tego
   * testu równoległa tura `implementer-server` poprawiła sygnaturę na
   * `onSuccess: (result: UpdateAuthorizedUserRoleResult) => void` i wywołanie na
   * `onSuccess(result)` — poniższe testy są dziś zielone, bo mierzą POPRAWIONY stan, nie
   * dlatego, że są zbyt luźne (regres z powrotem na `onSuccess()` bezargumentowe je wywali).
   */
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('onSubmit woła "onSuccess(result)", przekazując wynik akcji dalej', () => {
    const content = readDialog();
    const block = extractBalancedBlock(content, 'const onSubmit = async (values: RoleChangeInput)');

    expect(block).toMatch(/onSuccess\(\s*result\s*\)/);
  });

  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('props onSuccess przyjmuje UpdateAuthorizedUserRoleResult, zgodnie z odbiorcą w SettingsClient.tsx', () => {
    const content = readDialog();
    expect(content).toMatch(/onSuccess:\s*\(\s*result:\s*UpdateAuthorizedUserRoleResult\s*\)\s*=>\s*void/);
  });

  // Kontrola pozytywna: logika różnicowania komunikatu w SettingsClient.handleRoleChangeSuccess
  // JEST poprawna (changed=true -> "zmieniono", inaczej -> komunikat no-op/błędu) — problemem
  // jest wyłącznie brak przekazania `result` z dialogu, nie ta gałąź.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('kontrola pozytywna — SettingsClient.handleRoleChangeSuccess różnicuje komunikat po result.changed', () => {
    const content = readSettingsClient();
    const block = extractBalancedBlock(
      content,
      'const handleRoleChangeSuccess = (result: UpdateAuthorizedUserRoleResult)',
    );

    expect(block).toMatch(
      /result\.changed\s*\?\s*"Rola konta została zmieniona\."\s*:\s*result\.error \|\| "Rola konta nie uległa zmianie\."/,
    );
  });
});

// ────────────────────────── Błąd "ostatni admin" wyświetlony verbatim ──────────────────────────

describe('RoleChangeDialog — komunikat błędu z result.error wyświetlony verbatim (SEC-AUDIT-LOG-ROLE-CHANGE, AC13)', () => {
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('porażka wyniku ustawia submitError na result.error verbatim (fallback tylko gdy puste)', () => {
    const content = readDialog();
    const block = extractBalancedBlock(content, 'const onSubmit = async (values: RoleChangeInput)');

    expect(block).toMatch(/if \(!result\.success\) \{/);
    expect(block).toMatch(/setSubmitError\(result\.error \?\? "[^"]*"\)/);
  });

  // Weryfikacja end-to-end z serwerem: `updateAuthorizedUserRoleAction` zwraca dosłownie
  // "Nie można odebrać roli jedynemu kontu administratora." przy ochronie ostatniego admina
  // (patrz `actions.ts`, klasa `LastAdminError`) — dialog nie może przeformułować tego tekstu.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('submitError jest renderowany verbatim, bez modyfikacji treści, w elemencie role="alert"', () => {
    const content = readDialog();
    expect(content).toMatch(/role="alert">\{submitError\}<\/p>/);
  });
});

// ────────────────────────── Brak window.confirm/alert jako ścieżki potwierdzenia ──────────────────────────

describe('RoleChangeDialog — brak window.confirm/alert jako ścieżki potwierdzenia (SEC-AUDIT-LOG-ROLE-CHANGE, AC12/AC13)', () => {
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('plik nie zawiera window.confirm(, confirm( ani alert( jako mechanizmu potwierdzenia', () => {
    const content = readDialog();

    expect(content).not.toMatch(/\bwindow\.confirm\s*\(/);
    // Dopasowanie ostrożne: `\bconfirm\(` (bez `window.`) nie może fałszywie łapać
    // `onConfirm(` — wielkość liter w regexie jest rozróżniana, `Confirm(` (duże C) nie
    // pasuje do wzorca `confirm\(` (małe c), więc `onConfirm(...)` jest bezpieczne.
    expect(content).not.toMatch(/\bconfirm\s*\(/);
    expect(content).not.toMatch(/\balert\s*\(/);
  });
});

// ────────────────────────── Słowniki pochodzą wyłącznie z kontraktu ──────────────────────────

describe('RoleChangeDialog — słowniki (ROLES, AUDIT_REQUIREMENTS) importowane wyłącznie z @klikklima/contracts (SEC-AUDIT-LOG-ROLE-CHANGE, ADR-002)', () => {
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('ROLES i AUDIT_REQUIREMENTS pochodzą z jednego importu z @klikklima/contracts', () => {
    const content = readDialog();
    const importMatch = content.match(
      /import\s*\{([^}]*)\}\s*from\s*["']@klikklima\/contracts["']/,
    );
    expect(importMatch).not.toBeNull();

    const importedNames = importMatch![1];
    expect(importedNames).toMatch(/\bROLES\b/);
    expect(importedNames).toMatch(/\bAUDIT_REQUIREMENTS\b/);
  });
});
