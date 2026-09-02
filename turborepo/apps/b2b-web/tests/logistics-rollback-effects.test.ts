import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findTransition, SLA, logisticsBand } from '@klikklima/contracts';

/**
 * FNL-ROLLBACK — efekty rollbacku logistyki (`docs/workorders/LOGISTICS-SHIPPING-EFFECTS.md`,
 * Faza A: AC-A1..AC-A7).
 *
 * `releaseCrewSlot(tx, leadId)` (D1) i `suspendLogisticsSla(tx, leadId)` (D2) już
 * istnieją w `logistics/actions.ts`. Reviewer (patrz `docs/workorders/LOGISTICS-SHIPPING-EFFECTS.md`
 * uwagi po review) wykazał mutacją, że dzisiejszy `releaseCrewSlot`:
 *   1) NIE filtruje statusu `instalacje` — blokuje i nadpisuje WSZYSTKIE wiersze
 *      leada, w tym `COMPLETED` (BLOCKER 1, sekcja "releaseCrewSlot(tx, leadId) — D1"
 *      poniżej, test "BLOCKER-1").
 *   2) `rollbackLogisticsOrder` otwiera realną `$transaction` i przekazuje `tx` do
 *      `releaseCrewSlot`/`suspendLogisticsSla` — ale dotychczasowe asercje AC-A1/AC-A3
 *      nie wiązały tego faktu z niczym konkretnym (mutant przenoszący te wywołania
 *      POZA transakcję nadal przechodził wszystkie testy). Sekcja "rollbackLogisticsOrder"
 *      poniżej rozróżnia mocki `prisma.*` (wywołania POZA transakcją) od mocków `tx.*`
 *      wewnątrz `makeTx()` i asercjami wiąże efekty WYŁĄCZNIE z konkretnym obiektem `tx`
 *      utworzonym przez nasz fake `$transaction` (`lastTx`, znacznik `__txId`).
 *
 * `leady.logistics_sla_paused_at` istnieje już w schemacie (potwierdzone przez
 * `contract-steward` w tej samej turze) — modelujemy go w mocku `@repo/database`.
 * `InstallationStatus.CANCELLED` istnieje w `schema.prisma:349` (potwierdzone) —
 * D1 może użyć wariantu podstawowego, bez rozszerzania enuma.
 *
 * Fake `tx`/`prisma` poniżej NIE jest atrapą Prisma w ogólności — jest minimalnym,
 * STANOWYM dublem (in-memory), żeby dało się sprawdzić OBSERWOWALNY SKUTEK
 * (czy wiersz `instalacje` faktycznie wraca do stanu wolnego slotu, czy
 * `logistics_sla_paused_at` faktycznie nie przesuwa się przy powtórce) niezależnie
 * od tego, czy implementacja użyje `update` per wiersz czy `updateMany`. Jedyny
 * DOKŁADNY kształt wołania, którego wymagamy, to `tx.$queryRaw` z `FOR UPDATE`
 * PRZED jakąkolwiek mutacją `instalacje` (D1, dosłowny wymóg WO) — to sprawdzamy
 * po kolejności wpisów w `calls`.
 *
 * Mocki modułowe (`vi.hoisted`/`vi.mock`) są zadeklarowane na poziomie modułu (nie
 * wewnątrz `describe`), żeby uniknąć ostrzeżenia deprecacji vitest o hoistingu.
 */

const {
  prismaLeadFindUniqueMock,
  prismaLeadUpdateMock,
  prismaLeadFindManyMock,
  prismaInstalacjeUpdateMock,
  prismaInstalacjeUpdateManyMock,
  prismaQueryRawMock,
  txLeadUpdateMock,
  txInstalacjeUpdateMock,
  txInstalacjeUpdateManyMock,
  txQueryRawMock,
  txLeadFindUniqueMock,
  transactionMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  // Mocki "poza transakcją" — jeżeli którykolwiek z nich zostanie wywołany z
  // efektami D1/D2, dowodzi to, że kod ucieka poza `$transaction`.
  prismaLeadFindUniqueMock: vi.fn(),
  prismaLeadUpdateMock: vi.fn(),
  prismaLeadFindManyMock: vi.fn(),
  prismaInstalacjeUpdateMock: vi.fn(),
  prismaInstalacjeUpdateManyMock: vi.fn(),
  prismaQueryRawMock: vi.fn(),
  // Mocki "wewnątrz transakcji" — jedyne dozwolone miejsce dla D1/D2.
  txLeadUpdateMock: vi.fn(),
  txInstalacjeUpdateMock: vi.fn(),
  txInstalacjeUpdateManyMock: vi.fn(),
  txQueryRawMock: vi.fn(),
  txLeadFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: { findUnique: prismaLeadFindUniqueMock, update: prismaLeadUpdateMock, findMany: prismaLeadFindManyMock },
    instalacje: { update: prismaInstalacjeUpdateMock, updateMany: prismaInstalacjeUpdateManyMock },
    $queryRaw: prismaQueryRawMock,
    $transaction: transactionMock,
  },
  LeadStatus: {
    HARDWARE_IN_TRANSIT: 'HARDWARE_IN_TRANSIT',
    HARDWARE_IN_WAREHOUSE: 'HARDWARE_IN_WAREHOUSE',
    AWAITING_CREW_ASSIGNMENT: 'AWAITING_CREW_ASSIGNMENT',
    AWAITING_INSTALLATION: 'AWAITING_INSTALLATION',
    ROLLBACK_RESCHEDULING: 'ROLLBACK_RESCHEDULING',
    NEW_LEAD: 'NEW_LEAD',
  },
  InstallationStatus: { PLANNED: 'PLANNED', CANCELLED: 'CANCELLED', IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED' },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — ten plik nie testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser` dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });

type FakeInstallationRow = {
  id: string;
  lead_id: string;
  zespol_id: string | null;
  data_planowana: Date | null;
  status: string;
};

type FakeLeadRow = {
  id: string;
  status: string;
  data_rezerwacji: Date | null;
  logistics_sla_paused_at: Date | null;
  notatki_wewnetrzne?: string | null;
  bucket_entered_at?: Date | null;
};

function createFakeTx(installations: FakeInstallationRow[], lead: FakeLeadRow) {
  const state = {
    instalacje: installations.map((r) => ({ ...r })),
    lead: { ...lead },
  };
  const calls: string[] = [];

  const queryRawMock = vi.fn(async (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    calls.push('queryRaw');
    const sql = Array.isArray(strings) ? strings.join('?') : String(strings);
    if (!/FOR UPDATE/i.test(sql)) {
      throw new Error(`Oczekiwano blokady FOR UPDATE w zapytaniu $queryRaw, otrzymano: ${sql}`);
    }
    const leadId = values[0];
    // Wspieramy oba warianty implementacji D1: blokadę WSZYSTKICH wierszy leada
    // (dzisiejszy, błędny) i blokadę tylko wierszy PLANNED (docelowy, po fixie —
    // wykrywana po literale statusu w tekście zapytania).
    const onlyPlanned = /'PLANNED'/.test(sql) || /status\s*=\s*\$/i.test(sql) === false ? /PLANNED/.test(sql) : false;
    return state.instalacje
      .filter((r) => r.lead_id === leadId && (!onlyPlanned || r.status === 'PLANNED'))
      .map((r) => ({ id: r.id }));
  });

  const instalacjeMock = {
    findMany: vi.fn(async ({ where }: { where: { lead_id: string; status?: string } }) => {
      calls.push('instalacje.findMany');
      return state.instalacje.filter(
        (r) => r.lead_id === where.lead_id && (!where.status || r.status === where.status),
      );
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeInstallationRow> }) => {
      calls.push('instalacje.update');
      const row = state.instalacje.find((r) => r.id === where.id);
      if (!row) throw new Error('instalacja nie znaleziona');
      Object.assign(row, data);
      return { ...row };
    }),
    updateMany: vi.fn(
      async ({ where, data }: { where: { lead_id: string; status?: string }; data: Partial<FakeInstallationRow> }) => {
        calls.push('instalacje.updateMany');
        const rows = state.instalacje.filter(
          (r) => r.lead_id === where.lead_id && (!where.status || r.status === where.status),
        );
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    ),
  };

  const leadyMock = {
    findUnique: vi.fn(async () => {
      calls.push('leady.findUnique');
      return { ...state.lead };
    }),
    update: vi.fn(async ({ data }: { data: Partial<FakeLeadRow> }) => {
      calls.push('leady.update');
      Object.assign(state.lead, data);
      return { ...state.lead };
    }),
    updateMany: vi.fn(
      async ({ where, data }: { where: { id: string; logistics_sla_paused_at?: null }; data: Partial<FakeLeadRow> }) => {
        calls.push('leady.updateMany');
        if ('logistics_sla_paused_at' in where && where.logistics_sla_paused_at === null && state.lead.logistics_sla_paused_at !== null) {
          return { count: 0 };
        }
        Object.assign(state.lead, data);
        return { count: 1 };
      },
    ),
  };

  const tx = {
    $queryRaw: queryRawMock,
    instalacje: instalacjeMock,
    leady: leadyMock,
  };

  return { tx, state, calls, mocks: { instalacje: instalacjeMock, leady: leadyMock, queryRaw: queryRawMock } };
}

describe('releaseCrewSlot(tx, leadId) — D1 (FNL-ROLLBACK)', () => {
  // @REQ: FNL-ROLLBACK
  it('zwalnia wszystkie wiersze PLANNED danego leada: zespol_id=null, data_planowana=null, status=CANCELLED', async () => {
    const { releaseCrewSlot } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, state } = createFakeTx(
      [
        { id: 'inst-1', lead_id: 'lead-1', zespol_id: 'crew-1', data_planowana: new Date('2026-09-10'), status: 'PLANNED' },
      ],
      { id: 'lead-1', status: 'HARDWARE_IN_TRANSIT', data_rezerwacji: new Date('2026-09-10'), logistics_sla_paused_at: null },
    );

    await releaseCrewSlot(tx as never, 'lead-1');

    const row = state.instalacje.find((r) => r.id === 'inst-1')!;
    expect(row.zespol_id).toBeNull();
    expect(row.data_planowana).toBeNull();
    expect(row.status).toBe('CANCELLED');
  });

  // BLOCKER 1 (review LOGISTICS-SHIPPING-EFFECTS, Faza A): WO D1 wymaga wyraźnie
  // "dla wszystkich wierszy `instalacje` danego leada o statusie `PLANNED`". Reviewer
  // zweryfikował mutacją, że dzisiejszy kod zwalnia WSZYSTKIE wiersze leada, w tym
  // `COMPLETED` — co kasowałoby ukończone montaże. Ten test musi dziś PAŚĆ (RED
  // czekający na fix od implementer-server): `tx.$queryRaw` dzisiejszego kodu nie
  // filtruje statusu w SQL, więc zablokuje i nadpisze OBA wiersze.
  // @REQ: FNL-ROLLBACK
  it('BLOCKER-1: zwalnia WYŁĄCZNIE wiersze PLANNED — wiersz COMPLETED pozostaje kompletnie nietknięty', async () => {
    const { releaseCrewSlot } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const completedRowBefore = {
      id: 'inst-completed',
      lead_id: 'lead-1',
      zespol_id: 'crew-2',
      data_planowana: new Date('2026-08-01'),
      status: 'COMPLETED',
    };
    const { tx, state, mocks } = createFakeTx(
      [
        { id: 'inst-planned', lead_id: 'lead-1', zespol_id: 'crew-1', data_planowana: new Date('2026-09-10'), status: 'PLANNED' },
        { ...completedRowBefore },
      ],
      { id: 'lead-1', status: 'HARDWARE_IN_TRANSIT', data_rezerwacji: new Date('2026-09-10'), logistics_sla_paused_at: null },
    );

    await releaseCrewSlot(tx as never, 'lead-1');

    // update() (per-wiersz) nie może NIGDY zostać wywołane z where.id wiersza COMPLETED.
    const updatedIdsViaUpdate = mocks.instalacje.update.mock.calls.map((c) => (c[0] as { where: { id: string } }).where.id);
    expect(updatedIdsViaUpdate).toContain('inst-planned');
    expect(updatedIdsViaUpdate).not.toContain('inst-completed');

    // updateMany() (wariant zbiorczy) też nie może objąć wiersza COMPLETED — sprawdzamy
    // przez efekt: wiersz COMPLETED musi pozostać bit-w-bit identyczny jak przed wywołaniem.
    const completedRowAfter = state.instalacje.find((r) => r.id === 'inst-completed')!;
    expect(completedRowAfter).toEqual(completedRowBefore);

    const plannedRowAfter = state.instalacje.find((r) => r.id === 'inst-planned')!;
    expect(plannedRowAfter.status).toBe('CANCELLED');
    expect(plannedRowAfter.zespol_id).toBeNull();
  });

  // AC-A2: ta sama ekipa musi zostać naprawdę zwolniona (nie tylko oznaczona), żeby
  // druga rezerwacja na tę samą datę mogła powstać.
  // @REQ: FNL-ROLLBACK
  it('AC-A2: po zwolnieniu slot jest realnie wolny — nowy wiersz instalacje tej samej ekipy/daty dla innego leada nie koliduje', async () => {
    const { releaseCrewSlot } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, state } = createFakeTx(
      [{ id: 'inst-1', lead_id: 'lead-1', zespol_id: 'crew-1', data_planowana: new Date('2026-09-10'), status: 'PLANNED' }],
      { id: 'lead-1', status: 'HARDWARE_IN_TRANSIT', data_rezerwacji: new Date('2026-09-10'), logistics_sla_paused_at: null },
    );

    await releaseCrewSlot(tx as never, 'lead-1');

    // Slot "realnie wolny" = żaden wiersz instalacje tej ekipy na tę datę nie ma
    // już statusu PLANNED — nic nie blokuje przypisania crew-1/2026-09-10 do innego leada.
    const stillBlocking = state.instalacje.some(
      (r) => r.zespol_id === 'crew-1' && r.status === 'PLANNED',
    );
    expect(stillBlocking).toBe(false);
  });

  // Blokada D1: SELECT ... FOR UPDATE musi poprzedzić jakąkolwiek mutację instalacje.
  // @REQ: FNL-ROLLBACK
  it('wywołuje tx.$queryRaw z FOR UPDATE na instalacje PRZED jakąkolwiek mutacją', async () => {
    const { releaseCrewSlot } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, calls } = createFakeTx(
      [{ id: 'inst-1', lead_id: 'lead-1', zespol_id: 'crew-1', data_planowana: new Date(), status: 'PLANNED' }],
      { id: 'lead-1', status: 'HARDWARE_IN_TRANSIT', data_rezerwacji: new Date(), logistics_sla_paused_at: null },
    );

    await releaseCrewSlot(tx as never, 'lead-1');

    expect(tx.$queryRaw).toHaveBeenCalled();
    const lockIndex = calls.indexOf('queryRaw');
    const mutationIndex = calls.findIndex((c) => c === 'instalacje.update' || c === 'instalacje.updateMany');
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(mutationIndex).toBeGreaterThan(lockIndex);
  });

  // Idempotencja: drugie zwolnienie już zwolnionego slotu nie zmienia wiersza i nie rzuca.
  // @REQ: FNL-ROLLBACK
  it('druga próba zwolnienia już zwolnionego slotu kończy się bez błędu i bez zmiany wiersza', async () => {
    const { releaseCrewSlot } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, state } = createFakeTx(
      [{ id: 'inst-1', lead_id: 'lead-1', zespol_id: null, data_planowana: null, status: 'CANCELLED' }],
      { id: 'lead-1', status: 'ROLLBACK_RESCHEDULING', data_rezerwacji: null, logistics_sla_paused_at: new Date() },
    );

    await expect(releaseCrewSlot(tx as never, 'lead-1')).resolves.not.toThrow();

    const row = state.instalacje.find((r) => r.id === 'inst-1')!;
    expect(row).toEqual({ id: 'inst-1', lead_id: 'lead-1', zespol_id: null, data_planowana: null, status: 'CANCELLED' });
  });

  // Przypadek brzegowy: lead bez wiersza instalacje (rollback z HARDWARE_IN_WAREHOUSE,
  // ekipy nigdy nie przypisano) — nie może rzucić.
  // @REQ: FNL-ROLLBACK
  it('lead bez żadnego wiersza instalacje nie powoduje wyjątku', async () => {
    const { releaseCrewSlot } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx } = createFakeTx([], {
      id: 'lead-2',
      status: 'HARDWARE_IN_WAREHOUSE',
      data_rezerwacji: null,
      logistics_sla_paused_at: null,
    });

    await expect(releaseCrewSlot(tx as never, 'lead-2')).resolves.not.toThrow();
  });
});

describe('suspendLogisticsSla(tx, leadId) — D2 (FNL-ROLLBACK)', () => {
  // @REQ: FNL-ROLLBACK
  it('ustawia logistics_sla_paused_at (gdy było null) i zeruje data_rezerwacji', async () => {
    const { suspendLogisticsSla } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const before = new Date();
    const { tx, state } = createFakeTx([], {
      id: 'lead-1',
      status: 'HARDWARE_IN_TRANSIT',
      data_rezerwacji: new Date('2026-09-03'),
      logistics_sla_paused_at: null,
    });

    await suspendLogisticsSla(tx as never, 'lead-1');

    expect(state.lead.logistics_sla_paused_at).not.toBeNull();
    expect((state.lead.logistics_sla_paused_at as Date).getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(state.lead.data_rezerwacji).toBeNull();
  });

  // AC-A5: powtórny rollback nie przesuwa stempla.
  // @REQ: FNL-ROLLBACK
  it('AC-A5: wywołane drugi raz nie przesuwa już ustawionego logistics_sla_paused_at', async () => {
    const { suspendLogisticsSla } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const firstStamp = new Date('2026-09-01T10:00:00Z');
    const { tx, state } = createFakeTx([], {
      id: 'lead-1',
      status: 'ROLLBACK_RESCHEDULING',
      data_rezerwacji: null,
      logistics_sla_paused_at: firstStamp,
    });

    await suspendLogisticsSla(tx as never, 'lead-1');

    expect(state.lead.logistics_sla_paused_at).toEqual(firstStamp);
  });

  // Przypadek brzegowy: data_rezerwacji już null.
  // @REQ: FNL-ROLLBACK
  it('lead z data_rezerwacji już null nie powoduje wyjątku i ustawia stempel', async () => {
    const { suspendLogisticsSla } = await import('../src/app/(dashboard)/logistics/rollback-effects');
    const { tx, state } = createFakeTx([], {
      id: 'lead-1',
      status: 'HARDWARE_IN_WAREHOUSE',
      data_rezerwacji: null,
      logistics_sla_paused_at: null,
    });

    await expect(suspendLogisticsSla(tx as never, 'lead-1')).resolves.not.toThrow();
    expect(state.lead.logistics_sla_paused_at).not.toBeNull();
  });

  // Strefa czasowa: stempel jest timestamptz — porównanie musi przetrwać zmianę
  // czasu (Europe/Warsaw, przejście na czas zimowy 2026-10-25).
  // @REQ: FNL-ROLLBACK
  it('stempel przechowuje moment absolutny niezależny od strefy — porównanie działa w dniu zmiany czasu w Europe/Warsaw', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T00:30:00Z')); // noc zmiany czasu w Europe/Warsaw
    try {
      const { suspendLogisticsSla } = await import('../src/app/(dashboard)/logistics/rollback-effects');
      const { tx, state } = createFakeTx([], {
        id: 'lead-1',
        status: 'HARDWARE_IN_TRANSIT',
        data_rezerwacji: new Date('2026-10-26'),
        logistics_sla_paused_at: null,
      });

      await suspendLogisticsSla(tx as never, 'lead-1');

      expect(state.lead.logistics_sla_paused_at?.toISOString()).toBe(new Date('2026-10-25T00:30:00Z').toISOString());
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('rollbackLogisticsOrder — wpięcie releaseCrewSlot + suspendLogisticsSla w jedną transakcję (FNL-ROLLBACK)', () => {
  // Referencja do `tx` faktycznie stworzonego przez nasz fake `$transaction` w bieżącym
  // teście — jedyny sposób, żeby dowieść (BLOCKER 2), że WSZYSTKIE efekty D1/D2 trafiły
  // do TEGO SAMEGO obiektu transakcyjnego, a nie na `prisma` bezpośrednio / po zamknięciu
  // transakcji. Znacznik `__txId` jest tylko czytelnym potwierdzeniem — realny dowód to
  // porównanie `mock.contexts` (this-binding wywołania) z `lastTx.leady`/`lastTx.instalacje`.
  let lastTx: { __txId: string; leady: unknown; instalacje: unknown; $queryRaw: unknown } | null = null;

  function makeTx() {
    lastTx = {
      __txId: 'the-one-transaction',
      leady: { findUnique: txLeadFindUniqueMock, update: txLeadUpdateMock },
      instalacje: { update: txInstalacjeUpdateMock, updateMany: txInstalacjeUpdateManyMock },
      $queryRaw: txQueryRawMock,
    };
    return lastTx;
  }

  beforeEach(() => {
    lastTx = null;
    prismaLeadFindUniqueMock.mockReset();
    prismaLeadUpdateMock.mockReset();
    prismaLeadFindManyMock.mockReset();
    prismaInstalacjeUpdateMock.mockReset();
    prismaInstalacjeUpdateManyMock.mockReset();
    prismaQueryRawMock.mockReset();
    txLeadFindUniqueMock.mockReset();
    txLeadUpdateMock.mockReset();
    txInstalacjeUpdateMock.mockReset();
    txInstalacjeUpdateManyMock.mockReset();
    txQueryRawMock.mockReset();
    transactionMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();

    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx()));
    prismaLeadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'HARDWARE_IN_TRANSIT', data_rezerwacji: new Date(), logistics_sla_paused_at: null });
    txLeadUpdateMock.mockResolvedValue({});
    txLeadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'HARDWARE_IN_TRANSIT', data_rezerwacji: new Date(), logistics_sla_paused_at: null });
    txQueryRawMock.mockResolvedValue([{ id: 'inst-1' }]);
    txInstalacjeUpdateMock.mockResolvedValue({});
    txInstalacjeUpdateManyMock.mockResolvedValue({ count: 1 });
  });

  // AC-A1: jedna transakcja obejmuje zmianę statusu leada i zwolnienie slotu, a
  // WSZYSTKIE wywołania trafiają do tego samego `tx` (BLOCKER 2) — nie do `prisma`
  // bezpośrednio.
  // @REQ: FNL-ROLLBACK
  it('AC-A1: wykonuje zmianę statusu leada i zwolnienie instalacje w jednej $transaction, wyłącznie na obiekcie tx', async () => {
    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    const result = await rollbackLogisticsOrder('lead-1', 'uszkodzona paczka');

    expect(result).toEqual({ success: true });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(lastTx).not.toBeNull();
    expect(lastTx?.__txId).toBe('the-one-transaction');

    expect(txLeadUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ROLLBACK_RESCHEDULING' }) }),
    );
    // BLOCKER 2 — dowód wiązania: `this` (kontekst wywołania) każdego wołania musi
    // być DOKŁADNIE `lastTx.leady`/`lastTx.instalacje`, czyli metoda musiała zostać
    // wywołana jako `tx.leady.update(...)` / `tx.instalacje.update(...)`, a nie jako
    // `prisma.leady.update(...)` po zamknięciu transakcji (te dwa obiekty są celowo
    // RÓŻNYMI referencjami mimo tej samej nazwy pola).
    txLeadUpdateMock.mock.contexts.forEach((ctx) => {
      expect(ctx).toBe((lastTx as NonNullable<typeof lastTx>).leady);
    });
    expect(prismaLeadUpdateMock).not.toHaveBeenCalled();

    const releasedInstalacje =
      txInstalacjeUpdateMock.mock.calls.some((c) => (c[0] as { data?: { zespol_id?: unknown; status?: unknown } })?.data?.zespol_id === null && (c[0] as { data?: { zespol_id?: unknown; status?: unknown } })?.data?.status === 'CANCELLED') ||
      txInstalacjeUpdateManyMock.mock.calls.some((c) => (c[0] as { data?: { zespol_id?: unknown; status?: unknown } })?.data?.zespol_id === null && (c[0] as { data?: { zespol_id?: unknown; status?: unknown } })?.data?.status === 'CANCELLED');
    expect(releasedInstalacje).toBe(true);
    expect(prismaInstalacjeUpdateMock).not.toHaveBeenCalled();
    expect(prismaInstalacjeUpdateManyMock).not.toHaveBeenCalled();

    txInstalacjeUpdateMock.mock.contexts.forEach((ctx) => {
      expect(ctx).toBe((lastTx as NonNullable<typeof lastTx>).instalacje);
    });
  });

  // AC-A1 (część 2): suspendLogisticsSla wywołane w tej samej transakcji, na tym
  // samym obiekcie tx.
  // @REQ: FNL-ROLLBACK
  it('AC-A1: wstrzymuje SLA logistyczne (logistics_sla_paused_at ustawiony, data_rezerwacji=null) na obiekcie tx, nie na prisma bezpośrednio', async () => {
    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    await rollbackLogisticsOrder('lead-1', 'uszkodzona paczka');

    const suspendCall = txLeadUpdateMock.mock.calls.find(
      (c) => (c[0] as { data?: { logistics_sla_paused_at?: unknown; data_rezerwacji?: unknown } })?.data?.logistics_sla_paused_at !== undefined || (c[0] as { data?: { logistics_sla_paused_at?: unknown; data_rezerwacji?: unknown } })?.data?.data_rezerwacji === null,
    );
    expect(suspendCall).toBeDefined();
    expect((suspendCall?.[0] as { data?: { data_rezerwacji?: unknown } })?.data?.data_rezerwacji).toBeNull();
    // suspendLogisticsSla czyta lead przez tx.leady.findUnique (D2), nigdy przez prisma.leady.findUnique
    // (to jedyne dozwolone `findUnique` poza transakcją to sprawdzenie WSTĘPNE w rollbackLogisticsOrder,
    // zanim `$transaction` w ogóle się otworzy).
    expect(txLeadFindUniqueMock).toHaveBeenCalled();
    expect(prismaLeadUpdateMock).not.toHaveBeenCalled();
  });

  // BLOCKER 2 / AC-A3: awaria wewnątrz transakcji nie może zostawić stanu pośredniego.
  // Fake `$transaction` poniżej NAPRAWDĘ implementuje semantykę rollbacku: zmiany
  // zlecone przez `tx.leady.update` trafiają do bufora i są committowane do
  // `realState` DOPIERO gdy cały callback zakończy się bez wyjątku. `prisma.leady.update`
  // (poza transakcją) — dla kontrastu — pisze do `realState` NATYCHMIAST, bez bufora,
  // żeby mutant przenoszący efekty poza `$transaction` był wykrywalny: jego zapis
  // przetrwałby mimo późniejszego błędu.
  // @REQ: FNL-ROLLBACK
  it('AC-A3: awaria update na instalacje cofa całą transakcję — status leada pozostaje sprzed rollbacku, bez stanu pośredniego', async () => {
    const realState: { status: string; data_rezerwacji: Date | null; logistics_sla_paused_at: Date | null } = {
      status: 'HARDWARE_IN_TRANSIT',
      data_rezerwacji: new Date('2026-09-03'),
      logistics_sla_paused_at: null,
    };

    prismaLeadFindUniqueMock.mockImplementation(async () => ({ id: 'lead-1', ...realState }));
    // Zapis "poza transakcją" — natychmiastowy, bez bufora (reprezentuje ucieczkę spod ochrony $transaction).
    prismaLeadUpdateMock.mockImplementation(async ({ data }: { data: Partial<typeof realState> }) => {
      Object.assign(realState, data);
      return { id: 'lead-1', ...realState };
    });

    txInstalacjeUpdateMock.mockRejectedValue(new Error('constraint violation'));
    txInstalacjeUpdateManyMock.mockRejectedValue(new Error('constraint violation'));

    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const buffer: Array<() => void> = [];
      const tx = makeTx();
      txLeadUpdateMock.mockImplementation(async ({ data }: { data: Partial<typeof realState> }) => {
        buffer.push(() => Object.assign(realState, data));
        return { id: 'lead-1', ...realState };
      });
      // Emuluje semantykę Prisma $transaction: zmiany bufora trafiają do stanu
      // realnego TYLKO jeśli callback nie rzucił (COMMIT); wyjątek odrzuca bufor
      // (ROLLBACK) i propaguje się do wywołującego bez żadnego częściowego zapisu.
      const result = await cb(tx);
      buffer.forEach((apply) => apply());
      return result;
    });

    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    const result = await rollbackLogisticsOrder('lead-1', 'uszkodzona paczka');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    // Dowód braku stanu pośredniego: mimo że tx.leady.update (zmiana statusu) zdążyło
    // się wykonać PRZED wyjątkiem z instalacje.update, bufor nigdy nie został
    // scommitowany do realState — status pozostaje sprzed rollbacku.
    expect(realState.status).toBe('HARDWARE_IN_TRANSIT');
    expect(realState.data_rezerwacji).toEqual(new Date('2026-09-03'));
    expect(realState.logistics_sla_paused_at).toBeNull();
  });

  // AC-A5 / idempotencja: dwa wywołania pod rząd dają success:true. Kluczowe dla
  // tego testu (BLOCKER review rundy 2): DRUGIE wywołanie musi faktycznie trafić
  // w gałąź idempotentną `freshLead.status === ROLLBACK_RESCHEDULING` wewnątrz
  // `$transaction` — to znaczy, że TAKŻE `txLeadFindUniqueMock` (odczyt WEWNĄTRZ
  // transakcji), nie tylko `prismaLeadFindUniqueMock` (sprawdzenie wstępne PRZED
  // transakcją), musi zwracać `ROLLBACK_RESCHEDULING` przed drugim wywołaniem.
  // Dowodzimy DWÓCH rzeczy: (1) gałąź idempotentna NIE jest martwym kodem — nadal
  // zwalnia osierocony slot (`txQueryRawMock`/`txInstalacjeUpdateMock` muszą zostać
  // wywołane), (2) stempel `logistics_sla_paused_at` się nie przesuwa — jeśli
  // `tx.leady.update` dostaje ten klucz w danych, musi to być DOKŁADNIE ten sam
  // stempel co przed drugim wywołaniem, nigdy nowy `Date`.
  // @REQ: FNL-ROLLBACK
  it('AC-A5: drugie wywołanie (gałąź ROLLBACK_RESCHEDULING) zwraca success:true, nadal zwalnia osierocony slot i nie przesuwa stempla SLA', async () => {
    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    const first = await rollbackLogisticsOrder('lead-1', 'uszkodzona paczka');
    expect(first).toEqual({ success: true });

    // Lead jest już w ROLLBACK_RESCHEDULING (z pierwszego rollbacku albo z innej
    // ścieżki zmiany statusu, która nie zwolniła slotu) — ustalamy stały stempel
    // sprzed tego wywołania, żeby móc wykryć jego ewentualne przesunięcie.
    const fixedStamp = new Date('2026-09-01T10:00:00Z');
    const freshLeadState = {
      id: 'lead-1',
      status: 'ROLLBACK_RESCHEDULING',
      data_rezerwacji: null,
      logistics_sla_paused_at: fixedStamp,
    };
    prismaLeadFindUniqueMock.mockResolvedValue({ ...freshLeadState });
    // To jest DECYDUJĄCA różnica względem wersji sprzed poprawki: bez nadpisania
    // txLeadFindUniqueMock (odczyt WEWNĄTRZ `$transaction`) drugie wywołanie leci
    // zwykłą gałęzią przejścia (bo `tx` w beforeEach wciąż zwraca HARDWARE_IN_TRANSIT),
    // a gałąź idempotentna nigdy nie zostaje wykonana — co pozwoliłoby jej być
    // martwym kodem (np. z `throw` jako pierwszą instrukcją) bez wykrycia.
    txLeadFindUniqueMock.mockResolvedValue({ ...freshLeadState });
    // Osierocony wiersz PLANNED nadal czeka na zwolnienie — symulujemy, że lead
    // trafił do ROLLBACK_RESCHEDULING inną ścieżką niż `rollbackLogisticsOrder`.
    txQueryRawMock.mockClear();
    txInstalacjeUpdateMock.mockClear();
    txLeadUpdateMock.mockClear();
    txQueryRawMock.mockResolvedValue([{ id: 'inst-orphan' }]);

    const second = await rollbackLogisticsOrder('lead-1', 'uszkodzona paczka');

    expect(second).toEqual({ success: true });

    // (1) Gałąź idempotentna faktycznie wykonała efekty D1/D2 — nie jest martwym kodem.
    expect(txQueryRawMock).toHaveBeenCalled();
    expect(txInstalacjeUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inst-orphan' } }),
    );

    // (2) Stempel SLA się nie przesunął: jeśli suspendLogisticsSla wywołało
    // tx.leady.update z logistics_sla_paused_at w danych, to WYŁĄCZNIE ze
    // stemplem identycznym jak przed drugim wywołaniem — nigdy z nowym `Date`.
    const slaCalls = txLeadUpdateMock.mock.calls.filter(
      (c) => (c[0] as { data?: { logistics_sla_paused_at?: unknown } })?.data?.logistics_sla_paused_at !== undefined,
    );
    expect(slaCalls.length).toBeGreaterThan(0);
    slaCalls.forEach((c) => {
      expect((c[0] as { data: { logistics_sla_paused_at: Date } }).data.logistics_sla_paused_at).toEqual(fixedStamp);
    });
  });

  // AC-A6: blokada FOR UPDATE — sprawdzenie że zapytanie istnieje (prawdziwa
  // współbieżność nie jest testowalna bez żywej bazy, patrz WO). Musi trafić na tx,
  // nie na prisma bezpośrednio.
  // @REQ: FNL-ROLLBACK
  it('AC-A6: rollback używa tx.$queryRaw z FOR UPDATE na instalacje (blokada wiersza)', async () => {
    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    await rollbackLogisticsOrder('lead-1', 'uszkodzona paczka');

    expect(txQueryRawMock).toHaveBeenCalled();
    expect(prismaQueryRawMock).not.toHaveBeenCalled();
    // Nie wymagamy KTÓREGO wywołania $queryRaw w kolejności — implementacja może
    // dodać wcześniejszą blokadę `FOR UPDATE` na `leady` (naprawa wyścigu między
    // dwoma równoległymi rollbackami tego samego leada), byle blokada na
    // `instalacje` nadal istniała GDZIEŚ wśród wywołań.
    const hasInstalacjeLock = txQueryRawMock.mock.calls.some((call) => {
      const sql = call[0];
      const sqlText = Array.isArray(sql) ? sql.join('?') : String(sql);
      return /FOR UPDATE/i.test(sqlText) && /instalacje/i.test(sqlText);
    });
    expect(hasInstalacjeLock).toBe(true);
  });

  // Blokada leada (D-lock leady, dosłowny wymóg WO): `rollbackLogisticsOrder`
  // musi zablokować wiersz `leady` wierszem `SELECT ... FOR UPDATE` jako
  // PIERWSZĄ instrukcją transakcji, PRZED odczytem `tx.leady.findUnique`
  // ("ponowny odczyt statusu na wierszu już zablokowanym powyżej" — patrz
  // komentarz w `actions.ts` tuż nad `tx.leady.findUnique`). Sama obecność
  // blokady nie wystarcza (patrz test AC-A6 powyżej, który celowo nie
  // wymaga kolejności) — usunięcie blokady albo przesunięcie jej ZA
  // `findUnique` obezwładnia ochronę przed wyścigiem dwóch równoległych
  // rollbacków tego samego leada i musi zostać wykryte tutaj.
  // @REQ: FNL-ROLLBACK
  it('BLOKADA-LEADY: pierwsze wywołanie tx.$queryRaw blokuje wiersz leady (FOR UPDATE) PRZED tx.leady.findUnique', async () => {
    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    await rollbackLogisticsOrder('lead-1', 'uszkodzona paczka');

    expect(txQueryRawMock).toHaveBeenCalled();
    expect(txLeadFindUniqueMock).toHaveBeenCalled();

    // Kształt zapytania: pierwsze wywołanie $queryRaw musi dotyczyć TABELI leady
    // i zawierać blokadę FOR UPDATE (ten sam wzorzec sprawdzania treści SQL co
    // w asercji `hasInstalacjeLock` powyżej, zastosowany do PIERWSZEGO wywołania).
    const firstCallArgs = txQueryRawMock.mock.calls[0];
    const firstSql = firstCallArgs[0];
    const firstSqlText = Array.isArray(firstSql) ? firstSql.join('?') : String(firstSql);
    expect(firstSqlText).toMatch(/FOR UPDATE/i);
    expect(firstSqlText).toMatch(/leady/i);

    // Kolejność: blokada na leady (pierwsze wywołanie $queryRaw) musi zajść
    // PRZED odczytem pełnego obiektu leada (pierwsze wywołanie findUnique)
    // — inaczej `findUnique` czyta wiersz jeszcze niezablokowany i dwa
    // równoległe rollbacki mogą oba przejść sprawdzenie na tym samym,
    // nieaktualnym statusie. `invocationCallOrder` porównuje globalną
    // kolejność wywołań WSZYSTKICH mocków vitest, więc mniejsza wartość
    // oznacza wcześniejsze wywołanie w czasie.
    const lockCallOrder = txQueryRawMock.mock.invocationCallOrder[0];
    const readCallOrder = txLeadFindUniqueMock.mock.invocationCallOrder[0];
    expect(lockCallOrder).toBeLessThan(readCallOrder);
  });

  // AC-A7: bez shipments.update — odmowa PRZED jakimkolwiek zapisem, w tym przed
  // releaseCrewSlot/suspendLogisticsSla.
  // @REQ: FNL-ROLLBACK
  it('AC-A7: rola bez shipments.update dostaje success:false i nie wykonuje żadnego zapisu (status, slot, SLA)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    const result = await rollbackLogisticsOrder('lead-1', 'uszkodzona paczka');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(transactionMock).not.toHaveBeenCalled();
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
    expect(txInstalacjeUpdateMock).not.toHaveBeenCalled();
    expect(txInstalacjeUpdateManyMock).not.toHaveBeenCalled();
    expect(txQueryRawMock).not.toHaveBeenCalled();
    expect(prismaLeadUpdateMock).not.toHaveBeenCalled();
  });

  // R5: rollback musi wyznaczyć KONKRETNE przejście przez findTransition(from, 'rollback')
  // — lead w stanie spoza T10-T13 (np. NEW_LEAD) ma być odrzucony.
  // @REQ: FNL-ROLLBACK
  it('R5: lead w stanie NEW_LEAD (poza zakresem T10-T13) jest odrzucony, findTransition nie znajduje przejścia', async () => {
    expect(findTransition('NEW_LEAD', 'rollback')).toBeUndefined();
    prismaLeadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'NEW_LEAD', data_rezerwacji: null, logistics_sla_paused_at: null });

    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    const result = await rollbackLogisticsOrder('lead-1', 'powod');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // R5: cztery stany źródłowe T10-T13 muszą zostać rozpoznane przez findTransition.
  // @REQ: FNL-ROLLBACK
  it.each(['AWAITING_CREW_ASSIGNMENT', 'HARDWARE_IN_WAREHOUSE', 'HARDWARE_IN_TRANSIT', 'AWAITING_INSTALLATION'])(
    'R5: lead w stanie %s (w zakresie T10-T13) ma przejście "rollback" w kontrakcie do ROLLBACK_RESCHEDULING',
    (status) => {
      const transition = findTransition(status as never, 'rollback');
      expect(transition?.to).toBe('ROLLBACK_RESCHEDULING');
      expect(transition?.effects).toEqual(
        expect.arrayContaining(['do:releaseCrewSlot', 'do:suspendLogisticsSla']),
      );
    },
  );
});

describe('AC-A4 — po rollbacku lead nie ma pasma SLA logistyki (SLA-LOG-COLORS, FNL-ROLLBACK)', () => {
  beforeEach(() => {
    prismaLeadFindManyMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
  });

  // Wywołujemy PRAWDZIWĄ logikę produkcyjną (`getLogisticsLeads`), nie liczymy
  // `daysToInstall` we własnym teście — inaczej test jest tautologią (poprzednia
  // wersja liczyła wynik ręcznie zamiast wołać kod, który ma to liczyć).
  // @REQ: FNL-ROLLBACK
  it('getLogisticsLeads liczy daysToInstall=null dla leada z data_rezerwacji=null (stan po suspendLogisticsSla)', async () => {
    expect(SLA.LOGISTICS_INSTALL.metric).toBe('daysUntilInstallation');

    prismaLeadFindManyMock.mockResolvedValue([
      {
        id: 'lead-1',
        status: 'ROLLBACK_RESCHEDULING',
        data_rezerwacji: null, // ustawione przez suspendLogisticsSla podczas rollbacku
        odpowiedzi_triage: {},
        klient: { imie_i_nazwisko: 'Jan Kowalski' },
        adres: { ulica_miasto: 'Testowa 1, Warszawa' },
        logistyka_zamowienia: [],
      },
    ]);

    const { getLogisticsLeads } = await import('../src/app/(dashboard)/logistics/actions');
    const result = await getLogisticsLeads();

    expect(Array.isArray(result)).toBe(true);
    const leads = result as Array<{ daysToInstall: number | null; installationDate: string | null }>;
    expect(leads).toHaveLength(1);
    expect(leads[0].daysToInstall).toBeNull();
    expect(leads[0].installationDate).toBeNull();
  });

  // Kontrast: ten sam kontrakt SLA dla leada Z datą rezerwacji (sprzed rollbacku)
  // faktycznie wpadłby w pasmo CRITICAL — dowodzi to, że dopiero wyzerowanie
  // `data_rezerwacji` (efekt suspendLogisticsSla) usuwa lead z pasma krytycznego.
  // @REQ: FNL-ROLLBACK
  it('kontrast: lead z data_rezerwacji za 1 dzień (przed rollbackiem) wpada w pasmo CRITICAL wg kontraktu', async () => {
    prismaLeadFindManyMock.mockResolvedValue([
      {
        id: 'lead-1',
        status: 'HARDWARE_IN_TRANSIT',
        data_rezerwacji: (() => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          return d;
        })(),
        odpowiedzi_triage: {},
        klient: { imie_i_nazwisko: 'Jan Kowalski' },
        adres: { ulica_miasto: 'Testowa 1, Warszawa' },
        logistyka_zamowienia: [],
      },
    ]);

    const { getLogisticsLeads } = await import('../src/app/(dashboard)/logistics/actions');
    const result = await getLogisticsLeads();
    const leads = result as Array<{ daysToInstall: number | null }>;

    expect(leads[0].daysToInstall).not.toBeNull();
    expect(logisticsBand(leads[0].daysToInstall as number)).toBe('CRITICAL');
  });
});
