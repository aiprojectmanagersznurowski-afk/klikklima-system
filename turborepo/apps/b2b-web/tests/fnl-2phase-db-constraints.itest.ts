import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@repo/database';

/**
 * WO: docs/workorders/FNL-2PHASE-BOOKING-MECHANICS.md — kryteria na poziomie bazy,
 * nietestowalne na atrapie Prismy: AC1 (kształt DB, `installation_phases_phase_number_check`),
 * brzeg 2 (współbieżność tworzenia etapów, `installation_phases_unique_phase`), brzeg 8
 * (kaskada `leady -> instalacje -> installation_phases`), brzeg 9 (zmiana trybu po
 * zamknięciu etapu I — punkt OTWARTY, patrz test niżej).
 *
 * Konwencja repo (`create-booking-concurrency.itest.ts`): `*.itest.ts` ->
 * `vitest.integration.config.mts`, wymaga `supabase start` (żywy Postgres z migracją
 * `20260916060000_fnl_2phase_booking_mechanics.sql` zaaplikowaną). W TYM środowisku
 * (piaskownica bez Dockera) NIE MOŻNA wykonać `supabase start` — plik zweryfikowany
 * WYŁĄCZNIE przez `tsc --noEmit` i przegląd kodu, zgodnie z ustalonym wzorcem sesji
 * (pamięć `project_itest_no_docker_sandbox`). Rzeczywisty przebieg (RED/GREEN) czeka na
 * CI albo maszynę dewelopera z Dockerem.
 *
 * Ten plik testuje WYŁĄCZNIE ograniczenia bazy — WSTAWIA wiersze `installation_phases`
 * WPROST (przez Prismę, bez przechodzenia przez `completePhaseOneAction`), bo mechanizm
 * tworzenia tych wierszy jest zaprojektowany jako część `completePhaseOneAction`
 * (leniwie, patrz nagłówek `fnl-2phase-complete-phase-one.test.ts`) — na poziomie
 * SAMEJ BAZY nic nie wiąże istnienia wierszy z `instalacje.installation_type`, to jest
 * czysto aplikacyjna reguła. Wzorzec identyczny z pamięcią
 * `feedback_db_constraint_itest_bypass_domain.md`: dla kryteriów ograniczenia bazy
 * wstawiamy wiersze przez `prisma.<model>.create()` bezpośrednio, nie przez warstwę
 * domenową, bo warstwa domenowa i tak by je przefiltrowała.
 */

let createdLeadIds: string[] = [];
let createdCrewIds: string[] = [];

async function createTestLead(): Promise<{ id: string }> {
  const lead = await prisma.leady.create({ data: {} });
  createdLeadIds.push(lead.id);
  return lead;
}

// Wzorzec 1:1 z `create-booking-concurrency.itest.ts` (przeszedł w tym samym przebiegu
// CI): `bookings_one_assignee` (`num_nonnulls(auditor_id, crew_id) = 1`) i
// `bookings_resource_kind_check` wymagają, żeby dla `resourceKind: 'CREW'` był ustawiony
// `crewId`, inaczej `prisma.booking.create()` odbija się od CHECK-a (23514).
async function createTestCrew(): Promise<{ id: string }> {
  const suffix = randomUUID();
  const crew = await prisma.zespoly_monterskie.create({
    data: {
      nazwa: `ITEST FNL-2PHASE-BOOKING ${suffix}`,
    },
  });
  createdCrewIds.push(crew.id);
  return crew;
}

async function createTestInstallation(leadId: string, installationType: string | null): Promise<{ id: string }> {
  return prisma.instalacje.create({
    data: { lead_id: leadId, installation_type: installationType },
  });
}

afterEach(async () => {
  // installation_phases -> instalacje -> leady (CASCADE od leady na instalacje, CASCADE
  // od instalacje na installation_phases — usuwamy leady, kaskada robi resztę; jawne
  // czyszczenie installation_phases/instalacje NIE jest potrzebne, ale nie szkodzi
  // pozostawić leady jako jedyny punkt czyszczenia, zgodnie z append-only ethos
  // pamięci `feedback_guard_forbidden_text_scan_and_audit_log_itest.md`).
  if (createdLeadIds.length > 0) {
    await prisma.leady.deleteMany({ where: { id: { in: createdLeadIds } } });
  }
  createdLeadIds = [];
  if (createdCrewIds.length > 0) {
    // `booking.crew_id` -> `zespoly_monterskie` jest RESTRICT (patrz
    // `create-booking-concurrency.itest.ts`), więc sprzątamy rezerwacje testowe PRZED
    // usunięciem ekipy — nawet jeśli konkretny test już usunął swój booking jawnie.
    await prisma.booking.deleteMany({ where: { crewId: { in: createdCrewIds } } });
    await prisma.zespoly_monterskie.deleteMany({ where: { id: { in: createdCrewIds } } });
  }
  createdCrewIds = [];
});

describe('installation_phases — ograniczenia bazy (AC1, kształt DB)', () => {
  // @REQ: FNL-2PHASE-BOOKING
  it('phase_number poza {1,2} jest odrzucone przez installation_phases_phase_number_check', async () => {
    const lead = await createTestLead();
    const installation = await createTestInstallation(lead.id, 'TWO_PHASE');

    await expect(
      prisma.installationPhase.create({
        data: { installationId: installation.id, phaseNumber: 3 },
      }),
    ).rejects.toThrow();
  });

  // Kontrola pozytywna: dokładnie dwa wiersze (1 i 2) na jedną instalację — legalne.
  // @REQ: FNL-2PHASE-BOOKING
  it('kontrola pozytywna — phase_number 1 i 2 na tej samej instalacji współistnieją', async () => {
    const lead = await createTestLead();
    const installation = await createTestInstallation(lead.id, 'TWO_PHASE');

    await prisma.installationPhase.create({ data: { installationId: installation.id, phaseNumber: 1 } });
    await prisma.installationPhase.create({ data: { installationId: installation.id, phaseNumber: 2 } });

    const rows = await prisma.installationPhase.findMany({ where: { installationId: installation.id } });
    expect(rows.map((r) => r.phaseNumber).sort()).toEqual([1, 2]);
  });
});

describe('installation_phases — brzeg 2 (współbieżność tworzenia etapów, installation_phases_unique_phase)', () => {
  // WO dosłownie: "Dwa równoległe wywołania tworzące etapy dla tej samej instalacji dają
  // dwa wiersze, nie cztery — nośnikiem jest UNIQUE(installation_id, phase_number), nie
  // sprawdzenie w JS."
  // @REQ: FNL-2PHASE-BOOKING
  it('dwa równoległe INSERT-y phase_number=1 dla TEJ SAMEJ instalacji: dokładnie jeden sukces, drugi odbija się od UNIQUE', async () => {
    const lead = await createTestLead();
    const installation = await createTestInstallation(lead.id, 'TWO_PHASE');

    const attempt = () =>
      prisma.installationPhase.create({ data: { installationId: installation.id, phaseNumber: 1 } });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rows = await prisma.installationPhase.findMany({
      where: { installationId: installation.id, phaseNumber: 1 },
    });
    expect(rows).toHaveLength(1);
  });
});

describe('installation_phases — booking_id, unikalność częściowa (installation_phases_booking_id_key)', () => {
  // WO, sekcja A: "Jedna rezerwacja obsługuje dokładnie jeden etap." Dwa wiersze fazy nie
  // mogą wskazywać tej samej rezerwacji.
  // @REQ: FNL-2PHASE-BOOKING
  it('dwa wiersze installation_phases NIE MOGĄ wskazywać tej samej rezerwacji (booking_id)', async () => {
    const leadA = await createTestLead();
    const leadB = await createTestLead();
    const installationA = await createTestInstallation(leadA.id, 'TWO_PHASE');
    const installationB = await createTestInstallation(leadB.id, 'TWO_PHASE');

    const basket = await prisma.visitDurationBasket.findFirst({ where: { code: 'INSTALL_PHASE_1' } });
    if (!basket) throw new Error('Fixture błędna: koszyk INSTALL_PHASE_1 nie jest zaseedowany.');
    const crew = await createTestCrew();

    const booking = await prisma.booking.create({
      data: {
        leadId: leadA.id,
        resourceKind: 'CREW',
        crewId: crew.id,
        visitBasketId: basket.id,
        scheduledStart: new Date('2026-11-01T08:00:00Z'),
        scheduledEnd: new Date('2026-11-01T16:00:00Z'),
        status: 'RESERVED',
        bookedBy: 'DISPATCHER',
      },
    });

    await prisma.installationPhase.create({
      data: { installationId: installationA.id, phaseNumber: 1, bookingId: booking.id },
    });

    await expect(
      prisma.installationPhase.create({
        data: { installationId: installationB.id, phaseNumber: 1, bookingId: booking.id },
      }),
    ).rejects.toThrow();

    await prisma.booking.delete({ where: { id: booking.id } });
  });

  // Kontrola pozytywna: wiele wierszy z booking_id = NULL WSPÓŁISTNIEJĄ (indeks jest
  // częściowy, WHERE booking_id IS NOT NULL) — etap 2 przed rezerwacją nie koliduje z
  // niczym.
  // @REQ: FNL-2PHASE-BOOKING
  it('wiele wierszy z booking_id = NULL współistnieje (indeks jest częściowy)', async () => {
    const leadA = await createTestLead();
    const leadB = await createTestLead();
    const installationA = await createTestInstallation(leadA.id, 'TWO_PHASE');
    const installationB = await createTestInstallation(leadB.id, 'TWO_PHASE');

    await prisma.installationPhase.create({ data: { installationId: installationA.id, phaseNumber: 2 } });
    await prisma.installationPhase.create({ data: { installationId: installationB.id, phaseNumber: 2 } });

    const rows = await prisma.installationPhase.findMany({
      where: { installationId: { in: [installationA.id, installationB.id] }, phaseNumber: 2 },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.bookingId === null)).toBe(true);
  });
});

describe('installation_phases — brzeg 8 (kaskada usunięcia leada)', () => {
  // @REQ: FNL-2PHASE-BOOKING
  it('usunięcie leada kaskadowo usuwa instalację i jej etapy — zero sierot, brak RESTRICT', async () => {
    const lead = await createTestLead();
    const installation = await createTestInstallation(lead.id, 'TWO_PHASE');
    await prisma.installationPhase.create({ data: { installationId: installation.id, phaseNumber: 1 } });
    await prisma.installationPhase.create({ data: { installationId: installation.id, phaseNumber: 2 } });

    await prisma.leady.delete({ where: { id: lead.id } });
    createdLeadIds = createdLeadIds.filter((id) => id !== lead.id);

    const remainingPhases = await prisma.installationPhase.findMany({
      where: { installationId: installation.id },
    });
    expect(remainingPhases).toHaveLength(0);

    const remainingInstallation = await prisma.instalacje.findUnique({ where: { id: installation.id } });
    expect(remainingInstallation).toBeNull();
  });
});

describe('instalacje.installation_type — brzeg 9 (zmiana trybu po zamknięciu etapu I) — PUNKT OTWARTY', () => {
  /**
   * WO, brzeg 9: "Przełączenie instalacji z TWO_PHASE na SINGLE_PHASE, gdy etap I jest
   * już zamknięty — odmowa albo jawnie zdefiniowane zachowanie. Nie może być cichym
   * UPDATE, po którym zostają dwa osierocone etapy."
   *
   * ═══ PUNKT OTWARTY, ZGŁOSZONY test-authorowi przez samo WO (nie ukryty) ═══
   * Migracja `20260916060000` NIE zawiera triggera/CHECK-a blokującego tę zmianę —
   * `instalacje.installation_type` jest zwykłą kolumną TEXT z jedynym ograniczeniem
   * `instalacje_installation_type_check IN ('SINGLE_PHASE','TWO_PHASE')`. Baza SAMA NIE
   * ODMÓWI cichego przełączenia. WO nie mówi, KTO/CO ma tę odmowę wykonać (żadna
   * Server Action zmieniająca `installation_type` nie jest w zakresie tego WO — patrz
   * R4, audytor UI poza zakresem) — to wymaga decyzji człowieka/`contract-steward`
   * PRZED implementacją: (a) CHECK/trigger w bazie porównujący z istnieniem etapów
   * zamkniętych, (b) walidacja w przyszłej Server Action ustawiającej
   * `installation_type` (nieistniejącej dziś).
   *
   * Ten test DOKUMENTUJE stan dzisiejszy (baza pozwala na cichy UPDATE) jako DOWÓD, że
   * decyzja jest wymagana — nie jako oczekiwane zachowanie docelowe. Zamierzone GREEN:
   * potwierdza literalnie to, co WO ostrzega, że "nie może" się zdarzyć.
   */
  // @REQ: FNL-2PHASE-BOOKING
  it('DOKUMENTACYJNY — baza dziś NIE blokuje przełączenia TWO_PHASE->SINGLE_PHASE mimo zamkniętego etapu 1 (decyzja wymagana, patrz nagłówek)', async () => {
    const lead = await createTestLead();
    const installation = await createTestInstallation(lead.id, 'TWO_PHASE');
    await prisma.installationPhase.create({
      data: { installationId: installation.id, phaseNumber: 1, completedAt: new Date() },
    });
    await prisma.installationPhase.create({ data: { installationId: installation.id, phaseNumber: 2 } });

    // Baza dziś PRZEPUSZCZA ten UPDATE bez odmowy — to jest DOWÓD problemu, nie
    // potwierdzenie poprawności. Etapy zostają jako "osierocone" (WO, brzeg 9).
    const updated = await prisma.instalacje.update({
      where: { id: installation.id },
      data: { installation_type: 'SINGLE_PHASE' },
    });
    expect(updated.installation_type).toBe('SINGLE_PHASE');

    const orphanedPhases = await prisma.installationPhase.findMany({
      where: { installationId: installation.id },
    });
    expect(orphanedPhases).toHaveLength(2);
  });
});
