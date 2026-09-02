import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROLES, AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * WO: docs/workorders/CLIENT-ANONYMIZATION-RODO.md — Faza C (`test-author` → `implementer-ui`).
 * AC10 (dokładne brzmienie WO):
 *   "W widoku Klientów pozycja menu ma etykietę „Anonimizuj (RODO)", jest widoczna WYŁĄCZNIE
 *    dla roli `admin` (pozostałe role nie widzą jej w DOM), a jej wybór otwiera formularz z
 *    polem uzasadnienia i wyborem podstawy prawnej; przycisk zatwierdzenia jest nieaktywny,
 *    dopóki uzasadnienie ma mniej niż 10 znaków. Po sukcesie wiersz ZOSTAJE na liście z nazwą
 *    „Klient usunięty" (nie znika)."
 *
 * Faza B (`anonymizeClientAction`) jest już zaimplementowana i zrecenzowana — patrz
 * `customers-anonymize-rodo.test.ts` (server-side, AC1-AC8). Recenzja Fazy B zgłosiła dwa
 * MAJOR w warstwie UI, które ten plik zamraża testem:
 *   1. `customers-client.tsx` dziś zgaduje `legalBasis` jako `AUDIT_REQUIREMENTS.legalBases[0]`
 *      zamiast dać wybór operatorowi — dla tabeli append-only to nieusuwalny błąd w rejestrze.
 *   2. Po sukcesie wiersz znika z listy (`setCustomers(prev => prev.filter(...))`), etykieta menu
 *      nadal brzmi „Usuń (Tylko Admin)".
 *
 * OGRANICZENIE INFRASTRUKTURALNE (ustalone w tej sesji, patrz `services-source-of-truth.test.ts`
 * AC9): alias `@/*` NIE jest skonfigurowany w root `vitest.config.mts`, a dopisanie go jest
 * zablokowane hookiem `guard-paths.mjs` dla roli `test-author`. `customers-client.tsx` importuje
 * `@/components/ui/button` i `@/components/ui/dropdown-menu` — pełny render (`@testing-library/react`)
 * nie jest dziś wykonalny w tym pakiecie testów. Stosujemy DOKŁADNIE ten sam wzorzec co
 * `services/menu-visibility.ts` + `isDeleteMenuItemVisible`: wydzielenie CZYSTEJ logiki
 * widoczności do modułu bez importów UI, plus testy statyczne nad treścią źródeł
 * `customers-client.tsx` / `page.tsx`, żeby zamknąć lukę mutacyjną (sama obecność funkcji
 * gdzieś w repo, niepodłączonej do niczego, nie może dawać zielonego testu).
 *
 * KONTRAKT Z IMPLEMENTER-UI (analogiczny do `buildAuditorFormData`/`isDeleteMenuItemVisible`):
 *
 *   1. Nowy plik `apps/b2b-web/src/app/(dashboard)/customers/menu-visibility.ts`
 *      (bez importów UI, bez "use client"/"use server"), eksport:
 *        `export function isAnonymizeMenuItemVisible(actorRole: Role | null): boolean`
 *      zwracający `actorRole === 'admin'`. `Role` importowany z `@klikklima/contracts`.
 *
 *   2. Nowy plik `apps/b2b-web/src/app/(dashboard)/customers/anonymize-client-schema.ts`
 *      (bez importów UI), eksport:
 *        `export const anonymizeClientSchema = z.object({
 *           justification: z.string().trim().min(10),
 *           legalBasis: z.enum(AUDIT_REQUIREMENTS.legalBases),
 *         })`
 *      Współdzielony przez formularz (`zodResolver`) i ewentualnie przez Server Action —
 *      zero literałów `10` czy nazw podstaw prawnych poza tym, co już eksportuje kontrakt.
 *
 *   3. `page.tsx` (`customers/page.tsx`) ma wołać `getCurrentActorRole()` (z
 *      `../../../utils/supabase/server`, tak jak robią to inne strony `(dashboard)`) i
 *      przekazywać wynik jako prop `actorRole` do `<CustomersClient />`.
 *
 *   4. `customers-client.tsx`:
 *      - przyjmuje `actorRole: Role | null` jako prop,
 *      - importuje `isAnonymizeMenuItemVisible` z `./menu-visibility` i warunkuje nią
 *        renderowanie pozycji menu z etykietą „Anonimizuj (RODO)" (etykieta „Usuń (Tylko Admin)"
 *        znika razem ze starym zachowaniem `handleDelete`),
 *      - formularz uzasadnienia/podstawy prawnej używa `react-hook-form` + `zodResolver`
 *        (ADR-001) ze schematem `anonymizeClientSchema` — NIE `prompt()`/`confirm()` i NIE
 *        zgadywania `AUDIT_REQUIREMENTS.legalBases[0]`,
 *      - po sukcesie stan `customers` jest aktualizowany przez `.map(...)` (klient zostaje w
 *        tablicy, z nazwą „Klient usunięty"), NIE przez `.filter(...)` które go usuwa.
 *
 * Dzisiejszy RED: `menu-visibility.ts` i `anonymize-client-schema.ts` jeszcze nie istnieją —
 * dynamiczne importy padają na braku modułu (poprawny RED, brak zaplanowanego pliku, nie
 * literówka). Testy statyczne nad `customers-client.tsx`/`page.tsx` failują na asercjach
 * dopasowania treści (funkcja/prop jeszcze nieużyte), nie na błędzie parsowania.
 */

const CUSTOMERS_DIR = path.resolve(__dirname, '../src/app/(dashboard)/customers');

function readCustomersClient(): string {
  return readFileSync(path.join(CUSTOMERS_DIR, 'customers-client.tsx'), 'utf-8');
}

function readCustomersPage(): string {
  return readFileSync(path.join(CUSTOMERS_DIR, 'page.tsx'), 'utf-8');
}

describe('AC10 (1/4) — isAnonymizeMenuItemVisible: widoczność wyłącznie dla roli admin', () => {
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('zwraca true wyłącznie dla actorRole === "admin", false dla pozostałych ról i dla null', async () => {
    const { isAnonymizeMenuItemVisible } = await import(
      '../src/app/(dashboard)/customers/menu-visibility'
    );

    for (const role of ROLES) {
      expect(isAnonymizeMenuItemVisible(role)).toBe(role === 'admin');
    }
    expect(isAnonymizeMenuItemVisible(null)).toBe(false);
  });

  // Kontrola pozytywna kontraktu: 'admin' jest jedyną rolą w ROLES dla której funkcja
  // ma zwracać true — jeśli kontrakt kiedyś doda drugą rolę administracyjną, ten test
  // (nie tylko implementacja) będzie musiał zostać świadomie zaktualizowany.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('dokładnie jedna rola w ROLES daje true — "admin"', async () => {
    const { isAnonymizeMenuItemVisible } = await import(
      '../src/app/(dashboard)/customers/menu-visibility'
    );

    const visibleFor = ROLES.filter((r) => isAnonymizeMenuItemVisible(r));
    expect(visibleFor).toEqual(['admin']);
  });
});

describe('AC10 (1/4) — page.tsx przekazuje actorRole do CustomersClient (statyczne)', () => {
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('page.tsx woła getCurrentActorRole() i przekazuje wynik jako prop actorRole', () => {
    const content = readCustomersPage();

    expect(content).toMatch(/getCurrentActorRole\s*\(/);
    expect(content).toMatch(/<CustomersClient[\s\S]*?\bactorRole\s*=\s*\{[^}]+\}/);
  });
});

describe('AC10 (1/4) — customers-client.tsx wiąże isAnonymizeMenuItemVisible z pozycją menu "Anonimizuj (RODO)"', () => {
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('importuje isAnonymizeMenuItemVisible z ./menu-visibility i używa jej wyniku przed etykietą "Anonimizuj (RODO)"', () => {
    const content = readCustomersClient();

    expect(content).toMatch(
      /import\s*\{[^}]*isAnonymizeMenuItemVisible[^}]*\}\s*from\s*['"]\.\/menu-visibility['"]/,
    );

    const labelIndex = content.indexOf('Anonimizuj (RODO)');
    expect(labelIndex).toBeGreaterThan(-1);

    const precedingContext = content.slice(Math.max(0, labelIndex - 600), labelIndex);
    expect(precedingContext).toMatch(/isAnonymizeMenuItemVisible\(\s*actorRole\s*\)/);
  });

  // AC10 zamraża zanik etykiety historycznej "Usuń (Tylko Admin)" — WO stwierdza wprost,
  // że pozycja menu MA nazywać się "Anonimizuj (RODO)", nie współistnieć pod starą etykietą.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('nie zawiera już etykiety "Usuń (Tylko Admin)"', () => {
    const content = readCustomersClient();

    expect(content).not.toContain('Usuń (Tylko Admin)');
  });
});

describe('AC10 (2/4) — anonymizeClientSchema: walidacja formularza (min. 10 znaków, legalBasis z kontraktu)', () => {
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('odrzuca justification krótszy niż 10 znaków (po trim) i legalBasis spoza kontraktu', async () => {
    const { anonymizeClientSchema } = await import(
      '../src/app/(dashboard)/customers/anonymize-client-schema'
    );

    const tooShort = anonymizeClientSchema.safeParse({
      justification: 'za krótko',
      legalBasis: AUDIT_REQUIREMENTS.legalBases[0],
    });
    expect(tooShort.success).toBe(false);

    const whitespaceOnly = anonymizeClientSchema.safeParse({
      justification: '            ',
      legalBasis: AUDIT_REQUIREMENTS.legalBases[0],
    });
    expect(whitespaceOnly.success).toBe(false);

    const unknownLegalBasis = anonymizeClientSchema.safeParse({
      justification: 'Wystarczająco długie uzasadnienie klienta',
      legalBasis: 'PODSTAWA_SPOZA_KONTRAKTU',
    });
    expect(unknownLegalBasis.success).toBe(false);

    const missingLegalBasis = anonymizeClientSchema.safeParse({
      justification: 'Wystarczająco długie uzasadnienie klienta',
    });
    expect(missingLegalBasis.success).toBe(false);
  });

  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('akceptuje justification dokładnie 10 znaków po trim i każdą wartość legalBasis z kontraktu', async () => {
    const { anonymizeClientSchema } = await import(
      '../src/app/(dashboard)/customers/anonymize-client-schema'
    );

    const exactlyTen = anonymizeClientSchema.safeParse({
      justification: '   1234567890   ',
      legalBasis: AUDIT_REQUIREMENTS.legalBases[0],
    });
    expect(exactlyTen.success).toBe(true);

    for (const legalBasis of AUDIT_REQUIREMENTS.legalBases) {
      const result = anonymizeClientSchema.safeParse({
        justification: 'Uzasadnienie operacji anonimizacji klienta na żądanie RODO',
        legalBasis,
      });
      expect(result.success).toBe(true);
    }
  });

  // Kontrola pozytywna kontraktu — schemat nie może dryfować od progu WO (10 znaków)
  // ani od zamkniętego słownika legalBases niezależnie od implementacji.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('próg 9 znaków po trim jest odrzucony, próg 10 jest dozwolony (granica dokładna)', async () => {
    const { anonymizeClientSchema } = await import(
      '../src/app/(dashboard)/customers/anonymize-client-schema'
    );

    const nine = anonymizeClientSchema.safeParse({
      justification: '123456789',
      legalBasis: AUDIT_REQUIREMENTS.legalBases[0],
    });
    expect(nine.success).toBe(false);

    const ten = anonymizeClientSchema.safeParse({
      justification: '1234567890',
      legalBasis: AUDIT_REQUIREMENTS.legalBases[0],
    });
    expect(ten.success).toBe(true);
  });
});

describe('AC10 (3/4) — po sukcesie wiersz ZOSTAJE na liście (statyczne, brak .filter( po anonimizacji)', () => {
  /**
   * Nie da się dziś przetestować pełnego zachowania stanu Reacta bez renderu (patrz
   * ograniczenie infrastrukturalne w nagłówku pliku). Zamrażamy więc STATYCZNIE nieobecność
   * wzorca regresji z code review (`setCustomers(prev => prev.filter(...))` po wywołaniu
   * `anonymizeClientAction`) i obecność `.map(` jako mechanizmu aktualizacji stanu — dokładnie
   * ten sam poziom dowodu co `services-source-of-truth.test.ts` AC9 dla `isDeleteMenuItemVisible`.
   */

  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('plik nie zawiera już wzorca setCustomers(prev => prev.filter(...)) w całości', () => {
    const content = readCustomersClient();

    expect(content).not.toMatch(/setCustomers\(\s*prev\s*=>\s*prev\.filter\(/);
  });

  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('wywołanie anonymizeClientAction jest następnie obsłużone aktualizacją stanu przez .map(, nie przez usunięcie wiersza', () => {
    const content = readCustomersClient();

    const callIndex = content.indexOf('anonymizeClientAction(');
    expect(callIndex).toBeGreaterThan(-1);

    // Okno wystarczające na dotarcie do obsługi sukcesu wewnątrz startTransition (analogiczne
    // podejście z odległości tekstowej co menu-visibility, tu w drugą stronę: PO wywołaniu akcji).
    const followingContext = content.slice(callIndex, callIndex + 800);

    expect(followingContext).not.toMatch(/prev\.filter\(/);
    expect(followingContext).toMatch(/setCustomers\(\s*prev\s*=>\s*prev\.map\(/);
  });

  // MAJOR (recenzja finalna WO): `.map()` samo w sobie nie dowodzi, że PII faktycznie
  // znika z payloadu zapisanego do stanu — mutant zostawiający `email`/`phone`
  // nietknięte (PII widoczne po "udanej" anonimizacji) przeżywałby powyższy test.
  // Pola sprawdzone względem `CustomerSummary` (`actions.ts`): `email`, `phone`.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('mapowanie po sukcesie czyści PII — email i phone są jawnie ustawiane na null', () => {
    const content = readCustomersClient();

    const callIndex = content.indexOf('anonymizeClientAction(');
    expect(callIndex).toBeGreaterThan(-1);

    const followingContext = content.slice(callIndex, callIndex + 800);

    expect(followingContext).toMatch(/email:\s*null/);
    expect(followingContext).toMatch(/phone:\s*null/);
  });
});

describe('AC10 (4/4) — etykieta pozycji menu "Anonimizuj (RODO)" jest obecna dokładnie tam, gdzie kiedyś była "Usuń (Tylko Admin)"', () => {
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('etykieta "Anonimizuj (RODO)" występuje w pliku dokładnie raz (jedna pozycja menu, nie duplikat obok starej)', () => {
    const content = readCustomersClient();

    const matches = content.match(/Anonimizuj \(RODO\)/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

describe('AC10 — brak zgadywania domyślnej podstawy prawnej (recenzja finalna WO, MAJOR #1)', () => {
  /**
   * `legalBasis: undefined` w `defaultValues` — mutant przywracający zgadywanie
   * (`legalBasis: AUDIT_REQUIREMENTS.legalBases[0]`) musi paść. Wzorzec indeksowania
   * `legalBases[0]` jest legalny WYŁĄCZNIE w mapowaniu opcji `<select>`
   * (`AUDIT_REQUIREMENTS.legalBases.map(...)`), nie jako wartość domyślna formularza.
   */
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('defaultValues formularza ustawia legalBasis na undefined, nie na legalBases[0]', () => {
    const content = readCustomersClient();

    const defaultValuesIndex = content.indexOf('defaultValues:');
    expect(defaultValuesIndex).toBeGreaterThan(-1);

    const windowEnd = content.indexOf('})', defaultValuesIndex);
    const defaultValuesBlock = content.slice(defaultValuesIndex, windowEnd > -1 ? windowEnd : defaultValuesIndex + 400);

    expect(defaultValuesBlock).toMatch(/legalBasis:\s*undefined/);
    expect(defaultValuesBlock).not.toMatch(/legalBases\[0\]/);
  });

  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('poza mapowaniem opcji <select> (AUDIT_REQUIREMENTS.legalBases.map(...)) wzorzec legalBases[0] nie występuje nigdzie w pliku', () => {
    const content = readCustomersClient();

    const indexingOccurrences = [...content.matchAll(/legalBases\[0\]/g)];
    expect(indexingOccurrences.length).toBe(0);

    // Kontrola pozytywna: mapowanie opcji select faktycznie istnieje i to ono
    // (a nie usunięcie całego <select>) jest jedynym legalnym miejscem iteracji
    // po AUDIT_REQUIREMENTS.legalBases.
    expect(content).toMatch(/AUDIT_REQUIREMENTS\.legalBases\.map\(/);
  });
});

describe('AC10 — przycisk zatwierdzenia zablokowany dopóki formularz nie jest poprawny (recenzja finalna WO, MAJOR #2)', () => {
  /**
   * Mutant `disabled={isSubmitting}` (usunięcie `!isValid`) przechodzi wszystkie
   * pozostałe testy statyczne — sprawdzamy dosłowny fragment `disabled={!isValid`
   * w oknie wokół `type="submit"`, oraz że `isValid` w ogóle się przelicza na bieżąco
   * (`mode: "onChange"` w `useForm`), bo bez tego przycisk byłby efektywnie martwy
   * nawet z poprawnym warunkiem `disabled`.
   */
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('przycisk type="submit" ma disabled={!isValid ...}', () => {
    const content = readCustomersClient();

    const submitIndex = content.indexOf('type="submit"');
    expect(submitIndex).toBeGreaterThan(-1);

    const windowStart = Math.max(0, submitIndex - 200);
    const windowEnd = Math.min(content.length, submitIndex + 200);
    const submitWindow = content.slice(windowStart, windowEnd);

    expect(submitWindow).toMatch(/disabled=\{!isValid/);
  });

  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('useForm jest skonfigurowany z mode: "onChange" (bez tego isValid nie przelicza się na czas)', () => {
    const content = readCustomersClient();

    const useFormIndex = content.indexOf('useForm<');
    expect(useFormIndex).toBeGreaterThan(-1);

    const windowEnd = content.indexOf('})', useFormIndex);
    const useFormBlock = content.slice(useFormIndex, windowEnd > -1 ? windowEnd : useFormIndex + 400);

    expect(useFormBlock).toMatch(/mode:\s*["']onChange["']/);
  });
});

describe('AC10 — widoczność pozycji menu musi pytać kontrakt RBAC, nie zamrożony literał (recenzja finalna WO, MAJOR #4)', () => {
  /**
   * `isAnonymizeMenuItemVisible` dziś zwraca `actorRole === 'admin'` (literał)
   * zamiast `can(actorRole, 'clients', 'delete') === 'yes'` z `@klikklima/contracts`.
   * To jest krok w tył względem wzorca stosowanego już w `customers-authz-gates.test.ts`
   * (role wyliczane dynamicznie z `can()`, żeby zmiana macierzy RBAC propagowała się
   * automatycznie, bez konieczności dotykania tego pliku).
   *
   * Ten test oblicza oczekiwany zestaw ról DYNAMICZNIE z kontraktu i będzie CZERWONY
   * dopóki `implementer-ui` nie zmieni `menu-visibility.ts` na `can(...)`. Dziś
   * `PERMISSIONS.clients.delete` i zamrożony literał `'admin'` dają ten sam zestaw
   * ({'admin'}), więc gdyby to był jedyny dowód, test byłby fałszywie zielony —
   * dlatego dodatkowo asercja statyczna niżej sprawdza, że `menu-visibility.ts`
   * faktycznie IMPORTUJE i WOŁA `can(...)`, a nie tylko przypadkiem zwraca ten sam wynik.
   */
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('isAnonymizeMenuItemVisible zwraca true dokładnie dla ról z can(role, "clients", "delete") === "yes"', async () => {
    const { ROLES, can } = await import('@klikklima/contracts');
    const { isAnonymizeMenuItemVisible } = await import(
      '../src/app/(dashboard)/customers/menu-visibility'
    );

    const expectedVisible = ROLES.filter((r) => can(r, 'clients', 'delete') === 'yes');
    const expectedHidden = ROLES.filter((r) => can(r, 'clients', 'delete') !== 'yes');

    for (const role of expectedVisible) {
      expect(isAnonymizeMenuItemVisible(role)).toBe(true);
    }
    for (const role of expectedHidden) {
      expect(isAnonymizeMenuItemVisible(role)).toBe(false);
    }
  });

  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('menu-visibility.ts pyta kontrakt can(...) zamiast zamrożonego literału roli', () => {
    const content = readFileSync(path.join(CUSTOMERS_DIR, 'menu-visibility.ts'), 'utf-8');

    expect(content).toMatch(
      /import\s*\{[^}]*\bcan\b[^}]*\}\s*from\s*['"]@klikklima\/contracts['"]/,
    );
    expect(content).toMatch(/can\(\s*actorRole\s*,\s*['"]clients['"]\s*,\s*['"]delete['"]\s*\)\s*===\s*['"]yes['"]/);
  });
});
