import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROLES, can } from '@klikklima/contracts';

/**
 * WO: docs/workorders/FLD-AVAIL-WEEKLY-RULES.md — blok C (UI w panelu B2B), AC-C1..AC-C7.
 * Bloki A (Server Actions zapisu) i B (odczyt efektywnej dostępności) są już zielone i
 * scommitowane (`1234fad`, `46c688f`) — patrz `availability-rule-schema.ts`,
 * `availability-rule.ts`, `effective-availability.ts` w `apps/b2b-web/src/lib/schedule/`
 * oraz `setAvailabilityRuleAction`/`getAvailabilityAction` w `auditors/actions.ts` i
 * `crews/actions.ts`. Ten plik dotyczy WYŁĄCZNIE ekranu.
 *
 * DECYZJA MICHAŁA (2026-09-10): ekran mieszka pod NOWĄ, samoobsługową trasą `/me/schedule`
 * (`apps/b2b-web/src/app/(dashboard)/me/schedule/`), nie pod `/auditors/[id]` ani
 * `/crews/[id]` (to widoki kartotek dla admina/dyspozytora).
 *
 * OGRANICZENIE INFRASTRUKTURALNE (dziedziczone z `customers-anonymize-ui.test.ts` i
 * `role-change-dialog-ui.test.ts`, potwierdzone w tej sesji przez odczyt
 * `vitest.config.mts`): `include: ['**\/*.test.ts']` NIE obejmuje `.test.tsx`, brak
 * `environment: 'jsdom'`, brak `setupFiles` dla `@testing-library/jest-dom`, a alias `@/*`
 * nie jest skonfigurowany w root configu. Pełny render (`@testing-library/react`) komponentu
 * używającego `@/components/ui/*` / `@/lib/utils` (jak `layout.tsx` czy wzorce z
 * `role-change-dialog.tsx`) nie jest dziś wykonalny w tym pakiecie testów — próba dałaby zły
 * RED (błąd rozwiązywania modułu), nie asercję. Stosujemy DOKŁADNIE ten sam, wielokrotnie
 * już użyty w tym repo wzorzec dowodu: (1) czyste moduły domenowe bez importów UI, testowane
 * przez zwykły `import`/asercję, oraz (2) testy statyczne nad treścią źródeł `.tsx` przez
 * `readFileSync` + dopasowania tekstowe/balansowanie nawiasów. To NIE jest improwizacja na
 * potrzeby jednego testu — to ustalona konwencja repo (min. 3 wcześniejsze precedensy).
 *
 * ═══════════════════════ KONTRAKT Z IMPLEMENTER-UI (nowe pliki) ═══════════════════════
 *
 *  1. `apps/b2b-web/src/lib/schedule/weekday-labels.ts` — CZYSTY moduł (bez importów UI):
 *       `export const WEEKDAY_LABELS: ReadonlyArray<{ weekday: number; label: string }>`
 *     w kolejności ISO poniedziałek(1)→niedziela(7), etykiety PO POLSKU:
 *     Poniedziałek, Wtorek, Środa, Czwartek, Piątek, Sobota, Niedziela.
 *
 *  2. `apps/b2b-web/src/lib/schedule/nav-visibility.ts` — CZYSTY moduł:
 *       `export function isScheduleNavItemVisible(actorRole: Role | null): boolean`
 *     zwraca `!!actorRole && can(actorRole, 'availability_rules', 'update') !== 'no'`
 *     (import `can`, `type Role` z `@klikklima/contracts` — AC-C5).
 *
 *  3. `apps/b2b-web/src/app/(dashboard)/me/schedule/schedule-client.tsx` ("use client"):
 *     - `useForm` (react-hook-form) + `zodResolver` (`@hookform/resolvers/zod`) na schemacie
 *       ZBUDOWANYM z importowanego `availabilityRuleSchema`
 *       (`.../lib/schedule/availability-rule-schema`) — NIE osobny, niezależny schemat
 *       (AC-C2). Brak `useState` trzymającego wartości pól dnia/godzin z osobna.
 *     - importuje `WEEKDAY_LABELS` i renderuje siedem wierszy przez `.map(` nad nim, z
 *       polami godzina-od/godzina-do (`type="time"`) i przełącznikiem z tekstem
 *       "Dzień wolny" (AC-C1).
 *     - dla dni pochodzących z `source === 'DEFAULT'` pokazuje oznaczenie "Domyślne"
 *       (AC-C3) — literał wystąpienia blisko sprawdzenia `.source === 'DEFAULT'`.
 *     - zapis (prop `onSave`) jest wołany WYŁĄCZNIE wewnątrz handlera
 *       `const onSubmit = async (` — nigdy przy montowaniu / w `useEffect` (AC-C3, druga
 *       połowa: "dopóki nie zapisze, w bazie nie powstaje żaden wiersz").
 *     - NIE zawiera `toggleAuditorActiveAction`, `toggleCrewActiveAction`, `leave_status`
 *       (AC-C4 — brak pola sterującego aktywnością/urlopem pracownika).
 *     - błąd z akcji zapisu trafia do stanu i jest renderowany jako `role="alert"` z
 *       tekstem PO POLSKU (AC-C6), fallback `?? "..."` niepusty.
 *     - zero hexów, ikony wyłącznie z `lucide-react` (AC-C7).
 *
 *  4. `apps/b2b-web/src/app/(dashboard)/me/schedule/page.tsx` — Server Component,
 *     importuje `getCurrentActorRole` PRZEZ ŚCIEŻKĘ WZGLĘDNĄ (wzorem `settings/page.tsx`,
 *     nie `@/utils/...` jak `auditors/page.tsx` — tamten wariant nie ma dziś żadnego testu
 *     bezpośredniego page.tsx w repo, ten wzorzec ma).
 *
 *  5. `apps/b2b-web/src/app/(dashboard)/layout.tsx` — dopisuje pozycję nawigacji z
 *     `href: '/me/schedule'`, warunkowaną wywołaniem `isScheduleNavItemVisible(...)`
 *     zaimportowanym z `.../lib/schedule/nav-visibility` (AC-C5).
 *
 * Dzisiejszy RED: żaden z plików w punktach 1-4 jeszcze nie istnieje (poprawny RED — plik
 * zaplanowany w tym kontrakcie, nie literówka); `layout.tsx` istnieje, ale nie zawiera
 * jeszcze `isScheduleNavItemVisible` ani `/me/schedule` (RED na asercji dopasowania treści).
 */

const LIB_SCHEDULE_DIR = path.resolve(__dirname, '../src/lib/schedule');
const SCHEDULE_ROUTE_DIR = path.resolve(__dirname, '../src/app/(dashboard)/me/schedule');
const LAYOUT_PATH = path.resolve(__dirname, '../src/app/(dashboard)/layout.tsx');

function readScheduleClient(): string {
  return readFileSync(path.join(SCHEDULE_ROUTE_DIR, 'schedule-client.tsx'), 'utf-8');
}

function readSchedulePage(): string {
  return readFileSync(path.join(SCHEDULE_ROUTE_DIR, 'page.tsx'), 'utf-8');
}

function readLayout(): string {
  return readFileSync(LAYOUT_PATH, 'utf-8');
}

/**
 * Odtwarza balansowanie nawiasów klamrowych z `sec-audit-log-role-change.test.ts` /
 * `role-change-dialog-ui.test.ts` (`extractBalancedBlock`) — ekstrakcja bloku funkcji
 * zaczynającego się od dowolnego literalnego markera źródłowego. Rzuca jawnie, jeśli
 * marker albo domykający nawias nie zostaną znalezione (czytelna awaria na `expect`, nie
 * cichy `undefined`).
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

// ─────────────────────────────── AC-C1 ───────────────────────────────

describe('AC-C1 (1/2) — WEEKDAY_LABELS: siedem dni w kolejności ISO poniedziałek→niedziela', () => {
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('zawiera dokładnie siedem wpisów z weekday 1..7 w tej kolejności', async () => {
    const { WEEKDAY_LABELS } = await import('../src/lib/schedule/weekday-labels');

    expect(WEEKDAY_LABELS.map((d: { weekday: number }) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('etykiety są po polsku, w kolejności Poniedziałek..Niedziela', async () => {
    const { WEEKDAY_LABELS } = await import('../src/lib/schedule/weekday-labels');

    expect(WEEKDAY_LABELS.map((d: { label: string }) => d.label)).toEqual([
      'Poniedziałek',
      'Wtorek',
      'Środa',
      'Czwartek',
      'Piątek',
      'Sobota',
      'Niedziela',
    ]);
  });
});

describe('AC-C1 (2/2) — schedule-client.tsx: siedem wierszy z polami godzin i przełącznikiem "Dzień wolny"', () => {
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('importuje WEEKDAY_LABELS i iteruje po nim przez .map(', () => {
    const content = readScheduleClient();

    expect(content).toMatch(
      /import\s*\{[^}]*WEEKDAY_LABELS[^}]*\}\s*from\s*['"][.\/]*lib\/schedule\/weekday-labels['"]/,
    );

    const importIdx = content.indexOf('WEEKDAY_LABELS');
    const mapIdx = content.indexOf('WEEKDAY_LABELS', importIdx + 'WEEKDAY_LABELS'.length);
    expect(mapIdx).toBeGreaterThan(-1);
    const window = content.slice(mapIdx, mapIdx + 50);
    expect(window).toMatch(/WEEKDAY_LABELS\.map\(/);
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('renderuje pola godzina-od/godzina-do jako input type="time"', () => {
    const content = readScheduleClient();

    expect(content).toMatch(/type="time"/);
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('zawiera przełącznik "dzień wolny" dla każdego dnia', () => {
    const content = readScheduleClient();

    expect(content).toContain('Dzień wolny');
  });
});

// ─────────────────────────────── AC-C2 ───────────────────────────────

describe('AC-C2 — formularz na react-hook-form + zodResolver na wspólnym schemacie Zod', () => {
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('importuje useForm z react-hook-form i zodResolver z @hookform/resolvers/zod', () => {
    const content = readScheduleClient();

    expect(content).toMatch(/import\s*\{[^}]*useForm[^}]*\}\s*from\s*['"]react-hook-form['"]/);
    expect(content).toMatch(/import\s*\{[^}]*zodResolver[^}]*\}\s*from\s*['"]@hookform\/resolvers\/zod['"]/);
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('importuje availabilityRuleSchema (ten sam schemat co Server Action) i używa go w zodResolver(...)', () => {
    const content = readScheduleClient();

    expect(content).toMatch(
      /import\s*\{[^}]*availabilityRuleSchema[^}]*\}\s*from\s*['"]@repo\/scheduling['"]/,
    );

    const resolverIdx = content.indexOf('zodResolver(');
    expect(resolverIdx).toBeGreaterThan(-1);
    const window = content.slice(resolverIdx, resolverIdx + 300);
    expect(window).toMatch(/availabilityRuleSchema/);
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('nie trzyma wartości pól dnia/godzin przez useState (żadnego [days|weekday|startTime|endTime|start_time|end_time|rules, setX] = useState)', () => {
    const content = readScheduleClient();

    expect(content).not.toMatch(
      /const\s*\[\s*(days|weekday|startTime|start_time|endTime|end_time|rules)\s*,\s*set[A-Za-z]+\s*\]\s*=\s*useState/,
    );
  });
});

// ─────────────────────────────── AC-C3 ───────────────────────────────

describe('AC-C3 — brak reguł: wartości domyślne oznaczone jako domyślne, brak zapisu przed submitem', () => {
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('dla dni source === "DEFAULT" pokazuje oznaczenie "Domyślne"', () => {
    const content = readScheduleClient();

    const sourceCheckIdx = content.search(/\.source\s*===\s*['"]DEFAULT['"]/);
    expect(sourceCheckIdx).toBeGreaterThan(-1);

    const window = content.slice(Math.max(0, sourceCheckIdx - 200), sourceCheckIdx + 400);
    expect(window).toMatch(/Domyślne/);
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('wywołanie zapisu (onSave) występuje wyłącznie wewnątrz handlera onSubmit, nie przy montowaniu', () => {
    const content = readScheduleClient();

    const onSubmitBlock = extractBalancedBlock(content, 'const onSubmit = async (');
    const totalOnSaveCalls = (content.match(/\bonSave\(/g) ?? []).length;
    const onSaveCallsInsideOnSubmit = (onSubmitBlock.match(/\bonSave\(/g) ?? []).length;

    expect(totalOnSaveCalls).toBeGreaterThan(0);
    expect(onSaveCallsInsideOnSubmit).toBe(totalOnSaveCalls);
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('onSave nie jest wołane wewnątrz useEffect (brak automatycznego zapisu przy załadowaniu ekranu)', () => {
    const content = readScheduleClient();

    const useEffectMatches = [...content.matchAll(/useEffect\(/g)];
    for (const match of useEffectMatches) {
      const block = extractBalancedBlock(content.slice(match.index!), 'useEffect(');
      expect(block).not.toMatch(/\bonSave\(/);
    }
  });
});

// ─────────────────────────────── AC-C4 ───────────────────────────────

describe('AC-C4 — brak pola sterującego is_active/aktywny/leave_status pracownika', () => {
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('schedule-client.tsx nie zawiera toggleAuditorActiveAction/toggleCrewActiveAction/leave_status', () => {
    const content = readScheduleClient();

    expect(content).not.toMatch(/toggleAuditorActiveAction/);
    expect(content).not.toMatch(/toggleCrewActiveAction/);
    expect(content).not.toMatch(/leave_status/);
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('page.tsx nie zawiera toggleAuditorActiveAction/toggleCrewActiveAction/leave_status', () => {
    const content = readSchedulePage();

    expect(content).not.toMatch(/toggleAuditorActiveAction/);
    expect(content).not.toMatch(/toggleCrewActiveAction/);
    expect(content).not.toMatch(/leave_status/);
  });
});

// ─────────────────────────────── AC-C5 ───────────────────────────────

describe('AC-C5 (1/2) — isScheduleNavItemVisible: widoczna wyłącznie dla ról z availability_rules:update ≠ no', () => {
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('zwraca true dokładnie dla ról, dla których can(role, "availability_rules", "update") !== "no"', async () => {
    const { isScheduleNavItemVisible } = await import('../src/lib/schedule/nav-visibility');

    const expectedVisible = ROLES.filter((r) => can(r, 'availability_rules', 'update') !== 'no');
    const expectedHidden = ROLES.filter((r) => can(r, 'availability_rules', 'update') === 'no');

    for (const role of expectedVisible) {
      expect(isScheduleNavItemVisible(role)).toBe(true);
    }
    for (const role of expectedHidden) {
      expect(isScheduleNavItemVisible(role)).toBe(false);
    }
    expect(isScheduleNavItemVisible(null)).toBe(false);
  });

  // Kontrola pozytywna wprost z WO: dyspozytor ma tylko `read`, nie `update` — pozycja
  // nawigacji ma być dla niego ukryta mimo że widzi dane w warstwie B.
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('dyspozytor (tylko read, brak update) nie widzi pozycji nawigacji', async () => {
    const { isScheduleNavItemVisible } = await import('../src/lib/schedule/nav-visibility');

    expect(can('dyspozytor', 'availability_rules', 'update')).toBe('no');
    expect(isScheduleNavItemVisible('dyspozytor')).toBe(false);
  });

  // Kontrola pozytywna: audytor i monter (variant :own) oraz admin (bez :own) widzą pozycję.
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('audytor, monter (variant :own) i admin widzą pozycję nawigacji', async () => {
    const { isScheduleNavItemVisible } = await import('../src/lib/schedule/nav-visibility');

    expect(isScheduleNavItemVisible('audytor')).toBe(true);
    expect(isScheduleNavItemVisible('monter')).toBe(true);
    expect(isScheduleNavItemVisible('admin')).toBe(true);
  });
});

describe('AC-C5 (2/2) — layout.tsx warunkuje pozycję nawigacji /me/schedule przez isScheduleNavItemVisible', () => {
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('importuje isScheduleNavItemVisible z lib/schedule/nav-visibility', () => {
    const content = readLayout();

    expect(content).toMatch(
      /import\s*\{[^}]*isScheduleNavItemVisible[^}]*\}\s*from\s*['"][.\/]*lib\/schedule\/nav-visibility['"]/,
    );
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('pozycja nawigacji z href "/me/schedule" jest warunkowana wywołaniem isScheduleNavItemVisible(...)', () => {
    const content = readLayout();

    const hrefIdx = content.indexOf("/me/schedule");
    expect(hrefIdx).toBeGreaterThan(-1);

    const precedingContext = content.slice(Math.max(0, hrefIdx - 400), hrefIdx);
    expect(precedingContext).toMatch(/isScheduleNavItemVisible\(/);
  });
});

// ─────────────────────────────── AC-C6 ───────────────────────────────

describe('AC-C6 — odmowa z Server Action pokazana jako komunikat po polsku, nie pusty ekran/wyjątek', () => {
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('błąd zapisu trafia do stanu i jest renderowany w elemencie role="alert"', () => {
    const content = readScheduleClient();

    const alertIdx = content.indexOf('role="alert"');
    expect(alertIdx).toBeGreaterThan(-1);

    const window = content.slice(Math.max(0, alertIdx - 200), alertIdx + 100);
    expect(window).toMatch(/submitError/);
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('fallback komunikatu błędu (gdy result.error jest puste) jest niepustym literałem po polsku, nie zrzutem wyjątku', () => {
    const content = readScheduleClient();

    const fallbackMatch = content.match(/result\.error\s*\?\?\s*(['"])([^'"]+)\1/);
    expect(fallbackMatch).not.toBeNull();
    const fallbackText = fallbackMatch![2];
    expect(fallbackText.length).toBeGreaterThan(0);
    expect(fallbackText).not.toMatch(/error\.(message|stack)/);
  });
});

// ─────────────────────────────── AC-C7 ───────────────────────────────

describe('AC-C7 — zero hardkodowanych kolorów hex, ikony wyłącznie z lucide-react', () => {
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('schedule-client.tsx nie zawiera literału koloru hex', () => {
    const content = readScheduleClient();

    expect(content).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('page.tsx nie zawiera literału koloru hex', () => {
    const content = readSchedulePage();

    expect(content).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('schedule-client.tsx nie importuje ikon spoza lucide-react (heroicons/react-icons/radix-icons)', () => {
    const content = readScheduleClient();

    expect(content).not.toMatch(/from\s*['"]@heroicons\//);
    expect(content).not.toMatch(/from\s*['"]react-icons/);
    expect(content).not.toMatch(/from\s*['"]@radix-ui\/react-icons['"]/);
  });
});
