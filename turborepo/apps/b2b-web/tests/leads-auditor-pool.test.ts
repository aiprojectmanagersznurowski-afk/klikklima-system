import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/CRM-SAFE-RECORD-ACTIONS.md — CRM-AUDYT-AC1.6.
 *
 * AC1.6 (D1 = obie sciezki): "Zablokowany audytor znika z listy wyboru przy
 * przypisywaniu audytora do leada, a proba wymuszenia przypisania po stronie
 * serwera jest odrzucona." Dotad ten plik nie mial ZADNEGO testu (WO, Zadanie 2).
 * Ma dwie polowy, dwa rozne pliki produkcyjne:
 *
 *   1. Pula wyboru: `getAuditors()` w
 *      `apps/b2b-web/src/app/(dashboard)/leads/actions.ts` — filtruje
 *      `prisma.audytorzy.findMany({ where: { is_active: true }, ... })`.
 *      (Rozne od `getAuditors()` w `auditors/actions.ts`, ktory swiadomie pokazuje
 *      WSZYSTKICH, zeby admin mogl odblokowac zablokowane konto — to NIE jest ten
 *      sam eksport, sprawdzone czytaniem obu plikow przed napisaniem testu.)
 *   2. Wymuszone przypisanie z pominieciem UI: `updateLeadAuditor(leadId, audytorId)`
 *      w `apps/b2b-web/src/app/(dashboard)/leads/[id]/actions.ts` — czyta
 *      `prisma.audytorzy.findUnique({ where: { id }, select: { is_active: true } })`
 *      i odrzuca przypisanie, gdy `!audytor.is_active`.
 *
 * Mockujemy @repo/database (brak zywej instancji testowej) i next/cache
 * (revalidatePath wymaga kontekstu zadania Next.js). Model Prisma po polsku
 * (audytorzy, leady) — dlug KK-NAMING-BASELINE, ADR-002 zamrozony.
 */

const {
  auditorFindManyMock,
  auditorFindUniqueMock,
  leadFindUniqueMock,
  leadUpdateMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  auditorFindManyMock: vi.fn(),
  auditorFindUniqueMock: vi.fn(),
  leadFindUniqueMock: vi.fn(),
  leadUpdateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    audytorzy: {
      findMany: auditorFindManyMock,
      findUnique: auditorFindUniqueMock,
    },
    leady: {
      findUnique: leadFindUniqueMock,
      update: leadUpdateMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

const { getAuditors } = await import('../src/app/(dashboard)/leads/actions');
const { updateLeadAuditor } = await import('../src/app/(dashboard)/leads/[id]/actions');

describe('getAuditors (leads/actions.ts) - pula wyboru wyklucza zablokowanych (CRM-AUDYT-AC1.6)', () => {
  beforeEach(() => {
    auditorFindManyMock.mockReset();
  });

  // @REQ: CRM-AUDYT-AC1
  it('AC1.6 - zapytanie o pule wyboru filtruje is_active: true', async () => {
    auditorFindManyMock.mockResolvedValue([{ id: 'aud-active', imie_i_nazwisko: 'Jan Aktywny', is_active: true }]);

    const auditors = await getAuditors();

    expect(auditorFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ is_active: true }) }),
    );
    expect(auditors.map((a: { id: string }) => a.id)).toEqual(['aud-active']);
  });

  // Przypadek pusty: wszyscy audytorzy zablokowani -> pula pusta, nie blad.
  // @REQ: CRM-AUDYT-AC1
  it('przypadek pusty - brak aktywnych audytorow zwraca pusta pule', async () => {
    auditorFindManyMock.mockResolvedValue([]);

    const auditors = await getAuditors();

    expect(auditors).toEqual([]);
  });
});

describe('updateLeadAuditor - wymuszone przypisanie zablokowanego audytora z pominieciem UI (CRM-AUDYT-AC1.6)', () => {
  beforeEach(() => {
    leadFindUniqueMock.mockReset();
    leadUpdateMock.mockReset();
    auditorFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
  });

  // @REQ: CRM-AUDYT-AC1
  it('AC1.6 - przypisanie zablokowanego audytora (is_active=false) jest odrzucone', async () => {
    leadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'NEW_LEAD' });
    auditorFindUniqueMock.mockResolvedValue({ is_active: false });

    const result = await updateLeadAuditor('lead-1', 'aud-blocked');

    expect(result.success).toBe(false);
    expect(leadUpdateMock).not.toHaveBeenCalled();
  });

  // Kontrola negatywna: audytor aktywny nadal moze byc przypisany — inaczej guard
  // blokowalby wszystkie przypisania, nie tylko zablokowane konta.
  // @REQ: CRM-AUDYT-AC1
  it('kontrola negatywna - przypisanie aktywnego audytora sie udaje', async () => {
    leadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'NEW_LEAD' });
    auditorFindUniqueMock.mockResolvedValue({ is_active: true });
    leadUpdateMock.mockResolvedValue({});

    const result = await updateLeadAuditor('lead-1', 'aud-active');

    expect(result.success).toBe(true);
    expect(leadUpdateMock).toHaveBeenCalled();
  });

  // Odpiecie audytora (audytorId = null) nie powinno w ogole pytac o is_active —
  // nie ma czyjego statusu blokady sprawdzac.
  // @REQ: CRM-AUDYT-AC1
  it('przypadek brzegowy - odpiecie audytora (null) nie sprawdza is_active i nie jest blokowane', async () => {
    leadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'AWAITING_AUDIT' });
    leadUpdateMock.mockResolvedValue({});

    const result = await updateLeadAuditor('lead-1', null);

    expect(auditorFindUniqueMock).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
