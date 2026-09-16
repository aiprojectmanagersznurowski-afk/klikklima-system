import { describe, it, expect } from 'vitest';

/**
 * WO: docs/workorders/FLD-QUOTE-BASKET-SELECT.md — ROZSTRZYGNIĘTY 2026-09-16
 * (D-1 = (A): ekran w panelu B2B dla dyspozytora/admina; D-2 = (a): RBAC bez zmian).
 * Wymaganie: `FLD-QUOTE-BASKET-SELECT` (contracts/requirements.contract.mjs, status TODO, 4 AC).
 *
 * OGRANICZENIE INFRASTRUKTURALNE (dziedziczone z `customers-anonymize-ui.test.ts` /
 * `role-change-dialog-ui.test.ts` / memoria "React UI test infra limits"): root
 * `vitest.config.mts` ma `include: ['**\/*.test.ts']` (bez `.tsx`), brak środowiska jsdom,
 * brak aliasu `@/*`. Pełny render Testing Library `create-booking-dialog.tsx`
 * ("use client", hooki `useState`/`useForm`/`useTransition`) nie jest tu wykonalny — wywołanie
 * komponentu klienckiego jako gołej funkcji poza reconcilerem Reacta rzuca "Invalid hook call",
 * inaczej niż w `lead-detail-page-pool-spread.test.ts` (Server Component, funkcja async bez
 * hooków, wywołana bezpośrednio).
 *
 * Wzorzec zastosowany tutaj (identyczny co `customers-anonymize-ui.test.ts`,
 * "KONTRAKT Z IMPLEMENTER-UI"): wydzielenie CZYSTEJ logiki domenowej — bez importów UI, bez
 * "use client"/"use server" — do nowego pliku, żeby dało się ją dowieść realnym, wykonywalnym
 * testem, niezależnie od infrastruktury renderowania. WO sam rekomenduje wyniesienie
 * `CalendarSettingsBasket`/`POOL_LABELS` do `apps/b2b-web/src/lib/schedule/` (sekcja "Kształt
 * zmiany") — ten plik idzie o krok dalej i definiuje tam też filtrowanie/budowę payloadu,
 * żeby dało się to przetestować bez atrapy Reacta.
 *
 * KONTRAKT Z IMPLEMENTER-UI — nowy plik `apps/b2b-web/src/lib/schedule/basket-select.ts`
 * (bez importów `react`/`@/components/*`, bez "use client"/"use server"), eksporty:
 *
 *   export type ScheduleBasket = {
 *     id: string
 *     code: string
 *     labelPl: string
 *     pool: string
 *     durationMinutes: number
 *     isActive: boolean
 *     sortOrder: number
 *   }
 *
 *   export const POOL_LABELS: Record<string, string> // przeniesione 1:1 z
 *     CalendarSettingsClient.tsx ({ AUDITOR: "Audytor", CREW: "Ekipa" })
 *
 *   export type CreateBookingSubject =
 *     | { kind: "LEAD"; leadId: string }
 *     | { kind: "SERVICE"; serviceId: string }
 *     | { kind: "INCIDENT"; incidentId: string }
 *
 *   // AC2 + AC7: koszyki DO WYBORU na ekranie tworzenia rezerwacji — wyłącznie aktywne,
 *   // wyłącznie z żądanej puli, w kolejności sortOrder. `settings/calendar` (konfiguracja)
 *   // pokazuje WSZYSTKIE koszyki (aktywne i wycofane) — to inna funkcja, nie ta.
 *   export function selectableBaskets(baskets: ScheduleBasket[], pool: string): ScheduleBasket[]
 *
 *   // AC3: widok szczegółu rezerwacji historycznej musi znaleźć koszyk PO ID niezależnie od
 *   // isActive (WO dosłownie: "Widok szczegółu czyta koszyk po visit_basket_id, nie z listy
 *   // aktywnych"). Zwraca undefined, jeśli nic nie odpowiada (BASKET_NOT_FOUND -- poza
 *   // zakresem tej funkcji, obsługiwane już w create-booking.ts).
 *   export function findBasketById(baskets: ScheduleBasket[], id: string): ScheduleBasket | undefined
 *
 *   // AC1 + AC4 + przypadek brzegowy 6 (strefa czasowa) + przypadek brzegowy 9 (przemycone
 *   // pola): jedyny legalny sposób budowy payloadu wysyłanego do createBookingAction. Zwraca
 *   // obiekt z DOKŁADNIE czterema kluczami, niezależnie od tego, co ktoś przekaże w przyszłości
 *   // do tej funkcji — to jest zabezpieczenie przed refaktorem na spread. `startAt` przechodzi
 *   // przez identity (żaden `scheduledEnd` nie jest liczony po stronie klienta).
 *   export function buildCreateBookingPayload(input: {
 *     visitBasketId: string
 *     startAt: Date
 *     subject: CreateBookingSubject
 *     bookedBy: "DISPATCHER"
 *   }): { visitBasketId: string; startAt: Date; subject: CreateBookingSubject; bookedBy: "DISPATCHER" }
 *
 * Stan zmierzony 2026-09-16: `grep -rn "basket-select" apps/b2b-web/src/lib/schedule/` — zero
 * wyników. Import poniżej ma się wywalić brakiem modułu — to jest oczekiwany, poprawny RED tej
 * tury (WO, "Weryfikacja"), nie usterka testu.
 */

const { selectableBaskets, findBasketById, buildCreateBookingPayload, POOL_LABELS } = await import(
  '../src/lib/schedule/basket-select'
);

type ScheduleBasket = {
  id: string;
  code: string;
  labelPl: string;
  pool: string;
  durationMinutes: number;
  isActive: boolean;
  sortOrder: number;
};

/** Komplet 7 koszyków — dosłowny seed migracji `20260910100000_fld_calendar_foundation.sql`. */
const SEVEN_BASKETS: ScheduleBasket[] = [
  { id: 'b-audit', code: 'AUDIT', labelPl: 'Audyt', pool: 'AUDITOR', durationMinutes: 120, isActive: true, sortOrder: 10 },
  { id: 'b-service', code: 'SERVICE', labelPl: 'Serwis (przegląd okresowy)', pool: 'CREW', durationMinutes: 90, isActive: true, sortOrder: 20 },
  { id: 'b-incident', code: 'INCIDENT', labelPl: 'Usterka (naprawa)', pool: 'CREW', durationMinutes: 120, isActive: true, sortOrder: 30 },
  { id: 'b-install-small', code: 'INSTALL_SMALL', labelPl: 'Montaż mały', pool: 'CREW', durationMinutes: 240, isActive: true, sortOrder: 40 },
  { id: 'b-install-standard', code: 'INSTALL_STANDARD', labelPl: 'Montaż standardowy', pool: 'CREW', durationMinutes: 480, isActive: true, sortOrder: 50 },
  { id: 'b-phase-1', code: 'INSTALL_PHASE_1', labelPl: 'Montaż — faza 1', pool: 'CREW', durationMinutes: 480, isActive: true, sortOrder: 60 },
  { id: 'b-phase-2', code: 'INSTALL_PHASE_2', labelPl: 'Montaż — faza 2', pool: 'CREW', durationMinutes: 240, isActive: true, sortOrder: 70 },
];

describe('selectableBaskets — AC2 (koszyk wycofany nie pojawia się na liście)', () => {
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('koszyk isActive=false jest wykluczony, zbiór pozostałych pozycji niezmieniony', () => {
    const withdrawn = SEVEN_BASKETS.map((b) => (b.id === 'b-audit' ? { ...b, isActive: false } : b));
    const result = selectableBaskets(withdrawn, 'AUDITOR');
    expect(result.map((b: ScheduleBasket) => b.id)).toEqual([]);

    const crewResult = selectableBaskets(withdrawn, 'CREW');
    expect(crewResult.map((b: ScheduleBasket) => b.id)).toEqual(
      SEVEN_BASKETS.filter((b) => b.pool === 'CREW').map((b) => b.id),
    );
  });

  // Przypadek pusty (WO, przypadek brzegowy 3): pula CAŁKOWICIE wycofana — formularz nie ma
  // z czego wybrać, funkcja zwraca tablicę pustą, nie wartość domyślną/undefined.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('przypadek pusty — cała pula AUDITOR wycofana daje tablicę pustą, nie wartość domyślną', () => {
    const allWithdrawn = SEVEN_BASKETS.map((b) => (b.pool === 'AUDITOR' ? { ...b, isActive: false } : b));
    const result = selectableBaskets(allWithdrawn, 'AUDITOR');
    expect(result).toEqual([]);
  });
});

describe('selectableBaskets — AC7 (pula wyłącznie AUDITOR albo wyłącznie CREW, na komplecie 7 koszyków)', () => {
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('kontekst audytora: WYŁĄCZNIE pool=AUDITOR (dokładnie koszyk AUDIT)', () => {
    const result = selectableBaskets(SEVEN_BASKETS, 'AUDITOR');
    expect(result.map((b: ScheduleBasket) => b.code)).toEqual(['AUDIT']);
    expect(result.every((b: ScheduleBasket) => b.pool === 'AUDITOR')).toBe(true);
  });

  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('kontekst ekipy: WYŁĄCZNIE pool=CREW (sześć koszyków, żaden AUDITOR)', () => {
    const result = selectableBaskets(SEVEN_BASKETS, 'CREW');
    expect(result).toHaveLength(6);
    expect(result.some((b: ScheduleBasket) => b.pool === 'AUDITOR')).toBe(false);
    expect(result.map((b: ScheduleBasket) => b.code).sort()).toEqual(
      ['INCIDENT', 'INSTALL_PHASE_1', 'INSTALL_PHASE_2', 'INSTALL_SMALL', 'INSTALL_STANDARD', 'SERVICE'].sort(),
    );
  });

  // Przypadek maksymalny: komplet 7 koszyków naraz, zero przecieku między pulami w obu wywołaniach.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('przypadek maksymalny — obie pule wywołane na tym samym komplecie 7 koszyków się nie przecinają', () => {
    const auditor = selectableBaskets(SEVEN_BASKETS, 'AUDITOR');
    const crew = selectableBaskets(SEVEN_BASKETS, 'CREW');
    const overlap = auditor.filter((a: ScheduleBasket) => crew.some((c: ScheduleBasket) => c.id === a.id));
    expect(overlap).toEqual([]);
    expect(auditor.length + crew.length).toBe(SEVEN_BASKETS.length);
  });
});

describe('selectableBaskets — AC5/AC6 (wartości ze słownika w chwili renderowania, nie literały)', () => {
  // Wartość arbitralna (137), nie 120/240/480 — żeby literał zaszyty w implementacji nie mógł
  // przypadkiem przejść testu (WO, AC5 dosłownie).
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('durationMinutes=137 (wartość arbitralna) przechodzi bez zniekształcenia', () => {
    const arbitraryBaskets: ScheduleBasket[] = [
      { id: 'b-x', code: 'AUDIT', labelPl: 'Etykieta arbitralna XYZ', pool: 'AUDITOR', durationMinutes: 137, isActive: true, sortOrder: 1 },
    ];
    const [result] = selectableBaskets(arbitraryBaskets, 'AUDITOR');
    expect(result.durationMinutes).toBe(137);
    expect(result.labelPl).toBe('Etykieta arbitralna XYZ');
  });

  // Kontrola pozytywna na POOL_LABELS wyniesionym z CalendarSettingsClient.tsx — musi istnieć
  // jedna definicja współdzielona, nie duplikat.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('POOL_LABELS zawiera dokładnie mapowanie AUDITOR/CREW znane z CalendarSettingsClient.tsx', () => {
    expect(POOL_LABELS).toEqual({ AUDITOR: 'Audytor', CREW: 'Ekipa' });
  });
});

describe('findBasketById — AC3 (widok szczegółu czyta po ID, nie z listy aktywnych)', () => {
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('koszyk WYCOFANY (isActive=false) jest dalej znajdowany po id, etykieta nie jest "—"/id/pustka', () => {
    const withdrawnBasket: ScheduleBasket = {
      id: 'b-withdrawn',
      code: 'INSTALL_SMALL',
      labelPl: 'Montaż mały',
      pool: 'CREW',
      durationMinutes: 240,
      isActive: false,
      sortOrder: 40,
    };
    const found = findBasketById([withdrawnBasket], 'b-withdrawn');
    expect(found).toBeDefined();
    expect(found!.labelPl).toBe('Montaż mały');
    expect(found!.labelPl).not.toBe('—');
    expect(found!.labelPl).not.toBe('b-withdrawn');
    expect(found!.labelPl.trim()).not.toBe('');
  });

  // Kontrola negatywna: `selectableBaskets` na tej SAMEJ tablicy nie zwraca tego koszyka —
  // dowodzi, że AC3 i AC2 czytają dwa różne zbiory, nie ten sam po prostu ponownie użyty.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('kontrola negatywna — ten sam koszyk wycofany NIE występuje w selectableBaskets tej puli', () => {
    const withdrawnBasket: ScheduleBasket = {
      id: 'b-withdrawn',
      code: 'INSTALL_SMALL',
      labelPl: 'Montaż mały',
      pool: 'CREW',
      durationMinutes: 240,
      isActive: false,
      sortOrder: 40,
    };
    expect(selectableBaskets([withdrawnBasket], 'CREW')).toEqual([]);
    expect(findBasketById([withdrawnBasket], 'b-withdrawn')).toBeDefined();
  });

  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('koszyk nieistniejący (id skasowany/nigdy nieutworzony) daje undefined, nie wyjątek', () => {
    expect(findBasketById(SEVEN_BASKETS, 'nie-istnieje')).toBeUndefined();
  });
});

describe('buildCreateBookingPayload — AC1/AC4 (identyfikator wiersza, brak czasu trwania w payloadzie)', () => {
  const BASE_INPUT = {
    visitBasketId: 'b-audit',
    startAt: new Date('2026-09-14T08:00:00Z'),
    subject: { kind: 'LEAD' as const, leadId: 'lead-1' },
    bookedBy: 'DISPATCHER' as const,
  };

  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('payload ma DOKŁADNIE zbiór kluczy {visitBasketId, startAt, subject, bookedBy}', () => {
    const payload = buildCreateBookingPayload(BASE_INPUT);
    expect(new Set(Object.keys(payload))).toEqual(
      new Set(['visitBasketId', 'startAt', 'subject', 'bookedBy']),
    );
  });

  // AC4 dosłownie: brak `code`, `labelPl` i "żadnego klucza o wartości równej liczbie minut
  // wybranego koszyka" — sprawdzamy dla koszyka o durationMinutes=137 (arbitralne), żeby
  // literał 120 nie mógł przypadkiem "zgadnąć się" z jakąś domyślną wartością w payloadzie.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('visitBasketId jest UUID wiersza, nie code/labelPl/liczba minut', () => {
    const payload = buildCreateBookingPayload(BASE_INPUT);
    expect(payload.visitBasketId).toBe('b-audit');
    const arbitraryMinutes = 137;
    const values = Object.values(payload);
    expect(values).not.toContain(arbitraryMinutes);
    expect(values).not.toContain('AUDIT');
    expect(values).not.toContain('Audyt');
  });

  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('startAt przechodzi przez identity — funkcja nie wylicza scheduledEnd po stronie klienta', () => {
    const payload = buildCreateBookingPayload(BASE_INPUT);
    expect(payload.startAt).toBe(BASE_INPUT.startAt);
    expect('scheduledEnd' in payload).toBe(false);
    expect('durationMinutes' in payload).toBe(false);
  });

  // Przypadek brzegowy 6 (WO): strefa czasowa. Moment na granicy zmiany czasu (2026-03-29
  // 00:30 lokalnego, Europe/Warsaw) przechodzi bez przesunięcia — to jest identity, nie
  // przeliczenie, więc DST nie ma tu żadnego wpływu z definicji; test dokumentuje to explicite.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('przypadek brzegowy 6 — moment w dobie zmiany czasu (2026-03-29) nie jest przesuwany', () => {
    const dstMoment = new Date('2026-03-28T23:30:00.000Z'); // 2026-03-29 00:30 CET
    const payload = buildCreateBookingPayload({ ...BASE_INPUT, startAt: dstMoment });
    expect(payload.startAt.getTime()).toBe(dstMoment.getTime());
  });

  // Przypadek brzegowy 9 (WO): przemycone pola. TypeScript odrzuciłby te pola statycznie na
  // etapie kompilacji komponentu — ten test symuluje "przemycenie" w runtime (obiekt zbudowany
  // bez udziału typu wejściowego funkcji, np. `JSON.parse` czyjegoś żądania) i dowodzi, że
  // `buildCreateBookingPayload` KONSTRUUJE zwracany obiekt jawnie, nie kopiuje go przez spread,
  // więc dodatkowe pola nie mają szansy przeciekać niezależnie od tego, skąd wejście pochodzi.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('przypadek brzegowy 9 — pola durationMinutes/scheduledEnd/resourceId/pool przemycone w wejściu nie przeciekają do payloadu', () => {
    const smuggledInput: typeof BASE_INPUT = JSON.parse(
      JSON.stringify({
        visitBasketId: BASE_INPUT.visitBasketId,
        startAt: BASE_INPUT.startAt.toISOString(),
        subject: BASE_INPUT.subject,
        bookedBy: BASE_INPUT.bookedBy,
        durationMinutes: 999,
        scheduledEnd: '2099-01-01T00:00:00Z',
        resourceId: 'aud-1',
        pool: 'CREW',
      }),
    );
    smuggledInput.startAt = new Date(smuggledInput.startAt as unknown as string);

    const payload = buildCreateBookingPayload(smuggledInput);

    expect(payload).not.toHaveProperty('durationMinutes');
    expect(payload).not.toHaveProperty('scheduledEnd');
    expect(payload).not.toHaveProperty('resourceId');
    expect(payload).not.toHaveProperty('pool');
    expect(new Set(Object.keys(payload))).toEqual(
      new Set(['visitBasketId', 'startAt', 'subject', 'bookedBy']),
    );
  });

  // Kontrola pozytywna: subject SERVICE/INCIDENT przechodzą tak samo jak LEAD, bez specjalnego
  // traktowania w tej funkcji (pula wynika z koszyka po stronie serwera, nie z subject tutaj).
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it.each([
    { kind: 'SERVICE' as const, serviceId: 'service-1' },
    { kind: 'INCIDENT' as const, incidentId: 'incident-1' },
  ])('subject %o przechodzi bez zmiany kształtu', (subject) => {
    const payload = buildCreateBookingPayload({ ...BASE_INPUT, subject });
    expect(payload.subject).toEqual(subject);
  });
});
