import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@repo/database';

/**
 * WO: docs/workorders/FNL-2PHASE-ROLLBACK-RELEASE.md, AC3 (skutek praktyczny
 * kryt. 2: "po rollbacku lead nie ma żadnej rezerwacji w RESERVED/CONFIRMED
 * wynikającej z etapu II, więc createBooking dla tego samego podmiotu nie
 * zwraca już SUBJECT_ALREADY_BOOKED"). `bookings_one_active_per_subject` jest
 * INDEKSEM CZĘŚCIOWYM na żywym Postgresie — atrapa Prismy (`fnl-2phase-rollback-release.test.ts`,
 * Sekcja 2, test "AC3 (dowód częściowy na dublu)") może tylko sprawdzić, że
 * `booking.status` faktycznie przechodzi na `RELEASED`; nie może dowieść, że
 * TEN status faktycznie wypada z zasięgu indeksu na bazie. Ten plik dowodzi
 * DOKŁADNIE tego, na żywej bazie.
 *
 * Wzorzec 1:1 z `feedback_db_constraint_itest_bypass_domain.md`: wstawiamy
 * rezerwacje WPROST przez `prisma.booking.create()`, pomijając nieistniejącą
 * jeszcze `releasePhaseTwoBooking` — dowodzimy WYŁĄCZNIE zachowania samego
 * indeksu częściowego, nie logiki domenowej (którą i tak przefiltrowałaby wejście).
 *
 * Konwencja repo (`create-booking-concurrency.itest.ts`, `fnl-2phase-db-constraints.itest.ts`):
 * `*.itest.ts` -> `vitest.integration.config.mts`, wymaga `supabase start` (żywy
 * Postgres z migracją `20260916060000` zaaplikowaną). W TYM środowisku (piaskownica
 * bez Dockera) NIE MOŻNA wykonać `supabase start` — plik zweryfikowany WYŁĄCZNIE
 * przez `tsc --noEmit` i przegląd kodu, zgodnie z ustalonym wzorcem sesji (pamięć
 * `project_itest_no_docker_sandbox`). Rzeczywisty przebieg (RED/GREEN) czeka na CI
 * albo maszynę dewelopera z Dockerem.
 *
 * OSTRZEŻENIE WO (dosłowne, sekcja "Ryzyka i nieznane"): jeżeli AC3 da się
 * dowieść TYLKO integracyjnie, a przebieg nie zostanie wykonany w tej turze —
 * NIE domykać wymagania na podstawie tego pliku samego. Precedens: odmowa
 * domknięcia CAL-SLOT-ENGINE (2026-09-16, kryterium (b) bez przebiegu).
 */

let createdLeadIds: string[] = [];
let createdCrewIds: string[] = [];

async function createTestLead(): Promise<{ id: string }> {
  const lead = await prisma.leady.create({ data: {} });
  createdLeadIds.push(lead.id);
  return lead;
}

// Wzorzec 1:1 z `create-booking-concurrency.itest.ts` / `fnl-2phase-db-constraints.itest.ts`:
// `bookings_one_assignee` i `bookings_resource_kind_check` wymagają, żeby dla
// `resourceKind: 'CREW'` był ustawiony `crewId`.
async function createTestCrew(): Promise<{ id: string }> {
  const suffix = randomUUID();
  const crew = await prisma.zespoly_monterskie.create({
    data: { nazwa: `ITEST FNL-2PHASE-ROLLBACK-RELEASE ${suffix}` },
  });
  createdCrewIds.push(crew.id);
  return crew;
}

afterEach(async () => {
  if (createdLeadIds.length > 0) {
    await prisma.booking.deleteMany({ where: { leadId: { in: createdLeadIds } } });
    await prisma.leady.deleteMany({ where: { id: { in: createdLeadIds } } });
  }
  createdLeadIds = [];
  if (createdCrewIds.length > 0) {
    await prisma.booking.deleteMany({ where: { crewId: { in: createdCrewIds } } });
    await prisma.zespoly_monterskie.deleteMany({ where: { id: { in: createdCrewIds } } });
  }
  createdCrewIds = [];
});

describe('bookings_one_active_per_subject — AC3 (FNL-2PHASE-ROLLBACK-RELEASE)', () => {
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('rezerwacja etapu II ze statusem RELEASED nie blokuje nowej aktywnej rezerwacji dla tego samego leada', async () => {
    const lead = await createTestLead();
    const crew = await createTestCrew();
    const basket = await prisma.visitDurationBasket.findFirst({ where: { code: 'INSTALL_PHASE_2' } });
    if (!basket) throw new Error('Fixture błędna: koszyk INSTALL_PHASE_2 nie jest zaseedowany.');

    // Symuluje SKUTEK releasePhaseTwoBooking (funkcja jeszcze nie istnieje) —
    // rezerwacja etapu II, którą rollback powinien zwolnić.
    const releasedBooking = await prisma.booking.create({
      data: {
        leadId: lead.id,
        resourceKind: 'CREW',
        crewId: crew.id,
        visitBasketId: basket.id,
        scheduledStart: new Date('2026-11-01T08:00:00Z'),
        scheduledEnd: new Date('2026-11-01T12:00:00Z'),
        status: 'RELEASED',
        bookedBy: 'DISPATCHER',
      },
    });

    // To jest DOKŁADNIE efekt, na który AC3 się powołuje: nowa aktywna rezerwacja
    // dla tego samego leada NIE koliduje z bookings_one_active_per_subject, bo
    // poprzednia jest RELEASED — indeks częściowy pokrywa tylko RESERVED/CONFIRMED.
    const newBooking = await prisma.booking.create({
      data: {
        leadId: lead.id,
        resourceKind: 'CREW',
        crewId: crew.id,
        visitBasketId: basket.id,
        scheduledStart: new Date('2026-12-01T08:00:00Z'),
        scheduledEnd: new Date('2026-12-01T12:00:00Z'),
        status: 'RESERVED',
        bookedBy: 'DISPATCHER',
      },
    });

    expect(newBooking.id).not.toBe(releasedBooking.id);
    expect(newBooking.status).toBe('RESERVED');
  });

  // Kontrast: DWIE aktywne rezerwacje (RESERVED) tego samego leada KOLIDUJĄ — dowód,
  // że problem, który AC3 opisuje, istnieje naprawdę, i że status RELEASED (a nie
  // jakikolwiek inny) jest tym, co go usuwa.
  // @REQ: FNL-2PHASE-ROLLBACK-RELEASE
  it('kontrast: dwie aktywne rezerwacje (RESERVED) tego samego leada kolidują na bookings_one_active_per_subject', async () => {
    const lead = await createTestLead();
    const crew = await createTestCrew();
    const basket = await prisma.visitDurationBasket.findFirst({ where: { code: 'INSTALL_PHASE_2' } });
    if (!basket) throw new Error('Fixture błędna: koszyk INSTALL_PHASE_2 nie jest zaseedowany.');

    await prisma.booking.create({
      data: {
        leadId: lead.id,
        resourceKind: 'CREW',
        crewId: crew.id,
        visitBasketId: basket.id,
        scheduledStart: new Date('2026-11-01T08:00:00Z'),
        scheduledEnd: new Date('2026-11-01T12:00:00Z'),
        status: 'RESERVED',
        bookedBy: 'DISPATCHER',
      },
    });

    await expect(
      prisma.booking.create({
        data: {
          leadId: lead.id,
          resourceKind: 'CREW',
          crewId: crew.id,
          visitBasketId: basket.id,
          scheduledStart: new Date('2026-12-01T08:00:00Z'),
          scheduledEnd: new Date('2026-12-01T12:00:00Z'),
          status: 'RESERVED',
          bookedBy: 'DISPATCHER',
        },
      }),
    ).rejects.toThrow();
  });
});
