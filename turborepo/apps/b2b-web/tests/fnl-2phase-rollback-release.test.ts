import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findTransition, TRANSITIONS } from '@klikklima/contracts';

/**
 * WO: docs/workorders/FNL-2PHASE-ROLLBACK-RELEASE.md. Wymaganie
 * `FNL-2PHASE-ROLLBACK-RELEASE` (`contracts/requirements.contract.mjs:169`, TODO,
 * risk MEDIUM, 3 kryteria) — zakres WĄSKI (decyzja Michała, D1 wariant (a) w WO):
 * zwalniamy WYŁĄCZNIE rezerwację etapu II montażu dwuetapowego wskazaną przez
 * `installation_phases(phase_number=2).booking_id`. Zwalnianie KAŻDEJ aktywnej
 * rezerwacji podmiotu przy rollbacku w ogóle jest szerszą klasą błędu, wyniesioną
 * do nowego ID `FNL-ROLLBACK-BOOKING-RELEASE` (nierejestrowanego jeszcze w
 * `requirements.contract.mjs`) — poza zakresem tej tury.
 *
 * Status `instalacje` (`CANCELLED` po `releaseCrewSlot`) NIE ZMIENIA SIĘ w tym
 * WO (decyzja Michała) — ta ścieżka jest chroniona istniejącym testem
 * "BLOCKER-1" w `apps/b2b-web/tests/logistics-rollback-effects.test.ts` i tamten
 * plik NIE JEST tu dotykany (zero potrzeby rozszerzania jego harnessu — ten plik
 * jest samodzielny, ze swoim własnym dublem stanowym `tx`).
 *
 * ═══ KONTRAKT Z IMPLEMENTER-SERVER (decyzja test-authora, TEST-DEFECT jeśli
 * kształt inny — wzorzec z nagłówka `fnl-2phase-complete-phase-one.test.ts`) ═══
 *
 * Nowa funkcja w `apps/b2b-web/src/app/(dashboard)/logistics/rollback-effects.ts`
 * (WARIANT PREFEROWANY przez WO — sekcja "Szkic projektu"):
 *
 *   export async function releasePhaseTwoBooking(
 *     tx: Prisma.TransactionClient,
 *     leadId: string,
 *   ): Promise<void>
 *
 * wołana z `rollbackLogisticsOrder` (`logistics/actions.ts`) BEZPOŚREDNIO PO
 * `releaseCrewSlot(tx, leadId)`, w OBU miejscach, gdzie `releaseCrewSlot` jest
 * dziś wołane (gałąź główna przejścia I gałąź idempotentna
 * `freshLead.status === ROLLBACK_RESCHEDULING`) — analogicznie do
 * `suspendLogisticsSla`, która jest już wołana w obu gałęziach.
 *
 * Kroki (dosłownie ze "Szkicu projektu" WO):
 *   1. `tx.instalacje.findMany({ where: { lead_id: leadId, installation_type: 'TWO_PHASE' } })`
 *      — BEZ filtra po `instalacje.status` (D2 WO: `releaseCrewSlot` ustawia
 *      `CANCELLED` na wierszach `PLANNED`, więc filtrowanie po statusie instalacji
 *      tutaj zależałoby od kolejności wywołań).
 *   2. Dla każdej takiej instalacji: `tx.installationPhase.findUnique({ where:
 *      { installationId_phaseNumber: { installationId, phaseNumber: 2 } } })`.
 *   3. Jeżeli `phase2?.bookingId` istnieje: `tx.$queryRaw` `SELECT ... FROM
 *      bookings WHERE id = ... FOR UPDATE` (blokada PRZED mutacją, pułapka 4
 *      CLAUDE.md), potem `tx.booking.findUnique({ where: { id: phase2.bookingId } })`.
 *   4. Jeżeli `status IN ('RESERVED','CONFIRMED')`: `tx.booking.update({ where:
 *      { id: phase2.bookingId }, data: { status: 'RELEASED' } })`. W przeciwnym
 *      razie (już `RELEASED`/`COMPLETED`) — NIC (idempotencja, ochrona pracy
 *      wykonanej).
 *   5. `installation_phases.booking_id` NIE JEST zerowane (ślad historyczny, WO
 *      krok 4) i etap I NIE JEST dotykany w żadnym polu (AC6/AC7).
 *
 * Stan zmierzony 2026-09-16: `grep -rn "releasePhaseTwoBooking"
 * apps/b2b-web/src/` — zero wyników. Import w Sekcji 1 poniżej ma się wywalić
 * brakiem eksportu (RED poprawny, analogicznie do `completePhaseOneAction`
 * przed jego implementacją).
 */

// ═══ Sekcja 0 — AC1 (kryt. 1): TEST REGRESYJNY na już istniejącym zachowaniu ═══
//
// T13 (`contracts/funnel.contract.mjs:171`) ma `guards: []` — kryterium 1 jest
// SPEŁNIONE STRUKTURALNIE, zanim ktokolwiek napisze linijkę kodu w tej turze.
// Ten test NIE JEST czekającym na implementację RED — jest strażnikiem regresji:
// dowodzi, że nic w tej turze (albo w przyszłej) nie doda guardu do T13 pod
// pretekstem "obsługi zamknięcia etapu I", bo taki guard nie ma żadnego wsparcia
// w tym wymaganiu. Zgodnie z notatką WO do rejestru: kryterium 1 domyka się
// testem regresyjnym, nie zmianą.
describe('AC1 (kryt. 1, regresja kontraktowa) — T13 legalne niezależnie od stanu etapów montażu', () => {
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('T13 (AWAITING_INSTALLATION -> ROLLBACK_RESCHEDULING) nie ma żadnego guardu — findTransition zwraca przejście bez warunku na installation_phases', () => {
    const t13 = findTransition('AWAITING_INSTALLATION', 'rollback');

    expect(t13).toBeDefined();
    expect(t13?.id).toBe('T13');
    expect(t13?.to).toBe('ROLLBACK_RESCHEDULING');
    expect(t13?.guards ?? []).toEqual([]);
  });

  // T17 (zamknięcie etapu I) jest pętlą własną AWAITING_INSTALLATION->AWAITING_INSTALLATION
  // (`completePhaseOneAction`, FNL-2PHASE-BOOKING) — nie zmienia statusu leada,
  // więc `findTransition('AWAITING_INSTALLATION', 'rollback')` trafia w T13
  // niezależnie od tego, czy etap I jest zamknięty. To jest DOWÓD, nie założenie.
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('T17 (zamknięcie etapu I) jest pętlą własną — nie odbiera leada spod T13 po zamknięciu etapu I', () => {
    const t17 = TRANSITIONS.find((t) => t.id === 'T17');

    expect(t17?.from).toBe('AWAITING_INSTALLATION');
    expect(t17?.to).toBe('AWAITING_INSTALLATION');

    // Konsekwencja: lead, którego etap I jest zamknięty, jest WCIĄŻ w
    // AWAITING_INSTALLATION, więc T13 jest wciąż osiągalne z tego samego stanu.
    const t13 = findTransition('AWAITING_INSTALLATION', 'rollback');
    expect(t13?.from).toBe(t17?.to);
  });
});

// ═══ Sekcja 1 — testy jednostkowe releasePhaseTwoBooking(tx, leadId) ═══

type FakeInstRow = { id: string; lead_id: string; installation_type: string | null };
type FakePhaseRow = { installationId: string; phaseNumber: number; bookingId: string | null; completedAt: Date | null };
type FakeBookingRow = { id: string; status: string };

function createFakeReleaseTx(opts: {
  instalacje: FakeInstRow[];
  phases: FakePhaseRow[];
  bookings: FakeBookingRow[];
}) {
  const state = {
    instalacje: opts.instalacje.map((r) => ({ ...r })),
    phases: opts.phases.map((r) => ({ ...r })),
    bookings: opts.bookings.map((r) => ({ ...r })),
  };
  const calls: string[] = [];

  const queryRawMock = vi.fn(async (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    calls.push('queryRaw');
    const sql = Array.isArray(strings) ? strings.join('?') : String(strings);
    if (!/FOR UPDATE/i.test(sql)) {
      throw new Error(`Oczekiwano blokady FOR UPDATE w zapytaniu $queryRaw, otrzymano: ${sql}`);
    }
    if (!/bookings/i.test(sql)) {
      throw new Error(`Oczekiwano blokady FOR UPDATE na tabeli bookings, otrzymano: ${sql}`);
    }
    const bookingId = values[0];
    return state.bookings.filter((b) => b.id === bookingId).map((b) => ({ id: b.id, status: b.status }));
  });

  const instalacjeMock = {
    findMany: vi.fn(async ({ where }: { where: { lead_id: string; installation_type?: string } }) => {
      calls.push('instalacje.findMany');
      return state.instalacje.filter(
        (r) => r.lead_id === where.lead_id && (!where.installation_type || r.installation_type === where.installation_type),
      );
    }),
  };

  const installationPhaseMock = {
    findUnique: vi.fn(
      async ({ where }: { where: { installationId_phaseNumber: { installationId: string; phaseNumber: number } } }) => {
        calls.push('installationPhase.findUnique');
        const key = where.installationId_phaseNumber;
        return (
          state.phases.find((p) => p.installationId === key.installationId && p.phaseNumber === key.phaseNumber) ?? null
        );
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { installationId_phaseNumber: { installationId: string; phaseNumber: number } };
        data: Partial<FakePhaseRow>;
      }) => {
        calls.push('installationPhase.update');
        const key = where.installationId_phaseNumber;
        const row = state.phases.find((p) => p.installationId === key.installationId && p.phaseNumber === key.phaseNumber);
        if (!row) throw new Error('etap nie znaleziony');
        Object.assign(row, data);
        return { ...row };
      },
    ),
    // AC7: rollback nie może NIGDY skasować wiersza etapu — obecność tego mocka
    // pozwala dowieść jego nie-wywołania, nie tylko braku importu.
    delete: vi.fn(async () => {
      calls.push('installationPhase.delete');
      throw new Error('installationPhase.delete nie powinien być wołany przez rollback');
    }),
  };

  const bookingMock = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      calls.push('booking.findUnique');
      return state.bookings.find((b) => b.id === where.id) ?? null;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeBookingRow> }) => {
      calls.push('booking.update');
      const row = state.bookings.find((b) => b.id === where.id);
      if (!row) throw new Error('rezerwacja nie znaleziona');
      Object.assign(row, data);
      return { ...row };
    }),
  };

  const tx = {
    $queryRaw: queryRawMock,
    instalacje: instalacjeMock,
    installationPhase: installationPhaseMock,
    booking: bookingMock,
  };

  return {
    tx,
    state,
    calls,
    mocks: { instalacje: instalacjeMock, installationPhase: installationPhaseMock, booking: bookingMock, queryRaw: queryRawMock },
  };
}

describe('releasePhaseTwoBooking(tx, leadId) — AC2/AC4/AC6/AC7/AC9 i przypadki brzegowe', () => {
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('AC2: rezerwacja etapu II w RESERVED przechodzi na RELEASED', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, state } = createFakeReleaseTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', installation_type: 'TWO_PHASE' }],
      phases: [
        { installationId: 'inst-1', phaseNumber: 1, bookingId: 'booking-1', completedAt: new Date('2026-09-01') },
        { installationId: 'inst-1', phaseNumber: 2, bookingId: 'booking-2', completedAt: null },
      ],
      bookings: [{ id: 'booking-2', status: 'RESERVED' }],
    });

    await releasePhaseTwoBooking(tx as never, 'lead-1');

    expect(state.bookings.find((b) => b.id === 'booking-2')!.status).toBe('RELEASED');
  });

  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('AC2: rezerwacja etapu II w CONFIRMED przechodzi też na RELEASED', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, state } = createFakeReleaseTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', installation_type: 'TWO_PHASE' }],
      phases: [{ installationId: 'inst-1', phaseNumber: 2, bookingId: 'booking-2', completedAt: null }],
      bookings: [{ id: 'booking-2', status: 'CONFIRMED' }],
    });

    await releasePhaseTwoBooking(tx as never, 'lead-1');

    expect(state.bookings.find((b) => b.id === 'booking-2')!.status).toBe('RELEASED');
  });

  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('AC4: rollback leada lead-1 nie dotyka rezerwacji etapu II należącej do instalacji INNEGO leada', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, state } = createFakeReleaseTx({
      instalacje: [
        { id: 'inst-1', lead_id: 'lead-1', installation_type: 'TWO_PHASE' },
        { id: 'inst-2', lead_id: 'lead-2', installation_type: 'TWO_PHASE' },
      ],
      phases: [
        { installationId: 'inst-1', phaseNumber: 2, bookingId: 'booking-1', completedAt: null },
        { installationId: 'inst-2', phaseNumber: 2, bookingId: 'booking-2', completedAt: null },
      ],
      bookings: [
        { id: 'booking-1', status: 'RESERVED' },
        { id: 'booking-2', status: 'RESERVED' },
      ],
    });

    await releasePhaseTwoBooking(tx as never, 'lead-1');

    expect(state.bookings.find((b) => b.id === 'booking-1')!.status).toBe('RELEASED');
    expect(state.bookings.find((b) => b.id === 'booking-2')!.status).toBe('RESERVED');
  });

  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('AC6: completed_at etapu I NIE jest kasowane, a rezerwacja etapu I (COMPLETED) pozostaje nietknięta', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const completedAtBefore = new Date('2026-09-01T10:00:00Z');
    const { tx, state, mocks } = createFakeReleaseTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', installation_type: 'TWO_PHASE' }],
      phases: [
        { installationId: 'inst-1', phaseNumber: 1, bookingId: 'booking-1', completedAt: completedAtBefore },
        { installationId: 'inst-1', phaseNumber: 2, bookingId: 'booking-2', completedAt: null },
      ],
      bookings: [
        { id: 'booking-1', status: 'COMPLETED' },
        { id: 'booking-2', status: 'RESERVED' },
      ],
    });

    await releasePhaseTwoBooking(tx as never, 'lead-1');

    const phase1After = state.phases.find((p) => p.installationId === 'inst-1' && p.phaseNumber === 1)!;
    expect(phase1After.completedAt).toEqual(completedAtBefore);
    expect(state.bookings.find((b) => b.id === 'booking-1')!.status).toBe('COMPLETED');

    // Żadna mutacja installationPhase nie może dotyczyć etapu 1.
    const phase1Mutations = mocks.installationPhase.update.mock.calls.filter(
      (c) => (c[0] as { where: { installationId_phaseNumber: { phaseNumber: number } } }).where.installationId_phaseNumber.phaseNumber === 1,
    );
    expect(phase1Mutations).toHaveLength(0);
  });

  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('AC7: oba wiersze installation_phases nadal istnieją po rollbacku — delete nigdy wołane', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, state, mocks } = createFakeReleaseTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', installation_type: 'TWO_PHASE' }],
      phases: [
        { installationId: 'inst-1', phaseNumber: 1, bookingId: 'booking-1', completedAt: new Date('2026-09-01') },
        { installationId: 'inst-1', phaseNumber: 2, bookingId: 'booking-2', completedAt: null },
      ],
      bookings: [
        { id: 'booking-1', status: 'COMPLETED' },
        { id: 'booking-2', status: 'RESERVED' },
      ],
    });

    await releasePhaseTwoBooking(tx as never, 'lead-1');

    expect(state.phases).toHaveLength(2);
    expect(mocks.installationPhase.delete).not.toHaveBeenCalled();
  });

  // AC9: blokada FOR UPDATE na rezerwacji MUSI poprzedzić jej mutację (pułapka 4
  // CLAUDE.md) — sprawdzenie w JS nie wystarcza.
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('AC9: SELECT ... FOR UPDATE na rezerwacji etapu II poprzedza jej mutację (status=RELEASED)', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, calls } = createFakeReleaseTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', installation_type: 'TWO_PHASE' }],
      phases: [{ installationId: 'inst-1', phaseNumber: 2, bookingId: 'booking-2', completedAt: null }],
      bookings: [{ id: 'booking-2', status: 'RESERVED' }],
    });

    await releasePhaseTwoBooking(tx as never, 'lead-1');

    expect(tx.$queryRaw).toHaveBeenCalled();
    const lockIndex = calls.indexOf('queryRaw');
    const mutationIndex = calls.indexOf('booking.update');
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(mutationIndex).toBeGreaterThan(lockIndex);
  });

  // AC8 (propagacja błędu — dopełnienie atomiczności): funkcja NIE MOŻE połknąć
  // błędu mutacji rezerwacji, inaczej wywołujący `$transaction` (rollbackLogisticsOrder)
  // nie miałby jak cofnąć całości. Atomiczność SAMEJ transakcji jest już
  // udowodniona ogólnie testem "AC-A3" w `logistics-rollback-effects.test.ts";
  // ten test dopełnia go na poziomie KONTRAKTU nowej funkcji.
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('AC8: błąd przy tx.booking.update propaguje się (nie jest połykany)', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx } = createFakeReleaseTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', installation_type: 'TWO_PHASE' }],
      phases: [{ installationId: 'inst-1', phaseNumber: 2, bookingId: 'booking-2', completedAt: null }],
      bookings: [{ id: 'booking-2', status: 'RESERVED' }],
    });
    tx.booking.update = vi.fn(async () => {
      throw new Error('constraint violation');
    });

    await expect(releasePhaseTwoBooking(tx as never, 'lead-1')).rejects.toThrow();
  });

  // ── Przypadki brzegowe (WO, sekcja "Przypadki brzegowe, które MUSZĄ mieć test") ──

  // Brzeg 1: etap II nigdy nie zarezerwowany.
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('brzeg 1: installation_phases(2).bookingId IS NULL -> sukces, zero mutacji bookings', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, mocks } = createFakeReleaseTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', installation_type: 'TWO_PHASE' }],
      phases: [{ installationId: 'inst-1', phaseNumber: 2, bookingId: null, completedAt: null }],
      bookings: [],
    });

    await expect(releasePhaseTwoBooking(tx as never, 'lead-1')).resolves.not.toThrow();
    expect(mocks.booking.update).not.toHaveBeenCalled();
  });

  // Brzeg 2: rezerwacja etapu II już RELEASED (poprzedni rollback albo przełożenie).
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('brzeg 2: rezerwacja etapu II już RELEASED -> bez błędu, bez drugiej mutacji, bez szumu', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, state, mocks } = createFakeReleaseTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', installation_type: 'TWO_PHASE' }],
      phases: [{ installationId: 'inst-1', phaseNumber: 2, bookingId: 'booking-2', completedAt: null }],
      bookings: [{ id: 'booking-2', status: 'RELEASED' }],
    });

    await expect(releasePhaseTwoBooking(tx as never, 'lead-1')).resolves.not.toThrow();
    expect(mocks.booking.update).not.toHaveBeenCalled();
    expect(state.bookings.find((b) => b.id === 'booking-2')!.status).toBe('RELEASED');
  });

  // Brzeg 3: rezerwacja etapu II w COMPLETED — etap II faktycznie się odbył, NIE RUSZAĆ.
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('brzeg 3: rezerwacja etapu II w COMPLETED pozostaje nietknięta (praca wykonana się nie odwraca)', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, state, mocks } = createFakeReleaseTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', installation_type: 'TWO_PHASE' }],
      phases: [{ installationId: 'inst-1', phaseNumber: 2, bookingId: 'booking-2', completedAt: null }],
      bookings: [{ id: 'booking-2', status: 'COMPLETED' }],
    });

    await releasePhaseTwoBooking(tx as never, 'lead-1');

    expect(mocks.booking.update).not.toHaveBeenCalled();
    expect(state.bookings.find((b) => b.id === 'booking-2')!.status).toBe('COMPLETED');
  });

  // Brzeg 4: rollback PRZED zamknięciem etapu I — etap II nie istnieje jeszcze
  // jako wiersz (nie było okazji go zarezerwować, bookPhaseTwoAction odmawia
  // PHASE_ONE_NOT_COMPLETED). Ten przebieg zostawia aktywną rezerwację etapu I
  // nietkniętą — to jest ŚWIADOMA odpowiedź tego WO (D1 wariant (a), poza
  // zakresem: zwalnianie rezerwacji etapu I przy rollbacku, patrz
  // FNL-ROLLBACK-BOOKING-RELEASE), utrwalona tutaj testem, nie przeoczona.
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('brzeg 4: rollback przed zamknięciem etapu I (etap II nie istnieje) -> sukces, rezerwacja etapu I nietknięta (poza wąskim zakresem D1a)', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, state, mocks } = createFakeReleaseTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', installation_type: 'TWO_PHASE' }],
      phases: [{ installationId: 'inst-1', phaseNumber: 1, bookingId: 'booking-1', completedAt: null }],
      bookings: [{ id: 'booking-1', status: 'RESERVED' }],
    });

    await expect(releasePhaseTwoBooking(tx as never, 'lead-1')).resolves.not.toThrow();
    expect(mocks.booking.update).not.toHaveBeenCalled();
    expect(state.bookings.find((b) => b.id === 'booking-1')!.status).toBe('RESERVED');
  });

  // Brzeg 8: brak wiersza instalacji dla leada — nowa ścieżka nie rzuca na undefined.
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('brzeg 8: brak jakiegokolwiek wiersza instalacje dla leada -> sukces, zero odczytu installation_phases', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, mocks } = createFakeReleaseTx({
      instalacje: [],
      phases: [],
      bookings: [],
    });

    await expect(releasePhaseTwoBooking(tx as never, 'lead-99')).resolves.not.toThrow();
    expect(mocks.installationPhase.findUnique).not.toHaveBeenCalled();
  });

  // Brzeg 9: lead z dwiema instalacjami, jedną TWO_PHASE i jedną SINGLE_PHASE —
  // zwalniany jest wyłącznie etap II tej pierwszej.
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('brzeg 9: lead z instalacją TWO_PHASE i SINGLE_PHASE — zwalniana jest wyłącznie rezerwacja etapu II instalacji TWO_PHASE', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, state, mocks } = createFakeReleaseTx({
      instalacje: [
        { id: 'inst-two', lead_id: 'lead-1', installation_type: 'TWO_PHASE' },
        { id: 'inst-single', lead_id: 'lead-1', installation_type: 'SINGLE_PHASE' },
      ],
      phases: [{ installationId: 'inst-two', phaseNumber: 2, bookingId: 'booking-2', completedAt: null }],
      bookings: [{ id: 'booking-2', status: 'RESERVED' }],
    });

    await releasePhaseTwoBooking(tx as never, 'lead-1');

    expect(state.bookings.find((b) => b.id === 'booking-2')!.status).toBe('RELEASED');
    // Instalacja SINGLE_PHASE nie ma nawet okazji trafić do installationPhase.findUnique —
    // dowód, że zapytanie o instalacje jest już zawężone po installation_type.
    expect(mocks.installationPhase.findUnique).toHaveBeenCalledTimes(1);
    expect(mocks.installationPhase.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { installationId_phaseNumber: { installationId: 'inst-two', phaseNumber: 2 } } }),
    );
  });

  // AC10 (montaż jednoetapowy bez regresji): zero zapytań o installation_phases,
  // zero mutacji bookings, dla installation_type = 'SINGLE_PHASE' albo NULL.
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('AC10: installation_type = SINGLE_PHASE -> zero zapytań installation_phases, zero mutacji bookings', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, mocks } = createFakeReleaseTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', installation_type: 'SINGLE_PHASE' }],
      phases: [],
      bookings: [],
    });

    await releasePhaseTwoBooking(tx as never, 'lead-1');

    expect(mocks.installationPhase.findUnique).not.toHaveBeenCalled();
    expect(mocks.booking.update).not.toHaveBeenCalled();
  });

  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('AC10: installation_type = NULL (tryb nieustalony) -> zero zapytań installation_phases, zero mutacji bookings', async () => {
    const { releasePhaseTwoBooking } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, mocks } = createFakeReleaseTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', installation_type: null }],
      phases: [],
      bookings: [],
    });

    await releasePhaseTwoBooking(tx as never, 'lead-1');

    expect(mocks.installationPhase.findUnique).not.toHaveBeenCalled();
    expect(mocks.booking.update).not.toHaveBeenCalled();
  });
});

// ═══ Sekcja 2 — testy integracyjne przez rollbackLogisticsOrder (wpięcie w $transaction) ═══
//
// W przeciwieństwie do Sekcji 1 (jednostkowej), te testy DOWODZĄ, że
// `rollbackLogisticsOrder` faktycznie WOŁA nową funkcję w tej samej transakcji, co
// resztę efektów rollbacku — bez tego wpięcia, Sekcja 1 udowadnia tylko, że
// `releasePhaseTwoBooking` działa w izolacji, nigdy wywoływana z produkcyjnej ścieżki.
// Moduł `rollback-effects` NIE jest tu mockowany — `rollbackLogisticsOrder` woła
// PRAWDZIWĄ (dziś: brakującą) implementację na naszym fake `tx`.

const {
  transactionMock,
  prismaLeadFindUniqueMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  prismaLeadFindUniqueMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: { leady: { findUnique: prismaLeadFindUniqueMock }, $transaction: transactionMock },
  LeadStatus: {
    AWAITING_INSTALLATION: 'AWAITING_INSTALLATION',
    ROLLBACK_RESCHEDULING: 'ROLLBACK_RESCHEDULING',
    HARDWARE_IN_TRANSIT: 'HARDWARE_IN_TRANSIT',
  },
  InstallationStatus: { PLANNED: 'PLANNED', CANCELLED: 'CANCELLED' },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
// `logistics/actions.ts` importuje `shortId` z `@/lib/format-id` (nierozwiązywalne
// bez aliasu `@/*` w vitest.config.mts) — żaden test tego pliku nie asercjonuje pola
// zależnego od `shortId`, ale import musi się rozwiązać, żeby moduł się zaimportował.
vi.mock('@/lib/format-id', () => ({ shortId: (id: string) => `#${id.substring(0, 8)}` }));

type IntInstRow = { id: string; lead_id: string; zespol_id: string | null; data_planowana: Date | null; status: string; installation_type: string | null };
type IntLeadRow = { id: string; status: string; data_rezerwacji: Date | null; logistics_sla_paused_at: Date | null; notatki_wewnetrzne?: string | null; bucket_entered_at?: Date | null };

function createFakeTx(params: {
  instalacje?: IntInstRow[];
  lead: IntLeadRow;
  phases?: FakePhaseRow[];
  bookings?: FakeBookingRow[];
}) {
  const state = {
    instalacje: (params.instalacje ?? []).map((r) => ({ ...r })),
    lead: { ...params.lead },
    phases: (params.phases ?? []).map((r) => ({ ...r })),
    bookings: (params.bookings ?? []).map((r) => ({ ...r })),
  };
  const calls: string[] = [];

  const queryRawMock = vi.fn(async (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    calls.push('queryRaw');
    const sql = Array.isArray(strings) ? strings.join('?') : String(strings);
    if (!/FOR UPDATE/i.test(sql)) {
      throw new Error(`Oczekiwano blokady FOR UPDATE w zapytaniu $queryRaw, otrzymano: ${sql}`);
    }
    const leadId = values[0];
    if (/leady/i.test(sql)) {
      return [{ id: state.lead.id, status: state.lead.status }];
    }
    if (/instalacje/i.test(sql)) {
      return state.instalacje.filter((r) => r.lead_id === leadId && r.status === 'PLANNED').map((r) => ({ id: r.id }));
    }
    if (/bookings/i.test(sql)) {
      const bookingId = values[0];
      return state.bookings.filter((b) => b.id === bookingId).map((b) => ({ id: b.id, status: b.status }));
    }
    return [];
  });

  const instalacjeMock = {
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<IntInstRow> }) => {
      calls.push('instalacje.update');
      const row = state.instalacje.find((r) => r.id === where.id);
      if (!row) throw new Error('instalacja nie znaleziona');
      Object.assign(row, data);
      return { ...row };
    }),
    updateMany: vi.fn(
      async ({ where, data }: { where: { lead_id: string; status?: string }; data: Partial<IntInstRow> }) => {
        calls.push('instalacje.updateMany');
        const rows = state.instalacje.filter((r) => r.lead_id === where.lead_id && (!where.status || r.status === where.status));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    ),
    findMany: vi.fn(async ({ where }: { where: { lead_id: string; installation_type?: string } }) => {
      calls.push('instalacje.findMany');
      return state.instalacje.filter(
        (r) => r.lead_id === where.lead_id && (!where.installation_type || r.installation_type === where.installation_type),
      );
    }),
  };

  const installationPhaseMock = {
    findUnique: vi.fn(
      async ({ where }: { where: { installationId_phaseNumber: { installationId: string; phaseNumber: number } } }) => {
        calls.push('installationPhase.findUnique');
        const key = where.installationId_phaseNumber;
        return (
          state.phases.find((p) => p.installationId === key.installationId && p.phaseNumber === key.phaseNumber) ?? null
        );
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { installationId_phaseNumber: { installationId: string; phaseNumber: number } };
        data: Partial<FakePhaseRow>;
      }) => {
        calls.push('installationPhase.update');
        const key = where.installationId_phaseNumber;
        const row = state.phases.find((p) => p.installationId === key.installationId && p.phaseNumber === key.phaseNumber);
        if (!row) throw new Error('etap nie znaleziony');
        Object.assign(row, data);
        return { ...row };
      },
    ),
    delete: vi.fn(async () => {
      calls.push('installationPhase.delete');
      throw new Error('installationPhase.delete nie powinien być wołany przez rollback');
    }),
  };

  const bookingMock = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      calls.push('booking.findUnique');
      return state.bookings.find((b) => b.id === where.id) ?? null;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeBookingRow> }) => {
      calls.push('booking.update');
      const row = state.bookings.find((b) => b.id === where.id);
      if (!row) throw new Error('rezerwacja nie znaleziona');
      Object.assign(row, data);
      return { ...row };
    }),
  };

  const leadyMock = {
    findUnique: vi.fn(async () => {
      calls.push('leady.findUnique');
      return { ...state.lead };
    }),
    update: vi.fn(async ({ data }: { data: Partial<IntLeadRow> }) => {
      calls.push('leady.update');
      Object.assign(state.lead, data);
      return { ...state.lead };
    }),
  };

  const auditLogMock = {
    create: vi.fn(async () => {
      calls.push('auditLog.create');
      return { id: 'audit-mock' };
    }),
  };
  const notificationQueueMock = { create: vi.fn(async () => ({ id: 'nq-mock' })) };

  const tx = {
    $queryRaw: queryRawMock,
    instalacje: instalacjeMock,
    installationPhase: installationPhaseMock,
    booking: bookingMock,
    leady: leadyMock,
    auditLog: auditLogMock,
    notificationQueue: notificationQueueMock,
  };

  return {
    tx,
    state,
    calls,
    mocks: {
      instalacje: instalacjeMock,
      installationPhase: installationPhaseMock,
      booking: bookingMock,
      leady: leadyMock,
      auditLog: auditLogMock,
      queryRaw: queryRawMock,
    },
  };
}

describe('rollbackLogisticsOrder — wpięcie releasePhaseTwoBooking w tę samą transakcję (FNL-2PHASE-ROLLBACK-RELEASE)', () => {
  beforeEach(() => {
    transactionMock.mockReset();
    prismaLeadFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentUserMock.mockReset();

    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: 'operator@klikklima.pl' } } });
  });

  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('AC2 (integracja): rollback przełącza rezerwację etapu II RESERVED na RELEASED, w tej samej transakcji co zmiana statusu leada', async () => {
    const { tx, state } = createFakeTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', zespol_id: 'crew-1', data_planowana: new Date('2026-09-10'), status: 'PLANNED', installation_type: 'TWO_PHASE' }],
      lead: { id: 'lead-1', status: 'AWAITING_INSTALLATION', data_rezerwacji: new Date('2026-09-10'), logistics_sla_paused_at: null },
      phases: [
        { installationId: 'inst-1', phaseNumber: 1, bookingId: 'booking-1', completedAt: new Date('2026-09-01') },
        { installationId: 'inst-1', phaseNumber: 2, bookingId: 'booking-2', completedAt: null },
      ],
      bookings: [
        { id: 'booking-1', status: 'COMPLETED' },
        { id: 'booking-2', status: 'RESERVED' },
      ],
    });
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    prismaLeadFindUniqueMock.mockResolvedValue({ ...state.lead });

    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');
    const result = await rollbackLogisticsOrder('lead-1', 'przełożenie terminu klienta');

    expect(result).toEqual({ success: true });
    expect(state.bookings.find((b) => b.id === 'booking-2')!.status).toBe('RELEASED');
  });

  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('AC3 (dowód częściowy na dublu): po rollbacku lead nie ma żadnej rezerwacji RESERVED/CONFIRMED z etapu II — pełny dowód (brak SUBJECT_ALREADY_BOOKED na żywym indeksie) jest w fnl-2phase-rollback-release.itest.ts', async () => {
    const { tx, state } = createFakeTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', zespol_id: 'crew-1', data_planowana: new Date('2026-09-10'), status: 'PLANNED', installation_type: 'TWO_PHASE' }],
      lead: { id: 'lead-1', status: 'AWAITING_INSTALLATION', data_rezerwacji: new Date('2026-09-10'), logistics_sla_paused_at: null },
      phases: [{ installationId: 'inst-1', phaseNumber: 2, bookingId: 'booking-2', completedAt: null }],
      bookings: [{ id: 'booking-2', status: 'CONFIRMED' }],
    });
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    prismaLeadFindUniqueMock.mockResolvedValue({ ...state.lead });

    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');
    await rollbackLogisticsOrder('lead-1', 'przełożenie terminu klienta');

    const activeBookings = state.bookings.filter((b) => ['RESERVED', 'CONFIRMED'].includes(b.status));
    expect(activeBookings).toHaveLength(0);
  });

  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('AC6 (integracja): completed_at etapu I przeżywa cały przebieg rollbacku (leady.update + auditLog + releaseCrewSlot + releasePhaseTwoBooking + suspendLogisticsSla)', async () => {
    const completedAtBefore = new Date('2026-09-01T10:00:00Z');
    const { tx, state } = createFakeTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', zespol_id: 'crew-1', data_planowana: new Date('2026-09-10'), status: 'PLANNED', installation_type: 'TWO_PHASE' }],
      lead: { id: 'lead-1', status: 'AWAITING_INSTALLATION', data_rezerwacji: new Date('2026-09-10'), logistics_sla_paused_at: null },
      phases: [
        { installationId: 'inst-1', phaseNumber: 1, bookingId: 'booking-1', completedAt: completedAtBefore },
        { installationId: 'inst-1', phaseNumber: 2, bookingId: 'booking-2', completedAt: null },
      ],
      bookings: [
        { id: 'booking-1', status: 'COMPLETED' },
        { id: 'booking-2', status: 'RESERVED' },
      ],
    });
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    prismaLeadFindUniqueMock.mockResolvedValue({ ...state.lead });

    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');
    const result = await rollbackLogisticsOrder('lead-1', 'przełożenie terminu klienta');

    expect(result).toEqual({ success: true });
    expect(state.phases.find((p) => p.phaseNumber === 1)!.completedAt).toEqual(completedAtBefore);
    expect(state.bookings.find((b) => b.id === 'booking-1')!.status).toBe('COMPLETED');
  });

  // AC5: gałąź idempotentna (lead już w ROLLBACK_RESCHEDULING) musi też wołać
  // releasePhaseTwoBooking (analogicznie do releaseCrewSlot/suspendLogisticsSla,
  // które są już wołane w tej gałęzi) — inaczej lead osierocony inną ścieżką
  // zmiany statusu nigdy nie odzyska zwolnionej rezerwacji etapu II.
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('AC5 (integracja): drugie wywołanie (gałąź ROLLBACK_RESCHEDULING) nie rzuca i nie zmienia już zwolnionej rezerwacji etapu II', async () => {
    const { tx, state, mocks } = createFakeTx({
      instalacje: [{ id: 'inst-1', lead_id: 'lead-1', zespol_id: null, data_planowana: null, status: 'CANCELLED', installation_type: 'TWO_PHASE' }],
      lead: { id: 'lead-1', status: 'ROLLBACK_RESCHEDULING', data_rezerwacji: null, logistics_sla_paused_at: new Date() },
      phases: [{ installationId: 'inst-1', phaseNumber: 2, bookingId: 'booking-2', completedAt: null }],
      bookings: [{ id: 'booking-2', status: 'RELEASED' }],
    });
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    prismaLeadFindUniqueMock.mockResolvedValue({ ...state.lead });

    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');
    const result = await rollbackLogisticsOrder('lead-1', 'przełożenie terminu klienta');

    expect(result).toEqual({ success: true });
    expect(state.bookings.find((b) => b.id === 'booking-2')!.status).toBe('RELEASED');
    expect(mocks.booking.update).not.toHaveBeenCalled();
  });
});
