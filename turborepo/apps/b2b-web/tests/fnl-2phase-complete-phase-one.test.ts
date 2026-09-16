import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, can, TRANSITIONS } from '@klikklima/contracts';

/**
 * WO: docs/workorders/FNL-2PHASE-BOOKING-MECHANICS.md (ROZSTRZYGNIĘTY 2026-09-16,
 * D1/D2/D3 zamknięte). Wymagania: `FNL-2PHASE-BOOKING` kryt. 1/2 (booking_id per
 * etap, link do etapu II generowany po do:openPhaseTwoBooking) i `FNL-2PHASE` kryt.
 * 3 (dwa rekordy installation_phases). Zawężona lista przypadków testowych, obszary
 * 1 (installation_phases), 2 (instalacje.installation_type), 6 (AC4b — brak
 * manual_status_change), 7 (obrona przed advanceLeadStatus).
 *
 * ═══ KONTRAKT Z IMPLEMENTER-SERVER (decyzja test-authora, TEST-DEFECT jeśli kształt
 * inny) ═══
 *
 * Nowy plik `apps/b2b-web/src/app/(dashboard)/installations/two-phase-actions.ts`
 * ("use server"), eksport:
 *
 *   export async function completePhaseOneAction(
 *     installationId: string,
 *   ): Promise<{ success: boolean; error?: string }>
 *
 * ═══ PUNKT OTWARTY, NIEROZSTRZYGNIĘTY PRZEZ WO (zgłoszony, nie blokujący) ═══
 * WO zakłada w AC1 istnienie DWÓCH wierszy `installation_phases` dla każdej instalacji
 * TWO_PHASE, ale ŻADNA Server Action w zakresie tego WO (audytor ustawiający
 * `installation_type` jest explicite POZA ZAKRESEM, R4) nie ma okazji ich utworzyć
 * WCZEŚNIEJ niż w chwili zamknięcia etapu I. Migracja `20260916060000` nie zawiera
 * triggera tworzącego te wiersze automatycznie (zweryfikowane — zero wystąpień
 * `CREATE TRIGGER`/`CREATE FUNCTION` w tym pliku). Test-author PRZYJMUJE (decyzja
 * własna, do potwierdzenia przez człowieka/`contract-steward` przy review, NIE
 * decyzja z WO): `completePhaseOneAction` tworzy oba wiersze LENIWIE i IDEMPOTENTNIE
 * (przez `installation_phases_unique_phase`) przy PIERWSZYM wywołaniu, jeśli jeszcze
 * nie istnieją, i w tym samym wywołaniu zamyka etap 1. To jest zgodne z guardem
 * `installationIsTwoPhase` (zero wierszy powstaje dla SINGLE_PHASE/NULL, bo guard
 * odmawia przed utworzeniem czegokolwiek) i z AC1 w kontekście JEDYNEGO punktu
 * mutacji, jaki ten WO buduje.
 *
 * Kolejność (wewnątrz `prisma.$transaction`):
 *   1. `getCurrentActorRole()` -> `can(rola, 'installations', 'update')` — odmowa
 *      PRZED jakimkolwiek zapytaniem (rbac.contract.mjs:51: update ->
 *      ['admin','dyspozytor','monter:own'] — ALE D3/WO ogranicza ścieżkę PANELU do
 *      dyspozytora/admina; `monter:own` jest ścieżką docelową Field App, poza
 *      zakresem — test-author testuje więc `dyspozytor`/`admin` jako dozwolone i
 *      `monter`/`audytor` jako odmowę, zgodnie z brzegiem 5 WO).
 *   2. `tx.$queryRaw` `SELECT ... FROM instalacje WHERE id=... FOR UPDATE` (pułapka 4
 *      CLAUDE.md — blokada PRZED odczytem `installation_type`).
 *   3. `tx.instalacje.findUnique` -> `installation_type`, `lead_id`. Guard
 *      `installationIsTwoPhase`: `installation_type !== 'TWO_PHASE'` -> odmowa, ZERO
 *      wierszy `installation_phases` utworzonych.
 *   4. Zapewnienie istnienia wierszy faz 1 i 2 (idempotentnie — `upsert`/`create` +
 *      `catch` na `P2002`).
 *   5. Guard `phaseOneNotCompleted`: `completedAt !== null` na fazie 1 -> odmowa,
 *      ZERO zmian (idempotencja, brzeg 1 WO).
 *   6. `tx.booking.update` -> rezerwacja etapu I (znaleziona po `leadId` +
 *      `visitBasket.code = 'INSTALL_PHASE_1'` + status aktywny) przechodzi na
 *      `COMPLETED` (AC4, R3 — inaczej `bookings_one_active_per_subject` blokuje etap
 *      II).
 *   7. `tx.installationPhase.update` fazy 1: `completedAt = now`, `bookingId` = ID tej
 *      rezerwacji.
 *   8. Efekty z `TRANSITIONS.find(t => t.id === 'T17').effects`, filtr `!startsWith('do:')`
 *      -> `enqueueNotification(tx, { notificationId, idempotencyKey:
 *      `phase1:${installationId}`, installationId, payload: { link } })` — identyfikator
 *      powiadomienia czytany WYŁĄCZNIE z kontraktu, nigdy jako literał w kodzie
 *      (zakaz adr003-notif-literal).
 *   9. ZERO `tx.auditLog.create` — `T17.manualEquivalent === true` (C.4) anuluje K1,
 *      a `completePhaseOneAction` NIE jest jedną z pięciu funkcji objętych
 *      `SEC-AUDIT-LOG-MANUAL-STATUS` (WO tamtego wymagania, D1: lista zamknięta,
 *      pięć funkcji, ta nie jest żadną z nich) — AC4b.
 *
 * Stan zmierzony 2026-09-16: `grep -rn "two-phase-actions" apps/b2b-web/src/` —
 * zero wyników. Import ma się wywalić brakiem modułu (RED poprawny).
 */

const {
  transactionMock,
  txQueryRawMock,
  txInstalacjeFindUniqueMock,
  txInstallationPhaseFindUniqueMock,
  txInstallationPhaseCreateMock,
  txInstallationPhaseUpdateMock,
  txBookingFindFirstMock,
  txBookingUpdateMock,
  txAuditLogCreateMock,
  txNotificationQueueCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  txQueryRawMock: vi.fn(),
  txInstalacjeFindUniqueMock: vi.fn(),
  txInstallationPhaseFindUniqueMock: vi.fn(),
  txInstallationPhaseCreateMock: vi.fn(),
  txInstallationPhaseUpdateMock: vi.fn(),
  txBookingFindFirstMock: vi.fn(),
  txBookingUpdateMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
  txNotificationQueueCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: { $transaction: transactionMock },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

const tx = {
  $queryRaw: txQueryRawMock,
  instalacje: { findUnique: txInstalacjeFindUniqueMock },
  installationPhase: {
    findUnique: txInstallationPhaseFindUniqueMock,
    create: txInstallationPhaseCreateMock,
    update: txInstallationPhaseUpdateMock,
  },
  booking: { findFirst: txBookingFindFirstMock, update: txBookingUpdateMock },
  auditLog: { create: txAuditLogCreateMock },
  notificationQueue: { create: txNotificationQueueCreateMock },
};

const { completePhaseOneAction } = await import(
  '../src/app/(dashboard)/installations/two-phase-actions'
);

const INSTALLATION_ID = 'install-1';
const LEAD_ID = 'lead-1';
const PHASE_ONE_BOOKING_ID = 'booking-phase-1';

function installationRow(installationType: string | null) {
  return { id: INSTALLATION_ID, lead_id: LEAD_ID, installation_type: installationType };
}

function phaseOneRow(overrides: Partial<{ completedAt: Date | null }> = {}) {
  return {
    id: 'phase-1',
    installationId: INSTALLATION_ID,
    phaseNumber: 1,
    completedAt: overrides.completedAt === undefined ? null : overrides.completedAt,
    bookingId: null,
  };
}

const P2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

beforeEach(() => {
  transactionMock.mockReset();
  txQueryRawMock.mockReset();
  txInstalacjeFindUniqueMock.mockReset();
  txInstallationPhaseFindUniqueMock.mockReset();
  txInstallationPhaseCreateMock.mockReset();
  txInstallationPhaseUpdateMock.mockReset();
  txBookingFindFirstMock.mockReset();
  txBookingUpdateMock.mockReset();
  txAuditLogCreateMock.mockReset();
  txNotificationQueueCreateMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
  txQueryRawMock.mockResolvedValue([]);
  txInstalacjeFindUniqueMock.mockResolvedValue(installationRow('TWO_PHASE'));
  // Domyślnie: fazy jeszcze nie istnieją -> akcja je tworzy leniwie (patrz nagłówek).
  txInstallationPhaseFindUniqueMock.mockResolvedValue(null);
  txInstallationPhaseCreateMock.mockResolvedValue({});
  txInstallationPhaseUpdateMock.mockResolvedValue({});
  txBookingFindFirstMock.mockResolvedValue({ id: PHASE_ONE_BOOKING_ID, leadId: LEAD_ID, status: 'RESERVED' });
  txBookingUpdateMock.mockResolvedValue({});
  txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
  txNotificationQueueCreateMock.mockResolvedValue({ id: 'nq-1' });
});

// ═══ Obszar 2 — guard installationIsTwoPhase (instalacje.installation_type, D1) ═══

describe('completePhaseOneAction — guard installationIsTwoPhase (AC1, obszar 2)', () => {
  // @REQ: FNL-2PHASE-BOOKING
  it('installation_type = NULL (tryb nieustalony) -> odmowa, ZERO wierszy installation_phases utworzonych', async () => {
    txInstalacjeFindUniqueMock.mockResolvedValue(installationRow(null));

    const result = await completePhaseOneAction(INSTALLATION_ID);

    expect(result.success).toBe(false);
    expect(txInstallationPhaseCreateMock).not.toHaveBeenCalled();
    expect(txBookingUpdateMock).not.toHaveBeenCalled();
  });

  // @REQ: FNL-2PHASE-BOOKING
  it('installation_type = SINGLE_PHASE -> odmowa, ZERO wierszy installation_phases utworzonych', async () => {
    txInstalacjeFindUniqueMock.mockResolvedValue(installationRow('SINGLE_PHASE'));

    const result = await completePhaseOneAction(INSTALLATION_ID);

    expect(result.success).toBe(false);
    expect(txInstallationPhaseCreateMock).not.toHaveBeenCalled();
  });

  // Kontrola pozytywna, AC1: TWO_PHASE -> dwa wiersze (phase_number 1 i 2) utworzone.
  // @REQ: FNL-2PHASE-BOOKING
  it('installation_type = TWO_PHASE -> tworzy DWA wiersze (phase_number 1 i 2)', async () => {
    const result = await completePhaseOneAction(INSTALLATION_ID);

    expect(result.success).toBe(true);
    const phaseNumbers = txInstallationPhaseCreateMock.mock.calls.map(
      (call) => call[0].data.phaseNumber,
    );
    expect(new Set(phaseNumbers)).toEqual(new Set([1, 2]));
    expect(txInstallationPhaseCreateMock).toHaveBeenCalledTimes(2);
  });
});

// ═══ Obszar 1 — AC2/AC4: booking_id per etap, zamknięcie etapu 1 ═══

describe('completePhaseOneAction — AC2/AC4, linkowanie rezerwacji i zamknięcie etapu 1', () => {
  // @REQ: FNL-2PHASE-BOOKING
  it('AC4 — rezerwacja etapu I (INSTALL_PHASE_1) przechodzi na COMPLETED w TEJ SAMEJ transakcji', async () => {
    await completePhaseOneAction(INSTALLATION_ID);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(txBookingUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PHASE_ONE_BOOKING_ID },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  // AC2: booking_id zapisany na WIERSZU FAZY 1, nie fazy 2.
  // @REQ: FNL-2PHASE-BOOKING
  it('AC2 — installation_phases(phaseNumber=1).bookingId ustawiony na ID rezerwacji etapu I, faza 2 nietknięta w tym polu', async () => {
    await completePhaseOneAction(INSTALLATION_ID);

    const phase1Update = txInstallationPhaseUpdateMock.mock.calls.find(
      (call) => call[0].where.installationId_phaseNumber?.phaseNumber === 1,
    );
    expect(phase1Update).toBeDefined();
    expect(phase1Update![0].data).toMatchObject({ bookingId: PHASE_ONE_BOOKING_ID });

    const phase2Update = txInstallationPhaseUpdateMock.mock.calls.find(
      (call) => call[0].where.installationId_phaseNumber?.phaseNumber === 2,
    );
    expect(phase2Update).toBeUndefined();
  });

  // Przypadek pusty: brak rezerwacji aktywnej z koszykiem INSTALL_PHASE_1 dla leada —
  // odmowa czytelna, nie 500, zero mutacji.
  // @REQ: FNL-2PHASE-BOOKING
  it('brak rezerwacji etapu I znalezionej -> odmowa czytelna, zero mutacji', async () => {
    txBookingFindFirstMock.mockResolvedValue(null);

    const result = await completePhaseOneAction(INSTALLATION_ID);

    expect(result.success).toBe(false);
    expect(txInstallationPhaseUpdateMock).not.toHaveBeenCalled();
  });
});

// ═══ AC4 — powiadomienie efektu T17, jeden link, czytany z transition.effects ═══

describe('completePhaseOneAction — AC4, kolejkowanie efektu T17 (link do etapu II, bez literału ID)', () => {
  // @REQ: FNL-2PHASE-BOOKING
  it('kolejkuje DOKŁADNIE identyfikator powiadomienia z TRANSITIONS T17.effects (filtr do:), z payload.link, installationId jako właściciel', async () => {
    const t17 = TRANSITIONS.find((t) => t.id === 'T17')!;
    const expectedNotificationIds = t17.effects.filter((e) => !e.startsWith('do:'));
    expect(expectedNotificationIds).toHaveLength(1);

    await completePhaseOneAction(INSTALLATION_ID);

    expect(txNotificationQueueCreateMock).toHaveBeenCalledTimes(1);
    const call = txNotificationQueueCreateMock.mock.calls[0]![0];
    expect(call.data.notificationId).toBe(expectedNotificationIds[0]);
    expect(call.data.installationId).toBe(INSTALLATION_ID);
    expect(call.data.payload).toHaveProperty('link');
    expect(typeof call.data.payload.link).toBe('string');
    expect(call.data.payload.link.length).toBeGreaterThan(0);
  });

  // AC4: "link nie istnieje wcześniej" — przed zamknięciem etapu I zero wpisów w kolejce.
  // @REQ: FNL-2PHASE-BOOKING
  it('PRZED zamknięciem etapu I (odmowa guard) — zero powiadomień kolejkowanych', async () => {
    txInstalacjeFindUniqueMock.mockResolvedValue(installationRow(null));

    await completePhaseOneAction(INSTALLATION_ID);

    expect(txNotificationQueueCreateMock).not.toHaveBeenCalled();
  });
});

// ═══ AC4b — zamknięcie etapu I z panelu NIE jest obejściem reguły (manualEquivalent) ═══

describe('completePhaseOneAction — AC4b, NIE tworzy wpisu audytowego ręcznej zmiany statusu (T17.manualEquivalent=true)', () => {
  // @REQ: FNL-2PHASE-BOOKING
  it('T17 ma manualEquivalent: true w kontrakcie (nośnik C.4)', () => {
    const t17 = TRANSITIONS.find((t) => t.id === 'T17')!;
    expect(t17.manualEquivalent).toBe(true);
  });

  // @REQ: FNL-2PHASE-BOOKING
  it('sukces zamknięcia etapu I -> ZERO wpisu audit_log', async () => {
    const result = await completePhaseOneAction(INSTALLATION_ID);

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });
});

// ═══ Brzeg 1 — idempotencja T17 (pętla własna) ═══

describe('completePhaseOneAction — brzeg 1, idempotencja (guard phaseOneNotCompleted)', () => {
  // @REQ: FNL-2PHASE-BOOKING
  it('drugie zamknięcie (completedAt już ustawione) -> odmowa, ZERO drugiego update/powiadomienia, completedAt niezmienione', async () => {
    txInstallationPhaseFindUniqueMock.mockResolvedValue(
      phaseOneRow({ completedAt: new Date('2026-09-01T10:00:00Z') }),
    );

    const result = await completePhaseOneAction(INSTALLATION_ID);

    expect(result.success).toBe(false);
    expect(txInstallationPhaseUpdateMock).not.toHaveBeenCalled();
    expect(txBookingUpdateMock).not.toHaveBeenCalled();
    expect(txNotificationQueueCreateMock).not.toHaveBeenCalled();
  });
});

// ═══ Brzeg 2 — współbieżność tworzenia etapów (UNIQUE, nie sprawdzenie w JS) ═══

describe('completePhaseOneAction — brzeg 2, współbieżność tworzenia etapów (installation_phases_unique_phase)', () => {
  // @REQ: FNL-2PHASE-BOOKING
  it('P2002 (kolizja unikalności) podczas tworzenia fazy jest ŁAPANE jako "już istnieje", nie propagowane jako 500', async () => {
    txInstallationPhaseCreateMock.mockRejectedValue(P2002);
    // Po nieudanym create (bo już istnieje z drugiego wywołania równoległego), ponowny
    // odczyt widzi fazę 1 świeżo utworzoną przez "zwycięskie" wywołanie równoległe.
    txInstallationPhaseFindUniqueMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(phaseOneRow({ completedAt: null }));

    const result = await completePhaseOneAction(INSTALLATION_ID);

    expect(result.success).toBe(true);
  });
});

// ═══ Brzeg 3 — współbieżność T17 (dokładnie jeden sukces) ═══

describe('completePhaseOneAction — brzeg 3, dwa równoległe zamknięcia etapu I na tej samej instalacji', () => {
  // @REQ: FNL-2PHASE-BOOKING
  it('dokładnie jedno z dwóch równoległych wywołań kończy się sukcesem', async () => {
    txInstallationPhaseFindUniqueMock
      .mockResolvedValueOnce(phaseOneRow({ completedAt: null }))
      .mockResolvedValueOnce(phaseOneRow({ completedAt: new Date('2026-09-01T10:00:00Z') }));

    const [first, second] = await Promise.all([
      completePhaseOneAction(INSTALLATION_ID),
      completePhaseOneAction(INSTALLATION_ID),
    ]);

    const successes = [first, second].filter((r) => r.success);
    expect(successes).toHaveLength(1);
  });

  // Blokada MUSI być w bazie (`FOR UPDATE`), nie sprawdzeniem w JS (pułapka 4 CLAUDE.md).
  // @REQ: FNL-2PHASE-BOOKING
  it('tx.$queryRaw z FOR UPDATE na instalacje poprzedza odczyt/zapis installation_phases', async () => {
    await completePhaseOneAction(INSTALLATION_ID);

    expect(txQueryRawMock).toHaveBeenCalled();
    const firstSql = txQueryRawMock.mock.calls[0]![0];
    const firstSqlText = Array.isArray(firstSql) ? firstSql.join('?') : String(firstSql);
    expect(firstSqlText).toMatch(/FOR UPDATE/i);

    const lockCallOrder = txQueryRawMock.mock.invocationCallOrder[0];
    expect(lockCallOrder).toBeLessThan(txInstalacjeFindUniqueMock.mock.invocationCallOrder[0]);
  });
});

// ═══ Brzeg 5 — uprawnienia (D3: dyspozytor/admin dozwoleni, monter/audytor odmowa) ═══

describe('completePhaseOneAction — brzeg 5, uprawnienia po D3', () => {
  const ALL_INSTALLATIONS_UPDATE_ROLES = ROLES.filter((r) => can(r, 'installations', 'update') === 'yes');
  // D3: mimo że RBAC (installations:update) obejmuje 'monter:own', ten WO NIE buduje
  // ekranu montera — panel B2B jest wyłącznie dla dyspozytora/admina (WO, brzeg 5
  // dosłownie). `monter` jest więc odmową NA TYM WO, mimo że macierz RBAC formalnie
  // dopuszcza 'monter:own' dla innego kontekstu (Field App, faza 3+, nieistniejąca).
  const PANEL_ALLOWED_ROLES: string[] = ALL_INSTALLATIONS_UPDATE_ROLES.filter(
    (r) => r === 'admin' || r === 'dyspozytor',
  );
  const DENIED_ROLES = ROLES.filter((r) => !PANEL_ALLOWED_ROLES.includes(r));

  // @REQ: FNL-2PHASE-BOOKING
  it.each(DENIED_ROLES)('rola %s odmówiona fail-closed, zero transakcji', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    const result = await completePhaseOneAction(INSTALLATION_ID);
    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // @REQ: FNL-2PHASE-BOOKING
  it.each(PANEL_ALLOWED_ROLES)('rola %s (dyspozytor/admin) przechodzi bramkę', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    const result = await completePhaseOneAction(INSTALLATION_ID);
    expect(result.success).toBe(true);
  });

  // @REQ: FNL-2PHASE-BOOKING
  it('brak roli (sesja nieznana) jest odmową, nie wyjątkiem', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);
    const result = await completePhaseOneAction(INSTALLATION_ID);
    expect(result.success).toBe(false);
  });
});
