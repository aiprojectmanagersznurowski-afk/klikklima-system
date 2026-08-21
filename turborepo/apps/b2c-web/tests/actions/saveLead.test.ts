import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/B2C-LEAD-GEO-PERSIST.md — AC1, AC2, AC3, AC4, AC5, AC6.
 *
 * Kontekst: `saveLead.ts` (apps/b2c-web/app/actions/saveLead.ts) jest DZIŚ bez żadnego
 * pokrycia testowego — to jest pierwszy test tej ścieżki (WO, "Brakuje" pkt 2). Jest to
 * jedyna Server Action realnie wywoływana z UI (Step8Booking.tsx:195); `leads.ts` ma
 * osobny test — patrz `submitFinalTriage.test.ts` w tym samym katalogu.
 *
 * Mockowanie: ten sam wzorzec co `getRecommendation.test.ts` / `getSetForConfig.test.ts`
 * w tym katalogu — `vi.mock('@/lib/supabaseClient', ...)` przechwytuje import mimo braku
 * aliasu `@/*` w `vitest.config.mts` (zweryfikowane empirycznie w tych plikach wcześniej).
 * Dodatkowo `saveLead.ts` importuje `createCalendarEvent` RELATYWNIE (`from "./calendar"`),
 * nie przez alias — dlatego mockujemy go pod ścieżką WZGLĘDEM TEGO pliku testowego
 * (`../../app/actions/calendar`), która rozwiązuje się do TEGO SAMEGO pliku absolutnego
 * co `./calendar` widziane z `saveLead.ts`. Zweryfikowane empirycznie: mockowanie pod
 * literałem `'./calendar'` (skopiowanym 1:1 z saveLead.ts, ale nierozwiązywalnym z
 * katalogu tego testu) NIE przechwytuje importu — realny moduł `calendar.ts` i tak się
 * wykonuje. Bez tego mocka test i tak by przeszedł (createCalendarEvent łapie własne
 * błędy i saveLead traktuje awarię kalendarza jako niekrytyczną), ale kosztem prawdziwej
 * próby uwierzytelnienia w Google API i szumu w konsoli — mock usuwa obie te rzeczy.
 *
 * AC6 (typowanie `SaveLeadData`) NIE jest weryfikowalne przez `npx vitest run` — Vitest
 * transpiluje przez esbuild i NIE wykonuje type-checkingu, więc nadmiarowa właściwość
 * w literale obiektu przechodzi w runtime bez ostrzeżenia niezależnie od tego, czy
 * interfejs ją deklaruje. Dowód RED dla AC6 jest w kompilacji, nie w asercji:
 *
 *     npx tsc --noEmit -p apps/b2c-web/tsconfig.json
 *
 * Zweryfikowane przed napisaniem tej wersji pliku: `apps/b2c-web` ma DZIŚ zero błędów
 * `tsc --noEmit` bez tego pliku. Każdy `saveLead({ ..., lat, lng })` poniżej — wywołany
 * z literałem WPROST jako argument (nie przez zmienną pośrednią) — jest dokładnie tym
 * przypadkiem, w którym TypeScript wykonuje "excess property check": DZIŚ każde takie
 * wywołanie w tym pliku daje `TS2353: Object literal may only specify known properties,
 * and 'lat' does not exist in type 'SaveLeadData'`. To jest właściwy RED dla AC6 — zniknie
 * dopiero, gdy `SaveLeadData` zadeklaruje `lat?`/`lng?` jako `number`, bez rzutowania na
 * typ `any` ani wyciszania błędu komentarzem (oba zabronione hookiem `guard-forbidden`,
 * patrz .claude/CLAUDE.md).
 *
 * Dług nazewniczy (ADR-002): ten plik mockuje wywołania na tabelach `klienci`/`adresy`/
 * `leady` (polskie nazwy — źródło prawdy to dzisiejszy kod `saveLead.ts`, nie słownik
 * docelowy) i odczytuje klucz `ulica_miasto` z argumentu insertu. `tools/kk-naming-baseline.json`
 * nie ma wpisu dla tego pliku (nowy plik testowy), więc `kk-naming.mjs --check-baseline`
 * pokaże dla niego przyrost > 0 — to jest oczekiwane i zaakceptowane w WO ("Ograniczenia"),
 * zgłoszone w podsumowaniu, baseline NIE jest aktualizowany przez tego agenta.
 */

const {
  fromSpy,
  klienciInsertSpy,
  adresyInsertSpy,
  adresyUpdateSpy,
  leadyInsertSpy,
  calendarSpy,
} = vi.hoisted(() => {
  // Parametr insertu jest jawnie typowany (Record<string, unknown>, zgodnie z tym, co
  // realnie przekazuje saveLead.ts: pojedynczy obiekt, nie tablica) — bez tego `vi.fn(() =>`
  // wnioskuje sygnaturę bezargumentową, `mock.calls[0]` staje się krotką `[]`, a indeksowanie
  // `[0]` w testach niżej pada pod `tsc --noEmit` na TS2493/TS18048, mimo że w runtime
  // (Vitest/esbuild, bez type-checkingu) wszystko działa poprawnie. Ten sam wzorzec zanieczyszcza
  // dziś wyjście `tsc` w `crews-cert-availability.test.ts` — nie powielamy go tutaj.
  const klienciInsertSpy = vi.fn((_row: Record<string, unknown>) => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { id: 'klient-test-1' }, error: null })),
    })),
  }));

  const adresyInsertSpy = vi.fn((_row: Record<string, unknown>) => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { id: 'adres-test-1' }, error: null })),
    })),
  }));

  // B2C-LEAD-ATOMIC: jeżeli implementacja sięgnie po drugi zapis (update) na adresy
  // zamiast wpisać współrzędne w ten sam insert, ten spy rzuca — test i tak by już
  // padł na asercjach latitude/longitude, ale to czyni przyczynę jednoznaczną.
  const adresyUpdateSpy = vi.fn(() => {
    throw new Error(
      'B2C-LEAD-ATOMIC: adresy nie powinno mieć drugiego zapisu (update) po insercie — ' +
        'współrzędne muszą wejść w ten sam insert co klient_id/ulica_miasto.',
    );
  });

  const leadyInsertSpy = vi.fn(async () => ({ error: null }));

  const calendarSpy = vi.fn(async () => ({ success: true, eventLink: 'stub' }));

  const fromSpy = vi.fn((table: string) => {
    switch (table) {
      case 'klienci':
        return { insert: klienciInsertSpy };
      case 'adresy':
        return { insert: adresyInsertSpy, update: adresyUpdateSpy };
      case 'leady':
        return { insert: leadyInsertSpy };
      default:
        throw new Error(
          `saveLead.test: nieoczekiwana tabela "${table}" — dopisz obsługę w mocku zanim rozszerzysz test.`,
        );
    }
  });

  return { fromSpy, klienciInsertSpy, adresyInsertSpy, adresyUpdateSpy, leadyInsertSpy, calendarSpy };
});

vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: fromSpy } }));
vi.mock('../../app/actions/calendar', () => ({ createCalendarEvent: calendarSpy }));

const { saveLead } = await import('../../app/actions/saveLead');

const basePayload = () => ({
  name: 'Jan Kowalski',
  email: 'jan.kowalski@example.com',
  phone: '500600700',
  address: 'Marszałkowska 1, Warszawa',
  bookingDate: '2026-08-25',
  bookingSlot: '08:00 - 10:00',
  triageData: {},
});

describe('saveLead — persystencja współrzędnych adresu (WO B2C-LEAD-GEO-PERSIST)', () => {
  beforeEach(() => {
    fromSpy.mockClear();
    klienciInsertSpy.mockClear();
    adresyInsertSpy.mockClear();
    adresyUpdateSpy.mockClear();
    leadyInsertSpy.mockClear();
    calendarSpy.mockClear();
  });

  // @REQ: FLD-GEO-COORDS
  it('AC1/AC2/AC5 — adres geokodowany: latitude i longitude z dokładnością bez zaokrąglenia trafiają do TEGO SAMEGO insertu na adresy', async () => {
    const lat = 52.2296756; // 7 miejsc po przecinku — WO R4: Google Places zwraca 7-8
    const lng = 21.0122287;

    const result = await saveLead({ ...basePayload(), lat, lng });

    expect(result.success).toBe(true);

    // AC5 / B2C-LEAD-ATOMIC — dokładnie jeden insert na adresy, żadnego drugiego kroku,
    // ta sama sekwencja tabel co dziś (klienci -> adresy -> leady).
    expect(fromSpy.mock.calls.map(([table]) => table)).toEqual(['klienci', 'adresy', 'leady']);
    expect(adresyInsertSpy).toHaveBeenCalledTimes(1);
    expect(adresyUpdateSpy).not.toHaveBeenCalled();

    const insertArg = adresyInsertSpy.mock.calls[0][0];
    // Sanity check, że patrzymy na właściwe wywołanie insertu (ten sam wiersz co dziś).
    expect(insertArg.ulica_miasto).toBe('Marszałkowska 1, Warszawa');

    // AC1 — nazwy kolumn to latitude/longitude (schema.prisma:63-64), nie lat/lng.
    // AC2 — wartość identyczna z otrzymaną, bez zaokrąglenia, porównanie dokładne (`toBe`).
    expect(insertArg.latitude).toBe(lat);
    expect(insertArg.longitude).toBe(lng);
  });

  // @REQ: FLD-GEO-COORDS
  it('AC3 — adres bez geokodowania (coordinates === undefined, jak w Step8Booking.tsx: lat: coordinates?.lat): insert zapisuje null, nie undefined, i lead powstaje normalnie', async () => {
    const result = await saveLead({ ...basePayload(), lat: undefined, lng: undefined });

    // Brak współrzędnych NIE jest błędem walidacji — lead musi powstać.
    expect(result.success).toBe(true);

    const insertArg = adresyInsertSpy.mock.calls[0][0];

    // `toBeNull()` odrzuca też `undefined` — jeżeli implementacja przepuści `data.lat`
    // wprost (bez `?? null`), właściwość będzie `undefined`, nie `null`, i test padnie
    // dokładnie na tej różnicy, o którą prosi WO ("nie może... zapisać undefined").
    expect(insertArg.latitude).toBeNull();
    expect(insertArg.longitude).toBeNull();
  });

  // @REQ: FLD-GEO-COORDS
  it('AC4 — lat === 0 zapisuje się jako 0, nie jako null (?? kontra ||)', async () => {
    // Polska nigdy nie leży na zerowym południku (WO) — 0 jest tu wyłącznie sondą operatora.
    await saveLead({ ...basePayload(), lat: 0, lng: 21.0122287 });

    const insertArg = adresyInsertSpy.mock.calls[0][0];

    expect(insertArg.latitude).not.toBeNull();
    expect(insertArg.latitude).toBe(0);
  });

  // Przypadek brzegowy z WO ("Przypadki brzegowe, które MUSZĄ mieć test" —
  // "Współrzędne jako tekst"). Decyzja test-authora (WO zostawia ją jawnie otwartą,
  // "test musi rozstrzygnąć, które z tych dwóch zachowań jest oczekiwane"): kolumna
  // docelowa to `double precision`, a AC2 wymaga wartości liczbowej bez konwersji na
  // tekst PO DRODZE DO bazy — spójna z tym granica jest taka, że wejście typu string
  // (np. z ręcznie sklejonego żądania do Server Action, bo Next.js niczego tu dziś nie
  // waliduje przez Zod, mimo ADR-001) musi zostać skonwertowane do liczby PRZED insertem,
  // nie przekazane surowo. To NIE jest walidacja zakresu (-90..90), która jest poza
  // zakresem tego WO — to podstawowa spójność typu kolumny. REVIEW: jeżeli reviewer uzna
  // to za rozszerzenie zakresu, ten test jest kandydatem do usunięcia/zmiany decyzji.
  // @REQ: FLD-GEO-COORDS
  it('brzeg: współrzędne przekazane jako string trafiają do insertu jako number, nie jako surowy tekst', async () => {
    const payload = basePayload() as Record<string, unknown>;
    payload.lat = '52.2296756';
    payload.lng = '21.0122287';

    await saveLead(payload as unknown as Parameters<typeof saveLead>[0]);

    const insertArg = adresyInsertSpy.mock.calls[0][0];

    expect(typeof insertArg.latitude).toBe('number');
    expect(insertArg.latitude).toBe(52.2296756);
    expect(typeof insertArg.longitude).toBe('number');
    expect(insertArg.longitude).toBe(21.0122287);
  });
});
