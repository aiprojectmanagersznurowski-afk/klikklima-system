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
 *
 * Addendum (2026-09-14, BEZ własnego WO — następstwo przepisania `saveLead.ts` pod WO
 * `B2C-BOOKING-SLOT` wersja 2, zgłoszone implementerowi jako `TEST-DEFECT` na tym pliku):
 * `saveLead()` przyjmuje teraz `startAtIso: string` (zamiast `bookingDate`/`bookingSlot`)
 * i po insercie na `leady` woła `createBooking()` z `@repo/scheduling`, a przy sukcesie
 * dopisuje `data_rezerwacji` osobnym UPDATE na `leady` — DWA nowe wywołania `from('leady')`
 * (insert, potem update), których ten plik (WO B2C-LEAD-GEO-PERSIST, zamknięte, dotyczy
 * WYŁĄCZNIE geokodowania) nie ma powodu weryfikować merytorycznie. Rezerwacja jest tu
 * zamockowana na `ok: true` (wzorzec 1:1 z `saveLead.booking.test.ts`, plikiem siostrzanym
 * napisanym w tej samej turze RED dla WO B2C-BOOKING-SLOT) wyłącznie po to, żeby ścieżka
 * sukcesu dotarła do asercji o geokodowaniu — to NIE jest test rezerwacji, więc rezerwacja
 * ma się "po prostu udać" w tle i nie przesłaniać właściwej asercji. Z tego samego powodu
 * mock na `leady` zyskuje `update` (analogicznie do `adresyUpdateSpy` już istniejącego
 * wcześniej w tym pliku, ale bez rzucania — update na leady jest tu oczekiwany i zamierzony
 * po sukcesie rezerwacji, w przeciwieństwie do update na adresy, który nigdy nie powinien
 * zajść).
 *
 * Addendum (2026-08-24, BEZ własnego WO — następstwo naprawy bezpieczeństwa `SEC-RLS-BASELINE`,
 * migracja `supabase/migrations/20260824185845_security_enable_rls_baseline.sql`, już
 * scommitowana): `klienciInsertSpy`/`adresyInsertSpy` NIE zwracają już
 * `{ select: () => ({ single: async () => ({ data: { id }, error: null }) }) }`.
 * Powód: `INSERT ... RETURNING` (czyli `.insert().select().single()`) wymaga u wykonującej
 * roli polityki RLS **SELECT**, nie tylko INSERT — zweryfikowane bezpośrednio na żywej
 * bazie jako rola `anon`. `klienci`/`adresy` mają dziś świadomie WYŁĄCZNIE politykę INSERT
 * dla `anon`; polityka SELECT `USING (true)` ujawniałaby dane kontaktowe WSZYSTKICH
 * klientów przez REST API, więc nie jest opcją. Docelowa implementacja (kolejna tura,
 * `implementer-server`) generuje `id` sama (`crypto.randomUUID()`), wstawia je jawnie w
 * insert i NIE woła `.select()` — dlatego mock musi zwracać kształt odpowiedzi na sam
 * `.insert(row)` bez łańcucha: `vi.fn(async (_row) => ({ error: null }))`. Nowe testy na
 * końcu pliku (bez `@REQ:` — to nie jest część żadnego WO, patrz uzasadnienie przy nich)
 * dowodzą, że `id` faktycznie jest generowane W KODZIE (kształt UUID) i konsekwentnie
 * przekazywane dalej (adresy.klient_id, leady.klient_id/adres_id) — a nie odczytywane z
 * odpowiedzi insertu, której po tej naprawie już nie ma. Insert na `leady` nie zmienia
 * kształtu (już dziś nie ma `.select()`) — `leadyInsertSpy` dostaje tu jedynie jawny typ
 * parametru, żeby dało się odczytać przekazany wiersz w nowych asercjach (patrz komentarz
 * przy typowaniu `Record<string, unknown>` niżej).
 */

const {
  fromSpy,
  klienciInsertSpy,
  adresyInsertSpy,
  adresyUpdateSpy,
  leadyInsertSpy,
  leadyUpdateSpy,
  leadyUpdateEqSpy,
  calendarSpy,
  createBookingSpy,
  visitDurationBasketFindFirstMock,
} = vi.hoisted(() => {
  // Parametr insertu jest jawnie typowany (Record<string, unknown>, zgodnie z tym, co
  // realnie przekazuje saveLead.ts: pojedynczy obiekt, nie tablica) — bez tego `vi.fn(() =>`
  // wnioskuje sygnaturę bezargumentową, `mock.calls[0]` staje się krotką `[]`, a indeksowanie
  // `[0]` w testach niżej pada pod `tsc --noEmit` na TS2493/TS18048, mimo że w runtime
  // (Vitest/esbuild, bez type-checkingu) wszystko działa poprawnie. Ten sam wzorzec zanieczyszcza
  // dziś wyjście `tsc` w `crews-cert-availability.test.ts` — nie powielamy go tutaj.
  //
  // Kształt zwrotny (SEC-RLS-BASELINE, patrz addendum na górze pliku): bezpośrednio
  // awaitowalny obiekt `{ error: null }`, BEZ `.select()` — insert po naprawie RLS nie
  // odczytuje już nic zwrotnie, bo tabela nie ma polityki SELECT dla `anon`.
  const klienciInsertSpy = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));

  const adresyInsertSpy = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));

  // B2C-LEAD-ATOMIC: jeżeli implementacja sięgnie po drugi zapis (update) na adresy
  // zamiast wpisać współrzędne w ten sam insert, ten spy rzuca — test i tak by już
  // padł na asercjach latitude/longitude, ale to czyni przyczynę jednoznaczną.
  const adresyUpdateSpy = vi.fn(() => {
    throw new Error(
      'B2C-LEAD-ATOMIC: adresy nie powinno mieć drugiego zapisu (update) po insercie — ' +
        'współrzędne muszą wejść w ten sam insert co klient_id/ulica_miasto.',
    );
  });

  // Kształt bez zmian (insert na `leady` już dziś nie ma `.select()`) — jedyna zmiana to
  // jawny typ parametru, potrzebny, żeby nowe asercje (na końcu pliku) mogły bezpiecznie
  // odczytać `adres_id`/`klient_id` z przekazanego wiersza.
  const leadyInsertSpy = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));

  // Addendum 2026-09-14 (B2C-BOOKING-SLOT, patrz komentarz na górze pliku): update na
  // `leady` po sukcesie rezerwacji — kształt 1:1 z `saveLead.booking.test.ts`.
  const leadyUpdateEqSpy = vi.fn(async (_col: string, _val: unknown) => ({ error: null }));
  const leadyUpdateSpy = vi.fn((_row: Record<string, unknown>) => ({ eq: leadyUpdateEqSpy }));

  const calendarSpy = vi.fn(async () => ({ success: true, eventLink: 'stub' }));

  // Addendum 2026-09-14 (B2C-BOOKING-SLOT) — rezerwacja zamockowana na sukces domyślnie,
  // żeby ścieżka geokodowania (jedyny cel tego pliku) mogła dotrzeć do `result.success`.
  const createBookingSpy = vi.fn(async (_params: Record<string, unknown>) => ({
    ok: true,
    booking: {
      id: 'booking-default',
      scheduledStart: new Date('2026-11-16T07:00:00.000Z'),
      scheduledEnd: new Date('2026-11-16T09:00:00.000Z'),
    },
    error: null,
  }));

  // Higiena testów (WO ad-hoc, patrz podsumowanie tury): `saveLead.ts` woła
  // `prisma.visitDurationBasket.findFirst(...)` (`@repo/database`, PRZED `createBooking`)
  // żeby rozwiązać koszyk AUDIT. Bez tego mocka test cicho łączył się z prawdziwą bazą
  // przez `.env` lokalnie (przechodził przypadkiem), a w CI (DATABASE_URL placeholder)
  // padał na `PrismaClientInitializationError` przechwyconym przez generyczny `catch`.
  // Domyślnie zwraca realistyczny wiersz koszyka AUDIT — ten plik nie testuje ścieżki
  // BASKET_NOT_FOUND, więc `auditBasket` musi być zawsze prawdziwe (`!auditBasket` w
  // saveLead.ts) i mieć `id`, którego `saveLead.ts` czyta wprost (`auditBasket.id`).
  const visitDurationBasketFindFirstMock = vi.fn(async (_args: Record<string, unknown>) => ({
    id: 'basket-audit-id',
    code: 'AUDIT',
    isActive: true,
    durationMinutes: 120,
    pool: 'AUDITOR',
  }));

  const fromSpy = vi.fn((table: string) => {
    switch (table) {
      case 'klienci':
        return { insert: klienciInsertSpy };
      case 'adresy':
        return { insert: adresyInsertSpy, update: adresyUpdateSpy };
      case 'leady':
        return { insert: leadyInsertSpy, update: leadyUpdateSpy };
      default:
        throw new Error(
          `saveLead.test: nieoczekiwana tabela "${table}" — dopisz obsługę w mocku zanim rozszerzysz test.`,
        );
    }
  });

  return {
    fromSpy,
    klienciInsertSpy,
    adresyInsertSpy,
    adresyUpdateSpy,
    leadyInsertSpy,
    leadyUpdateSpy,
    leadyUpdateEqSpy,
    calendarSpy,
    createBookingSpy,
    visitDurationBasketFindFirstMock,
  };
});

vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: fromSpy } }));
vi.mock('../../app/actions/calendar', () => ({ createCalendarEvent: calendarSpy }));
vi.mock('@repo/scheduling', () => ({ createBooking: createBookingSpy }));
vi.mock('@repo/database', () => ({
  prisma: {
    visitDurationBasket: { findFirst: visitDurationBasketFindFirstMock },
  },
}));

const { saveLead } = await import('../../app/actions/saveLead');

// Addendum 2026-09-14 (B2C-BOOKING-SLOT) — `startAtIso` zamiast `bookingDate`/`bookingSlot`
// (kontrakt wejścia `SaveLeadData` po przepisaniu); wartość bez znaczenia dla tego pliku
// (geokodowanie), musi być tylko parsowalna przez `new Date(...)`.
const basePayload = () => ({
  name: 'Jan Kowalski',
  email: 'jan.kowalski@example.com',
  phone: '500600700',
  address: 'Marszałkowska 1, Warszawa',
  startAtIso: '2026-11-16T08:00:00.000+01:00',
  triageData: {},
});

// Kształt UUID v4 (i wariantów RFC 4122 ogólnie — nie wymuszamy wersji/wariantu w bitach
// kontrolnych, wystarczy odróżnić od pustego stringa/placeholdera) zwracanego przez
// `crypto.randomUUID()`.
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('saveLead — persystencja współrzędnych adresu (WO B2C-LEAD-GEO-PERSIST)', () => {
  beforeEach(() => {
    fromSpy.mockClear();
    klienciInsertSpy.mockClear();
    adresyInsertSpy.mockClear();
    adresyUpdateSpy.mockClear();
    leadyInsertSpy.mockClear();
    leadyUpdateSpy.mockClear();
    leadyUpdateEqSpy.mockClear();
    calendarSpy.mockClear();
    createBookingSpy.mockClear();
    visitDurationBasketFindFirstMock.mockClear();
  });

  // @REQ: FLD-GEO-COORDS
  it('AC1/AC2/AC5 — adres geokodowany: latitude i longitude z dokładnością bez zaokrąglenia trafiają do TEGO SAMEGO insertu na adresy', async () => {
    const lat = 52.2296756; // 7 miejsc po przecinku — WO R4: Google Places zwraca 7-8
    const lng = 21.0122287;

    const result = await saveLead({ ...basePayload(), lat, lng });

    expect(result.success).toBe(true);

    // AC5 / B2C-LEAD-ATOMIC — dokładnie jeden insert na adresy, żadnego drugiego kroku.
    // Sekwencja tabel ma dziś (po B2C-BOOKING-SLOT) DODATKOWE wywołanie `leady` na końcu
    // — to UPDATE ustawiający `data_rezerwacji` po sukcesie rezerwacji (zamockowanej
    // wyżej na `ok: true`), nie drugi insert na adresy. Sedno tej asercji — brak
    // dodatkowego kroku na `adresy` — jest bez zmian, weryfikowane precyzyjniej niżej
    // (`adresyInsertSpy` razy 1, `adresyUpdateSpy` brak wywołania).
    expect(fromSpy.mock.calls.map(([table]) => table)).toEqual(['klienci', 'adresy', 'leady', 'leady']);
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

    // Guard (SEC-RLS-BASELINE): bez tej asercji, jeśli implementacja jeszcze woła
    // `.select()` na mocku bez tej metody i cała operacja pada wcześniej, indeksowanie
    // `mock.calls[0][0]` niżej rzuca surowy `TypeError` zamiast czytelnej asercji —
    // ten guard zamienia to na jednoznaczny, czytelny fail.
    expect(adresyInsertSpy).toHaveBeenCalledTimes(1);

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

    // Guard (SEC-RLS-BASELINE) — patrz uzasadnienie w teście AC4 powyżej.
    expect(adresyInsertSpy).toHaveBeenCalledTimes(1);

    const insertArg = adresyInsertSpy.mock.calls[0][0];

    expect(typeof insertArg.latitude).toBe('number');
    expect(insertArg.latitude).toBe(52.2296756);
    expect(typeof insertArg.longitude).toBe('number');
    expect(insertArg.longitude).toBe(21.0122287);
  });

  // Poniższe dwa testy NIE mają `@REQ:` — nie są częścią żadnego Work Orderu (patrz
  // addendum na górze pliku: to następstwo naprawy `SEC-RLS-BASELINE`, zgłoszone wprost
  // jako zadanie poza WO). Umieszczone jako osobne `it()`, nie dopisane do AC1: AC1
  // dowodzi geokodowania (latitude/longitude — logika, która się NIE zmienia), a te dwa
  // testy dowodzą czegoś innego — że `id` powiązań między `klienci`/`adresy`/`leady` jest
  // generowane W KODZIE i świadomie przekazywane dalej, a nie odczytywane z odpowiedzi
  // insertu (`.select().single()`), której po naprawie RLS już nie ma. Osobne `it()`
  // dają też niezależne, czytelne komunikaty błędu dla dwóch różnych twierdzeń (kształt
  // UUID kontra spójność powiązań), zamiast maskowania drugiego przez pierwsze w jednym
  // teście.

  it('id przekazane jako klient_id do insertu na adresy jest DOKŁADNIE tym samym id, które trafiło do insertu na klienci — a leady.klient_id/adres_id zgadzają się analogicznie z klienci/adresy (nie coś odczytane z odpowiedzi insertu)', async () => {
    await saveLead({ ...basePayload(), lat: 52.2296756, lng: 21.0122287 });

    expect(klienciInsertSpy).toHaveBeenCalledTimes(1);
    const klientRow = klienciInsertSpy.mock.calls[0][0];

    expect(adresyInsertSpy).toHaveBeenCalledTimes(1);
    const adresRow = adresyInsertSpy.mock.calls[0][0];

    // Sedno tej zmiany: adresy.klient_id to TO SAMO id co w insercie klienci —
    // implementacja musi przekazać wygenerowane id dalej samodzielnie, bo po naprawie
    // RLS nic go już nie odczyta zwrotnie z odpowiedzi bazy (insert nie ma `.select()`).
    expect(adresRow.klient_id).toBe(klientRow.id);

    expect(leadyInsertSpy).toHaveBeenCalledTimes(1);
    const leadRow = leadyInsertSpy.mock.calls[0][0];

    expect(leadRow.klient_id).toBe(klientRow.id);
    expect(leadRow.adres_id).toBe(adresRow.id);
  });

  it('id przekazane do insertu klienci/adresy wygląda jak UUID (dowód, że to crypto.randomUUID(), nie pusty string ani inny placeholder)', async () => {
    await saveLead({ ...basePayload(), lat: 52.2296756, lng: 21.0122287 });

    expect(klienciInsertSpy).toHaveBeenCalledTimes(1);
    const klientRow = klienciInsertSpy.mock.calls[0][0];
    // `typeof` osobno od `toMatch()`: `toMatch()` sam waliduje typ argumentu i rzuca
    // `TypeError` zamiast `AssertionError`, gdy dostanie `undefined` — ten guard daje
    // czytelną, jednoznaczną asercję zamiast błędu wewnętrznego matchera.
    expect(typeof klientRow.id).toBe('string');
    expect(klientRow.id).toMatch(UUID_SHAPE);

    expect(adresyInsertSpy).toHaveBeenCalledTimes(1);
    const adresRow = adresyInsertSpy.mock.calls[0][0];
    expect(typeof adresRow.id).toBe('string');
    expect(adresRow.id).toMatch(UUID_SHAPE);
  });
});
