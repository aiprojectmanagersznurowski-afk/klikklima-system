import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOM_COUNT_EXPERT_THRESHOLD } from '@klikklima/contracts';
import { useTriageStore, type RoomCount } from '../../store/triageStore';

/**
 * WO: docs/workorders/B2C-TRIAGE-DISQUALIFY.md
 *
 * Umiejscowienie pliku: `apps/b2c-web/tests/store/` — NIE `apps/b2c-web/store/`
 * jak sugeruje tabela plików w WO. `guard-paths` ogranicza zapis roli
 * `test-author` do `tests/`, `e2e/`, `__tests__/`, `apps/(dowolny pakiet)/tests/`,
 * `packages/(dowolny pakiet)/tests/`; katalog obok źródła jest poza zakresem tej roli.
 * `vitest.config.mts` i tak znajdzie ten plik (wzorzec include nie ogranicza
 * lokalizacji), a `kk-trace.mjs` przeszukuje `apps/` rekurencyjnie.
 *
 * `useTriageStore` jest hookiem zustand — poza Reactem używamy go przez jego
 * statyczne `.getState()` / `.setState()`, tak jak store'y zustand robią to
 * w testach jednostkowych (nie renderujemy komponentu, żeby to sprawdzić).
 *
 * `disqualifyingRuleIds` NIE ISTNIEJE jeszcze na sklepie (patrz WO, sekcja
 * "Brakuje" pkt 1 i tabela `implementer-ui`: "Wystaw też listę spełnionych
 * reguł"). Odwołanie do niego jest CELOWE — to jest dokładnie ta funkcja
 * domenowa, której brak ma dać czerwień. Rzutowanie na `unknown` (nie `any`)
 * jest po to, żeby test się skompilował dziś i przestał być potrzebny, gdy
 * pole trafi do `TriageStore`.
 */
type FutureDisqualificationState = { disqualifyingRuleIds?: string[] };
const futureState = () => useTriageStore.getState() as unknown as FutureDisqualificationState;

const THRESHOLD = ROOM_COUNT_EXPERT_THRESHOLD;
const BELOW_THRESHOLD = (THRESHOLD - 1) as RoomCount;
const AT_THRESHOLD = THRESHOLD as RoomCount;
const ABOVE_THRESHOLD = (THRESHOLD + 1) as RoomCount; // = 5, górna granica RoomCount

describe('triageStore — selektor dyskwalifikacji (isExpertScreen)', () => {
  beforeEach(() => {
    useTriageStore.getState().reset();
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('reguła COMMERCIAL_PROPERTY dyskwalifikuje samodzielnie i zgłasza wyłącznie siebie w liście reguł', () => {
    useTriageStore.getState().updateData({ location: 'Lokal komercyjny', roomCount: 1 });

    expect(useTriageStore.getState().isExpertScreen).toBe(true);
    // Dzisiejszy store nie wystawia listy reguł — to jest brakująca funkcja domenowa.
    expect(futureState().disqualifyingRuleIds).toEqual(['COMMERCIAL_PROPERTY']);
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('reguła ROOM_COUNT_AT_OR_ABOVE_THRESHOLD dyskwalifikuje samodzielnie, niezależnie od typu budynku', () => {
    useTriageStore.getState().updateData({ location: 'Mieszkanie', roomCount: AT_THRESHOLD });

    // Dzisiejszy getter isExpertScreen destrukturyzuje roomCount i nigdy go nie używa (WO, "Istnieje").
    expect(useTriageStore.getState().isExpertScreen).toBe(true);
    expect(futureState().disqualifyingRuleIds).toEqual(['ROOM_COUNT_AT_OR_ABOVE_THRESHOLD']);
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('koniunkcja obu reguł: jeden ekran Eksperta, ale zbiór DWÓCH identyfikatorów — nie boolean', () => {
    useTriageStore.getState().updateData({ location: 'Lokal komercyjny', roomCount: AT_THRESHOLD });

    expect(useTriageStore.getState().isExpertScreen).toBe(true);

    const ruleIds = futureState().disqualifyingRuleIds ?? [];
    expect(new Set(ruleIds)).toEqual(new Set(['COMMERCIAL_PROPERTY', 'ROOM_COUNT_AT_OR_ABOVE_THRESHOLD']));
    // Koniunkcja nie może zniknąć w deduplikacji ani w skróceniu do samego booleana.
    expect(ruleIds.length).toBe(2);
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('roomCount === null przy lokalu komercyjnym: selektor nie rzuca wyjątkiem i zgłasza wyłącznie COMMERCIAL_PROPERTY', () => {
    useTriageStore.getState().updateData({ location: 'Lokal komercyjny', roomCount: null });

    expect(() => useTriageStore.getState().isExpertScreen).not.toThrow();
    expect(useTriageStore.getState().isExpertScreen).toBe(true);
    expect(futureState().disqualifyingRuleIds).toEqual(['COMMERCIAL_PROPERTY']);
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('location === null przy roomCount = 5: dyskwalifikuje wyłącznie reguła liczby pomieszczeń', () => {
    useTriageStore.getState().updateData({ location: null, roomCount: ABOVE_THRESHOLD });

    expect(() => useTriageStore.getState().isExpertScreen).not.toThrow();
    expect(useTriageStore.getState().isExpertScreen).toBe(true);
    expect(futureState().disqualifyingRuleIds).toEqual(['ROOM_COUNT_AT_OR_ABOVE_THRESHOLD']);
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('granica progu w trzech punktach: próg-1 nie dyskwalifikuje, próg dyskwalifikuje, próg+1 (5) dyskwalifikuje', () => {
    useTriageStore.getState().updateData({ location: 'Mieszkanie', roomCount: BELOW_THRESHOLD });
    expect(useTriageStore.getState().isExpertScreen).toBe(false);

    useTriageStore.getState().updateData({ roomCount: AT_THRESHOLD });
    expect(useTriageStore.getState().isExpertScreen).toBe(true);

    useTriageStore.getState().updateData({ roomCount: ABOVE_THRESHOLD });
    expect(useTriageStore.getState().isExpertScreen).toBe(true);
  });

  // Kontrola negatywna (dziś zielona, ma zostać zielona po implementacji): 2 i 3 pokoje
  // to główny przypadek biznesowy — muszą nadal dochodzić do wyceny.
  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('kontrola negatywna: 2 i 3 pokoje w mieszkaniu nie dyskwalifikują', () => {
    useTriageStore.getState().updateData({ location: 'Mieszkanie', roomCount: 2 });
    expect(useTriageStore.getState().isExpertScreen).toBe(false);

    useTriageStore.getState().updateData({ roomCount: 3 });
    expect(useTriageStore.getState().isExpertScreen).toBe(false);
  });

  // REVIEW: MAJOR — AC21 nie miał realnego dowodu jednostkowego. E2E (triage-disqualify.spec.ts,
  // test AC21) sprawdza wyłącznie brak kwoty w UI Step8Booking, co jest trywialnie prawdziwe
  // (Step8Booking z konstrukcji nigdy nie renderuje ceny na ŻADNEJ ścieżce). Sednem AC21 jest,
  // żeby `priceDevices`/`priceInstallation` w store — jedyne pola zasilające `estimatedQuote`
  // w `saveLead.ts` (linie 48-55) — pozostały zerami na ścieżce Eksperta. Ten test jest tani
  // (store, bez renderowania) i domyka realną lukę; E2E zostaje jako dowód UI.
  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('ścieżka Eksperta: priceDevices i priceInstallation pozostają zerami (AC21)', () => {
    useTriageStore.getState().updateData({ location: 'Lokal komercyjny', roomCount: 1 });

    expect(useTriageStore.getState().isExpertScreen).toBe(true);
    expect(useTriageStore.getState().data.priceDevices).toBe(0);
    expect(useTriageStore.getState().data.priceInstallation).toBe(0);
  });
});

describe('AC5 — brak literału progu w roli progu (statyczne skanowanie źródeł)', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = join(HERE, '..', '..', '..', '..'); // apps/b2c-web/tests/store -> ... -> root

  const SCANNED_DIRS = [
    join(REPO_ROOT, 'apps/b2c-web/store'),
    join(REPO_ROOT, 'apps/b2c-web/components'),
    join(REPO_ROOT, 'apps/b2c-web/app/actions'),
  ];

  // Pliki testowe tego wymagania — E2E żyją poza include vitest, więc skanujemy je tu
  // jawnie z dysku, niezależnie od tego, czy vitest by je uruchomił.
  const REQUIREMENT_TEST_FILES = [
    join(HERE, 'triageStore.test.ts'),
    join(REPO_ROOT, 'apps/b2c-web/tests/actions/getRecommendation.test.ts'),
    join(REPO_ROOT, 'apps/b2c-web/tests/actions/getSetForConfig.test.ts'),
    join(REPO_ROOT, 'apps/b2c-web/e2e/triage-disqualify.spec.ts'),
    join(REPO_ROOT, 'apps/b2c-web/e2e/device-modal-disqualify.spec.ts'),
  ];

  const CODE_EXT = new Set(['.ts', '.tsx']);
  const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.turbo']);

  function walk(dir: string, out: string[] = []): string[] {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir)) {
      if (IGNORE_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full, out);
      else if (CODE_EXT.has(extname(full))) out.push(full);
    }
    return out;
  }

  // Próg w roli progu: obejmuje zarówno porównania liczbowe (operator GTE z kontraktu
  // zapisany na sztywno zamiast zaimportowany), jak i słowną zapowiedź progu w treści PL
  // — patrz sekcja "Treść ekranu Eksperta" w WO. Wzorce poniżej celowo NIE są wpisane
  // wprost w ten komentarz (żeby nie zanieczyścić własnego wyniku skanowania) — patrz
  // literały regex niżej. Świadomie NIE łapiemy równości `roomCount` z wartością progu
  // — to enumeracja kafelka wyboru (Step2Rooms ma identyczny wzorzec dla każdej z pięciu
  // opcji), nie warunek progowy.
  const FORBIDDEN_THRESHOLD_PATTERNS: RegExp[] = [
    /4\s*i\s*wi[eę]cej\s*pomieszcz/i,
    /cztere?ch?\s+(i\s+wi[eę]cej\s+)?pomieszcze/i,
    />=\s*4\b/,
    /roomCount\s*>=\s*4\b/,
    /rooms(\.length)?\s*>=\s*4\b/i,
  ];

  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('żaden plik store/components/actions ani plik testowy tego wymagania nie zawiera literału 4 w roli progu', () => {
    const files = [
      ...SCANNED_DIRS.flatMap((d) => walk(d)),
      ...REQUIREMENT_TEST_FILES.filter((f) => existsSync(f)),
    ];

    const offenders: { file: string; line: number; text: string }[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (FORBIDDEN_THRESHOLD_PATTERNS.some((re) => re.test(line))) {
          offenders.push({ file, line: i + 1, text: line.trim() });
        }
      });
    }

    expect(
      offenders,
      offenders.map((o) => `${o.file}:${o.line} -> ${o.text}`).join('\n'),
    ).toEqual([]);
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('komunikat ekranu Eksperta interpoluje próg z ROOM_COUNT_EXPERT_THRESHOLD, a nie z literału', () => {
    const stepExpertPath = join(REPO_ROOT, 'apps/b2c-web/components/triage/steps/StepExpert.tsx');
    expect(existsSync(stepExpertPath)).toBe(true);
    const content = readFileSync(stepExpertPath, 'utf8');

    // Treść zatwierdzona przez człowieka (WO, "Treść ekranu Eksperta"): fragment
    // "{próg} i więcej pomieszczeń" musi renderować wartość ROOM_COUNT_EXPERT_THRESHOLD,
    // nie tekst z literałem wpisanym na sztywno. Test czyta SUROWE źródło (readFileSync),
    // nie DOM wyrenderowany (@testing-library/react nie jest zależnością tego repo — decyzja
    // człowieka: nie dodawać w środku pętli GREEN). Poprawna interpolacja JSX
    // `{ROOM_COUNT_EXPERT_THRESHOLD} i więcej pomieszczeń` nie zawiera cyfry w surowym
    // tekście (React podstawia wartość dopiero przy renderze), więc asercja sprawdza
    // obecność SAMEGO IDENTYFIKATORA obok frazy — to jest właściwy dowód interpolacji
    // z kontraktu, a nie z literału wpisanego na sztywno.
    expect(content).toMatch(/ROOM_COUNT_EXPERT_THRESHOLD\s*\}?\s*i\s*wi[eę]cej\s*pomieszcze/);
    expect(content).not.toMatch(/4\s*i\s*wi[eę]cej\s*pomieszcze/i);
  });
});

describe('AC16 — endpoint debugowy usunięty', () => {
  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('apps/b2c-web/app/api/test-rec/route.ts nie istnieje', () => {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO_ROOT = join(HERE, '..', '..', '..', '..');
    const routePath = join(REPO_ROOT, 'apps/b2c-web/app/api/test-rec/route.ts');

    expect(existsSync(routePath)).toBe(false);
  });
});
