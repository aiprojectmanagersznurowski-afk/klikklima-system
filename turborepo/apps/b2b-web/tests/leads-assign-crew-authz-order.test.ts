import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, can } from '@klikklima/contracts';

/**
 * BATCH-MEDIUM-LOW-CLEANUP — Punkt 3: `assignCrewToLead`
 * (`apps/b2b-web/src/app/(dashboard)/leads/actions.ts`) sprawdza dzis role PO
 * `prisma.leady.findUnique` i `prisma.zespoly_monterskie.findMany` (patrz komentarz
 * "MAJOR" tuz przed blokiem `getCurrentActorRole()` w tym pliku). Docelowo `can()`
 * musi byc PIERWSZA rzecza, ktora sie dzieje — przed jakimkolwiek zapytaniem Prisma.
 *
 * AC3.1: dla roli bez `leads.update` odpowiedz jest bajt-identyczna niezaleznie od
 * stanu rekordow (lead/ekipa nie istnieje, zly status, brak daty rezerwacji, ekipa
 * nieaktywna/wygasly certyfikat) — dzis NIE jest, bo te warunki sa sprawdzane przed
 * bramka roli i kazdy zwraca inny komunikat.
 * AC3.2: dla roli bez uprawnien `prisma.leady.findUnique` i
 * `prisma.zespoly_monterskie.findMany` NIE sa wywolywane ani razu.
 * AC3.3: sciezka pozytywna (admin/dyspozytor) bez regresji.
 * Edge case: `getCurrentActorRole()` rzuca -> fail-closed (odmowa, nie ogolny blad).
 *
 * Mockujemy @repo/database, next/cache i ../src/utils/supabase/server.
 */

const {
  leadFindUniqueMock,
  crewFindManyMock,
  transactionMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  createClientMock,
} = vi.hoisted(() => ({
  leadFindUniqueMock: vi.fn(),
  crewFindManyMock: vi.fn(),
  transactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: { findUnique: leadFindUniqueMock, update: vi.fn() },
    zespoly_monterskie: { findMany: crewFindManyMock },
    $transaction: transactionMock,
  },
  LeadStatus: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: createClientMock,
}));

const { assignCrewToLead } = await import('../src/app/(dashboard)/leads/actions');

const DENIED_ROLES = ROLES.filter((r) => can(r, 'leads', 'update') !== 'yes');
const ALLOWED_ROLES = ROLES.filter((r) => can(r, 'leads', 'update') === 'yes');

describe('assignCrewToLead — bramka roli PRZED zapytaniami Prisma (Punkt 3, BATCH-MEDIUM-LOW-CLEANUP)', () => {
  beforeEach(() => {
    leadFindUniqueMock.mockReset();
    crewFindManyMock.mockReset();
    transactionMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    createClientMock.mockReset();
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(DENIED_ROLES)(
    'AC3.2 - rola %s: odczyt leada i puli ekip NIE jest wywolany',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'leads', 'update')).not.toBe('yes');

      await assignCrewToLead('lead-1', 'crew-1');

      expect(leadFindUniqueMock).not.toHaveBeenCalled();
      expect(crewFindManyMock).not.toHaveBeenCalled();
    },
  );

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('AC3.1 - odpowiedz dla roli bez uprawnien jest identyczna niezaleznie od istnienia/stanu leada i ekipy', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const scenarios: Array<() => Promise<unknown>> = [
      // lead nie istnieje w ogole
      () => {
        leadFindUniqueMock.mockResolvedValue(null);
        return assignCrewToLead('lead-x', 'crew-x');
      },
      // zly status
      () => {
        leadFindUniqueMock.mockResolvedValue({ status: 'NEW_LEAD', data_rezerwacji: new Date() });
        return assignCrewToLead('lead-x', 'crew-x');
      },
      // brak daty rezerwacji
      () => {
        leadFindUniqueMock.mockResolvedValue({
          status: 'AWAITING_CREW_ASSIGNMENT',
          data_rezerwacji: null,
        });
        return assignCrewToLead('lead-x', 'crew-x');
      },
      // ekipa nieaktywna / wygasly certyfikat
      () => {
        leadFindUniqueMock.mockResolvedValue({
          status: 'AWAITING_CREW_ASSIGNMENT',
          data_rezerwacji: new Date(),
        });
        crewFindManyMock.mockResolvedValue([
          { id: 'crew-x', aktywny: false, fgaz_valid_until: null, sep_valid_until: null },
        ]);
        return assignCrewToLead('lead-x', 'crew-x');
      },
    ];

    const results: unknown[] = [];
    for (const scenario of scenarios) {
      leadFindUniqueMock.mockReset();
      crewFindManyMock.mockReset();
      results.push(await scenario());
    }

    for (const result of results) {
      expect(result).toEqual(results[0]);
    }
    expect(results[0]).toEqual(expect.objectContaining({ success: false }));
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(ALLOWED_ROLES)(
    'AC3.3 - rola %s (dozwolona) nadal moze przypisac ekipe (brak regresji sciezki pozytywnej)',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      leadFindUniqueMock.mockResolvedValue({
        status: 'AWAITING_CREW_ASSIGNMENT',
        data_rezerwacji: new Date('2026-09-15'),
      });
      crewFindManyMock.mockResolvedValue([
        {
          id: 'crew-1',
          aktywny: true,
          fgaz_valid_until: new Date('2027-01-01'),
          sep_valid_until: new Date('2027-01-01'),
        },
      ]);

      const txLeadUpdateMock = vi.fn();
      const txInstallationFindFirstMock = vi.fn().mockResolvedValue(null);
      const txInstallationCreateMock = vi.fn();
      const txInstallationUpdateMock = vi.fn();

      transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn({
          leady: { update: txLeadUpdateMock },
          instalacje: {
            findFirst: txInstallationFindFirstMock,
            create: txInstallationCreateMock,
            update: txInstallationUpdateMock,
          },
        }),
      );

      const result = await assignCrewToLead('lead-1', 'crew-1');

      expect(result).toEqual({ success: true });

      // Dowód, że mutant usuwający cały $transaction (i zwracający sukces od razu po
      // walidacji certyfikatów) zostaje złapany: bez wywołania tx.leady.update i
      // tx.instalacje.create nowy status leada i przypisanie ekipy nigdy by nie powstały.
      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(txLeadUpdateMock).toHaveBeenCalledTimes(1);
      expect(txLeadUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-1' },
          data: expect.objectContaining({ status: expect.any(String) }),
        }),
      );
      // Lead nie ma jeszcze rekordu montażu (findFirst zwraca null) -> gałąź create,
      // a nie update, i to ona musi zapisać przypisanie ekipy na instalacje.zespol_id.
      expect(txInstallationFindFirstMock).toHaveBeenCalledTimes(1);
      expect(txInstallationCreateMock).toHaveBeenCalledTimes(1);
      expect(txInstallationCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lead_id: 'lead-1', zespol_id: 'crew-1' }),
        }),
      );
      expect(txInstallationUpdateMock).not.toHaveBeenCalled();
    },
  );

  // Edge case (WO): getCurrentActorRole rzuca -> fail-closed, odmowa, nie ogolny blad.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('edge case - getCurrentActorRole rzuca wyjatek daje fail-closed odmowe uprawnien, zero zapytan Prisma', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('sesja wygasla'));

    const result = await assignCrewToLead('lead-1', 'crew-1');

    expect(leadFindUniqueMock).not.toHaveBeenCalled();
    expect(crewFindManyMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/uprawn/i);
  });
});
