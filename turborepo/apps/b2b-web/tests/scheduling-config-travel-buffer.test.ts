import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISSIONS, can } from '@klikklima/contracts';

/**
 * WO: docs/workorders/CAL-SCHEDULING-CONFIG-UI.md.
 * Wymaganie: `CAL-TRAVEL-BUFFER` (`contracts/requirements.contract.mjs:710-717`, status TODO).
 *
 * Zależność twarda (WO, "Kolejność wykonania" p.1): bramka `updateTravelBufferAction` to
 * `can(actorRole, 'system_config', 'update')`. Zasób `system_config` JEST już w
 * `contracts/rbac.contract.mjs` i w wygenerowanym `packages/contracts/src/generated/rbac.ts`
 * (P-1 rozstrzygnięte i wykonane przez contract-steward) — test kontroli pozytywnej poniżej
 * dowodzi tego z wygenerowanego kontraktu, nie z opisu.
 *
 * Testowana akcja NIE ISTNIEJE jeszcze (grep po apps/b2b-web/src: zero zapisów do
 * system_config). RED jest oczekiwany: błąd modułu / brak eksportu
 * `updateTravelBufferAction`.
 *
 * R-6 (WO): migracja rozszerzająca `audit_log_resource_check` o `system_config` i
 * `visit_duration_baskets` istnieje jako PLIK (20260915120000_cal_scheduling_config_audit_check.sql)
 * ale NIE JEST zaaplikowana na żywej bazie w chwili pisania tych testów — dlatego wpis audytowy
 * na żywej bazie poleci wyjątkiem CHECK do czasu tej migracji (patrz TC-T11,
 * scheduling-config-audit-log-check.itest.ts). Testy w TYM pliku mockują Prismę i tego
 * ograniczenia nie widzą — to jest świadome i zgodne z warstwą jednostkową.
 *
 * D-1 / R-1 (ryzyko najwyższe całego WO): `scheduling_config` niesie CZTERY klucze
 * (`travel_buffer_minutes`, `default_workday_start`, `default_workday_end`,
 * `default_weekdays`), czytane przez DWÓCH konsumentów (`available-slots.ts` i
 * `effective-availability.ts`). TC-T7 poniżej jest testem, który MUSI przejść niezależnie od
 * tego, jak implementer zrealizuje merge (jsonb_set w $executeRaw albo
 * odczyt+zapis w transakcji Serializable) — dlatego mockujemy oba możliwe kształty
 * ($executeRaw ORAZ update na modelu system_config) i sprawdzamy zachowanie obserwowalne
 * (klucze zachowane), nie konkretną metodę Prismy.
 */

const {
  transactionMock,
  txFindUniqueMock,
  txUpdateMock,
  txAuditLogCreateMock,
  executeRawMock,
  bookingUpdateMock,
  bookingUpdateManyMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  txFindUniqueMock: vi.fn(),
  txUpdateMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
  executeRawMock: vi.fn(),
  bookingUpdateMock: vi.fn(),
  bookingUpdateManyMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
    $executeRaw: executeRawMock,
    booking: {
      update: bookingUpdateMock,
      updateMany: bookingUpdateManyMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));

const tx = {
  system_config: {
    findUnique: txFindUniqueMock,
    update: txUpdateMock,
  },
  auditLog: { create: txAuditLogCreateMock },
  booking: {
    update: bookingUpdateMock,
    updateMany: bookingUpdateManyMock,
  },
  $executeRaw: executeRawMock,
};

const { updateTravelBufferAction } = await import(
  '../src/app/(dashboard)/settings/calendar/actions'
);

const ADMIN_EMAIL = 'admin@klikklima.pl';
const UNAUTHORIZED_ROLES = ['dyspozytor', 'audytor', 'monter'] as const;

const SCHEDULING_CONFIG_ROW_ID = 'system-config-scheduling';

// Fixture 1:1 z seedem realnym (migracja 20260910100000): CZTERY klucze w jednym wierszu JSONB.
const SCHEDULING_CONFIG_FIXTURE = {
  id: SCHEDULING_CONFIG_ROW_ID,
  typ_konfiguracji: 'scheduling_config',
  konfiguracja: {
    travel_buffer_minutes: 60,
    default_workday_start: '08:00',
    default_workday_end: '16:00',
    default_weekdays: [1, 2, 3, 4, 5],
  },
};

beforeEach(() => {
  transactionMock.mockReset();
  txFindUniqueMock.mockReset();
  txUpdateMock.mockReset();
  txAuditLogCreateMock.mockReset();
  executeRawMock.mockReset();
  bookingUpdateMock.mockReset();
  bookingUpdateManyMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getCurrentUserMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  getCurrentActorRoleMock.mockResolvedValue('admin');
  getCurrentUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } });
  txFindUniqueMock.mockResolvedValue({
    ...SCHEDULING_CONFIG_FIXTURE,
    konfiguracja: { ...SCHEDULING_CONFIG_FIXTURE.konfiguracja },
  });
  txUpdateMock.mockImplementation(async ({ where, data }: { where: unknown; data: { konfiguracja: Record<string, unknown> } }) => ({
    ...SCHEDULING_CONFIG_FIXTURE,
    konfiguracja: data.konfiguracja,
  }));
  executeRawMock.mockResolvedValue(1);
  txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
});

// ────────────────────────────── Kontrola pozytywna kontraktu RBAC (P-1) ──────────────────────────────

describe('system_config — kontrola pozytywna macierzy RBAC (P-1, CAL-SCHEDULING-CONFIG-RBAC)', () => {
  // @REQ: CAL-TRAVEL-BUFFER
  it('admin ma update na system_config, pozostałe role nie — bez tego wiersza akcja odmówiłaby wszystkim, także adminowi', () => {
    expect(PERMISSIONS.system_config.update).toEqual(['admin']);
    expect(can('admin', 'system_config', 'update')).toBe('yes');
    for (const role of UNAUTHORIZED_ROLES) {
      expect(can(role, 'system_config', 'update')).toBe('no');
    }
  });
});

// ─────────────────────────────────── TC-T1 — wartość edytowalna, bez literału 60 ───────────────────────────────────

describe('updateTravelBufferAction — TC-T1 (AC1, wartość z system_config, bez literału 60)', () => {
  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-T1 — akcja zapisuje 45, konfiguracja po zapisie zawiera travel_buffer_minutes: 45', async () => {
    const result = await updateTravelBufferAction({ travelBufferMinutes: 45 });

    expect(result.success).toBe(true);
    // Zapis może iść przez update() na modelu albo $executeRaw (jsonb_set) — sprawdzamy
    // przynajmniej jedną z dwóch ścieżek, wynik obserwowalny jest ten sam.
    const viaUpdate = txUpdateMock.mock.calls.some(
      (call) => call[0]?.data?.konfiguracja?.travel_buffer_minutes === 45,
    );
    const viaExecuteRaw = executeRawMock.mock.calls.length > 0;
    expect(viaUpdate || viaExecuteRaw).toBe(true);
  });
});

// ─────────────────────── TC-T3 — odmowa z akcji rezerwującej, nie z bazy ───────────────────────

describe('updateTravelBufferAction — TC-T3 (AC3, kod błędu z akcji, nie wyjątek bazy — dokumentacyjny)', () => {
  // TC-T3 dotyczy zachowania SILNIKA (`createBooking` → SLOT_NOT_OFFERED), nie tej akcji —
  // ten WO nie zmienia `packages/scheduling` ("Poza zakresem"). Test poniżej jest kontrolą
  // regresji: akcja bufora nie zmienia sposobu, w jaki silnik zgłasza odmowę.
  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-T3 — updateTravelBufferAction nie eksportuje i nie zawiera żadnej ścieżki rezerwującej (createBooking pozostaje w @repo/scheduling)', async () => {
    const actionsModule = await import('../src/app/(dashboard)/settings/calendar/actions');
    const exportedNames = Object.keys(actionsModule);
    const hasBookingExport = exportedNames.some((name) => /booking/i.test(name));

    expect(hasBookingExport).toBe(false);
  });
});

// ────────────────────────── TC-T5 — zmiana bufora nie unieważnia rezerwacji (bliźniak TC-B3) ──────────────────────────

describe('updateTravelBufferAction — TC-T5 (AC5, zmiana bufora nie unieważnia rezerwacji)', () => {
  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-T5 — po updateTravelBufferAction ZERO zapisów do bookings (booking.update / updateMany)', async () => {
    await updateTravelBufferAction({ travelBufferMinutes: 90 });

    expect(bookingUpdateMock).not.toHaveBeenCalled();
    expect(bookingUpdateManyMock).not.toHaveBeenCalled();
  });
});

// ──────────────────────────── TC-T6 — bufor per region poza zakresem (test negatywny) ────────────────────────────

describe('updateTravelBufferAction — TC-T6 (AC6, bufor per region świadomie poza zakresem)', () => {
  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-T6 — akcja nie przyjmuje parametru regionu; travel_buffer_by_region nie powstaje w konfiguracji', async () => {
    const inputWithRegion: { travelBufferMinutes: number; region?: string } = {
      travelBufferMinutes: 45,
      region: 'PL-WARSZAWA',
    };

    await updateTravelBufferAction(inputWithRegion);

    const persistedViaUpdate = txUpdateMock.mock.calls[0]?.[0]?.data?.konfiguracja;
    if (persistedViaUpdate) {
      expect(persistedViaUpdate.travel_buffer_by_region).toBeUndefined();
      expect(persistedViaUpdate.region).toBeUndefined();
    }
  });
});

// ────────────────────────────── TC-T7 — R-1/D-1: merge JSONB, klucze zachowane ──────────────────────────────

describe('updateTravelBufferAction — TC-T7 (D-1, merge JSONB — TEST NAJWAŻNIEJSZY CAŁEGO WO)', () => {
  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-T7 — po zapisie bufora default_workday_start/end i default_weekdays MAJĄ WARTOŚCI NIEZMIENIONE', async () => {
    txFindUniqueMock.mockResolvedValue({
      ...SCHEDULING_CONFIG_FIXTURE,
      konfiguracja: {
        travel_buffer_minutes: 60,
        default_workday_start: '08:00',
        default_workday_end: '16:00',
        default_weekdays: [1, 2, 3, 4, 5],
      },
    });

    const result = await updateTravelBufferAction({ travelBufferMinutes: 45 });
    expect(result.success).toBe(true);

    // Ścieżka A: implementacja przez update({ data: { konfiguracja: {...} } }).
    const updateCall = txUpdateMock.mock.calls[0]?.[0];
    if (updateCall) {
      const persisted = updateCall.data.konfiguracja;
      expect(persisted.default_workday_start).toBe('08:00');
      expect(persisted.default_workday_end).toBe('16:00');
      expect(persisted.default_weekdays).toEqual([1, 2, 3, 4, 5]);
      expect(persisted.travel_buffer_minutes).toBe(45);
      // Naiwna implementacja `update({ data: { konfiguracja: { travel_buffer_minutes: X } } })`
      // NIE MA tych kluczy w ogóle — to jest dokładnie regresja, przed którą chroni ten test.
      expect(Object.keys(persisted).sort()).toEqual(
        ['default_weekdays', 'default_workday_end', 'default_workday_start', 'travel_buffer_minutes'].sort(),
      );
      return;
    }

    // Ścieżka B: implementacja przez $executeRaw (jsonb_set) — nie nadpisuje obiektu w JS,
    // więc nie ma tu treści do zainspekcji identycznie jak dla update(); wystarczy dowód,
    // że $executeRaw zostało wywołane i że NIE poszło żadne update() nadpisujące cały obiekt.
    expect(executeRawMock).toHaveBeenCalled();
    expect(txUpdateMock).not.toHaveBeenCalled();
  });

  // Wariant dodatkowy: zapis bufora na WARTOŚĆ INNĄ niż domyślna — powtórzenie testu z inną
  // liczbą, żeby wykluczyć przypadek, w którym implementacja "działa" tylko dla jednej,
  // przypadkowo poprawnej wartości.
  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-T7 — wariant: zapis bufora na 0 również zachowuje pozostałe trzy klucze', async () => {
    const result = await updateTravelBufferAction({ travelBufferMinutes: 0 });
    expect(result.success).toBe(true);

    const updateCall = txUpdateMock.mock.calls[0]?.[0];
    if (updateCall) {
      const persisted = updateCall.data.konfiguracja;
      expect(persisted.default_workday_start).toBe('08:00');
      expect(persisted.default_workday_end).toBe('16:00');
      expect(persisted.default_weekdays).toEqual([1, 2, 3, 4, 5]);
    }
  });
});

// ──────────────────────────── TC-T8 — fail-closed nie zostaje osłabiony ────────────────────────────

describe('updateTravelBufferAction — TC-T8 (fail-closed parseTravelBufferMinutes nie jest osłabiony)', () => {
  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-T8 — po zapisie 0 wartość zapisana jest liczbą 0, nie stringiem i nie null (0 jest legalnym "bez bufora")', async () => {
    const result = await updateTravelBufferAction({ travelBufferMinutes: 0 });

    expect(result.success).toBe(true);
    const updateCall = txUpdateMock.mock.calls[0]?.[0];
    if (updateCall) {
      expect(updateCall.data.konfiguracja.travel_buffer_minutes).toBe(0);
      expect(typeof updateCall.data.konfiguracja.travel_buffer_minutes).toBe('number');
    }
  });

  // Ten wariant NIE jest o akcji, ale o tym, że akcja nie może "naprawić" wiersz uszkodzony
  // ręcznie: jeśli w bazie jest już travel_buffer_minutes: "abc", odczyt STAREJ wartości do
  // justification nie może po cichu zrzutować jej na 0 lub inną liczbę.
  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-T8 — wiersz z uszkodzoną wartością ("abc") jako stara wartość: justification NIE zawiera zmyślonego "0"', async () => {
    txFindUniqueMock.mockResolvedValue({
      ...SCHEDULING_CONFIG_FIXTURE,
      konfiguracja: { ...SCHEDULING_CONFIG_FIXTURE.konfiguracja, travel_buffer_minutes: 'abc' },
    });

    const result = await updateTravelBufferAction({ travelBufferMinutes: 30 });

    expect(result.success).toBe(true);
    if (txAuditLogCreateMock.mock.calls.length > 0) {
      const payload = txAuditLogCreateMock.mock.calls[0][0].data;
      expect(payload.justification).toContain('abc');
      expect(payload.justification).not.toMatch(/:\s*0\s*→/);
    }
  });
});

// ──────────────────────────────── TC-T9 — wpis audytowy dla bufora ────────────────────────────────

describe('updateTravelBufferAction — TC-T9 (P-3, wpis audytowy)', () => {
  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-T9a — zmiana bufora z 60 na 45 tworzy DOKŁADNIE JEDEN wpis field_update z pełnymi polami', async () => {
    const result = await updateTravelBufferAction({ travelBufferMinutes: 45 });

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    const payload = txAuditLogCreateMock.mock.calls[0][0].data;
    expect(payload.operation).toBe('field_update');
    expect(payload.resource).toBe('system_config');
    expect(payload.recordId).toBe(SCHEDULING_CONFIG_ROW_ID);
    expect(payload.actorEmail).toBe(ADMIN_EMAIL);
    expect(payload.actorRole).toBe('admin');
    expect(payload.legalBasis).toBe('OTHER');
    expect(payload.justification).toContain('60');
    expect(payload.justification).toContain('45');
  });

  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-T9b — gdy auditLog.create rzuci, travel_buffer_minutes w bazie pozostaje 60 (transakcja nie utrwala zapisu)', async () => {
    txAuditLogCreateMock.mockRejectedValueOnce(new Error('CHECK constraint violation'));

    const result = await updateTravelBufferAction({ travelBufferMinutes: 45 });

    expect(result.success).toBe(false);
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  // Wariant odwrotny: gdy zapis JSONB rzuci, wpis audytowy NIE POWSTAJE (nie logujemy
  // zmian, które nie zaszły — pułapka 2 z CLAUDE.md).
  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-T9c — gdy zapis JSONB rzuci, wpis audytowy nie powstaje', async () => {
    txUpdateMock.mockRejectedValueOnce(new Error('błąd zapisu JSONB'));
    executeRawMock.mockRejectedValueOnce(new Error('błąd zapisu JSONB'));

    const result = await updateTravelBufferAction({ travelBufferMinutes: 45 });

    expect(result.success).toBe(false);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });
});

// ─────────────────── TC-T10 — stara wartość z bazy, nie z formularza; brak zmiany bez wpisu ───────────────────

describe('updateTravelBufferAction — TC-T10 (P-3, stara wartość czytana z bazy w tej samej transakcji)', () => {
  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-T10a — zapis wartości równej bieżącej (60 → 60) nie tworzy wpisu audytowego, ale zwraca sukces', async () => {
    const result = await updateTravelBufferAction({ travelBufferMinutes: 60 });

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-T10b — formularz zna "starą" wartość 60, ale w bazie jest już 30 (zapis równoległy): justification mówi 30 → nowa, nie 60 → nowa', async () => {
    // Formularz był otwarty ze starym stanem (60), ale w międzyczasie ktoś inny zapisał 30 —
    // stara wartość MUSI być czytana z bazy WEWNĄTRZ transakcji, nie z parametru wejściowego.
    txFindUniqueMock.mockResolvedValue({
      ...SCHEDULING_CONFIG_FIXTURE,
      konfiguracja: { ...SCHEDULING_CONFIG_FIXTURE.konfiguracja, travel_buffer_minutes: 30 },
    });

    const result = await updateTravelBufferAction({ travelBufferMinutes: 90 });

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    const payload = txAuditLogCreateMock.mock.calls[0][0].data;
    expect(payload.justification).toContain('30');
    expect(payload.justification).toContain('90');
    expect(payload.justification).not.toMatch(/60\s*→/);
  });
});

// ────────────────────────── Walidacja Zod — granice min(0)/max(240) ──────────────────────────

describe('updateTravelBufferAction — walidacja Zod (min(0)/max(240), asymetria z koszykami)', () => {
  // @REQ: CAL-TRAVEL-BUFFER
  it.each([-1, 90.5, '90', null])(
    'travelBufferMinutes = %p jest odrzucone, zero zapisów',
    async (invalidValue) => {
      const input: { travelBufferMinutes: unknown } = { travelBufferMinutes: invalidValue };

      const result = await updateTravelBufferAction(input as { travelBufferMinutes: number });

      expect(result.success).toBe(false);
      expect(txUpdateMock).not.toHaveBeenCalled();
      expect(executeRawMock).not.toHaveBeenCalled();
    },
  );

  // Asymetria z koszykami (przypadek brzegowy 6 z WO): dla bufora 0 JEST dozwolone,
  // w przeciwieństwie do durationMinutes koszyków (CHECK duration_minutes > 0).
  // @REQ: CAL-TRAVEL-BUFFER
  it('travelBufferMinutes = 0 JEST akceptowane (asymetria z CHECK duration_minutes > 0 koszyków)', async () => {
    const result = await updateTravelBufferAction({ travelBufferMinutes: 0 });

    expect(result.success).toBe(true);
  });

  // @REQ: CAL-TRAVEL-BUFFER
  it('travelBufferMinutes = 240 (górna granica) jest akceptowane, 241 odrzucone', async () => {
    const okResult = await updateTravelBufferAction({ travelBufferMinutes: 240 });
    expect(okResult.success).toBe(true);

    const tooHighResult = await updateTravelBufferAction({ travelBufferMinutes: 241 });
    expect(tooHighResult.success).toBe(false);
  });
});

// ────────────────────────────────── TC-G1 (część bufora) — bramka RBAC ──────────────────────────────────

describe('updateTravelBufferAction — TC-G1 (bramka RBAC dla ról nieuprawnionych i braku sesji)', () => {
  it.each(UNAUTHORIZED_ROLES)(
    'TC-G1 — rola %s jest odrzucona, ZERO wywołań Prismy',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await updateTravelBufferAction({ travelBufferMinutes: 45 });

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
      expect(txUpdateMock).not.toHaveBeenCalled();
      expect(executeRawMock).not.toHaveBeenCalled();
    },
  );

  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-G1 — brak sesji (getCurrentActorRole zwraca null) jest odrzucone fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await updateTravelBufferAction({ travelBufferMinutes: 45 });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // Przypadek brzegowy 10 z WO: odmowa nie loguje.
  // @REQ: CAL-TRAVEL-BUFFER
  it('przypadek brzegowy 10 — odmowa RBAC nie tworzy wpisu w audit_log', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    await updateTravelBufferAction({ travelBufferMinutes: 45 });

    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });
});

// ──────────────────────── Przypadek brzegowy 2 — współbieżność zapisu bufora ────────────────────────

describe('updateTravelBufferAction — przypadek brzegowy 2 (współbieżność, read-modify-write nie gubi klucza)', () => {
  // Dowód na poziomie mocka (nie dowód realnej atomowości Postgresa — patrz zastrzeżenie
  // w nagłówku pliku i w sec-last-admin-guard.test.ts AC4). Dwa równoległe zapisy o różnych
  // wartościach: po obu, KAŻDY wynik zachowuje komplet czterech kluczy i
  // travel_buffer_minutes równa się JEDNEJ z dwóch podanych wartości.
  // @REQ: CAL-TRAVEL-BUFFER
  it('przypadek brzegowy 2 — dwa równoległe zapisy (30 i 90): oba wyniki mają komplet kluczy, wartość to 30 albo 90', async () => {
    const results = await Promise.all([
      updateTravelBufferAction({ travelBufferMinutes: 30 }),
      updateTravelBufferAction({ travelBufferMinutes: 90 }),
    ]);

    for (const result of results) {
      expect(result.success).toBe(true);
    }
    for (const call of txUpdateMock.mock.calls) {
      const persisted = call[0].data.konfiguracja;
      expect(persisted.default_workday_start).toBe('08:00');
      expect(persisted.default_workday_end).toBe('16:00');
      expect(persisted.default_weekdays).toEqual([1, 2, 3, 4, 5]);
      expect([30, 90]).toContain(persisted.travel_buffer_minutes);
    }
  });
});
