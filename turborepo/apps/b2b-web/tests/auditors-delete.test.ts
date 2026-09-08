import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISSIONS, can, AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * WO: docs/workorders/CRM-SAFE-RECORD-ACTIONS.md — CRM-AUDYT-AC1 (AC1.1-AC1.4)
 * + przypadek brzegowy #1 (wspolbieznosc) i #4 (uprawnienia, warstwa Server Action).
 *
 * Cel pliku (WO, "Podzial pracy"): apps/b2b-web/src/app/(dashboard)/auditors/actions.ts
 * ma zablokowac deleteAuditorAction dopoki wisza leady audytora (D1: AWAITING_AUDIT /
 * AUDIT_COMPLETED - zimne/zarchiwizowane NIE blokuja) i odrzucic wywolanie od roli innej
 * niz admin (contracts/rbac.contract.mjs: PERMISSIONS.auditors.delete = ['admin']).
 *
 * MECHANICZNA AKTUALIZACJA (WO SEC-AUDIT-LOG-DELETE, Fala B): `deleteAuditorAction`
 * przyjmuje odtąd DRUGI argument, `input: { justification, legalBasis }` (WO,
 * `../src/lib/audit/delete-justification-schema`), i przed transakcją pobiera
 * `actorEmail` przez `createClient().auth.getUser()` — dlatego mockujemy odtąd
 * WYŁĄCZNIE `prisma.$transaction` (żadnego modelu bezpośrednio na `prisma`, wzorem
 * `services-authz-gates.test.ts` i `sec-audit-log-delete-wave-b.test.ts`, które testują
 * te same dwie funkcje pod kątem samego wpisu audytowego — TEN plik zostaje wąski i
 * dowodzi WYŁĄCZNIE logiki blokady BLOCK_UNTIL_REASSIGNED (D1) i bramki roli, tak jak
 * przed tą turą). `VALID_INPUT` jest budowany z `AUDIT_REQUIREMENTS.legalBases[0]`
 * (wygenerowany kontrakt), żeby nie hardkodować podstawy prawnej literałem.
 *
 * Model Prisma jest nazwany po polsku (audytorzy/leady) - dlug KK-NAMING-BASELINE
 * zamrozony przez ADR-002 i swiadomie NIE ruszany w tym WO (schema.prisma, Z2/Z6).
 *
 * Mockujemy @repo/database (nie mamy zywej instancji testowej), next/cache
 * (revalidatePath wymaga kontekstu zadania Next.js, ktorego w vitest nie ma) i
 * ../src/utils/supabase/server (getCurrentActorRole i createClient — deleteAuditorAction
 * odtąd woła oba przed transakcją).
 */

const {
  transactionMock,
  auditorFindUniqueMock,
  auditorDeleteMock,
  auditLogCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  auditorFindUniqueMock: vi.fn(),
  auditorDeleteMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: createClientMock,
}));

const { deleteAuditorAction } = await import(
  '../src/app/(dashboard)/auditors/actions'
);

const HANGING_LEAD = { id: 'lead-1', status: 'AWAITING_AUDIT', klient: { imie_i_nazwisko: 'Jan Kowalski' } };
const COLD_LEAD = { id: 'lead-2', status: 'QUOTE_REJECTED', klient: { imie_i_nazwisko: 'Anna Nowak' } };
const ARCHIVED_LEAD = { id: 'lead-3', status: 'ARCHIVED_LOST', klient: { imie_i_nazwisko: 'Piotr Zielinski' } };

const ADMIN_EMAIL = 'admin@klikklima.pl';
const VALID_INPUT = {
  justification: 'Duplikat rekordu audytora utworzony przez pomylke operatora.',
  legalBasis: AUDIT_REQUIREMENTS.legalBases[0],
};

describe('deleteAuditorAction - blokada usuniecia audytora z wiszacymi leadami (CRM-AUDYT-AC1)', () => {
  beforeEach(() => {
    transactionMock.mockReset();
    auditorFindUniqueMock.mockReset();
    auditorDeleteMock.mockReset();
    auditLogCreateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getUserMock.mockReset();
    createClientMock.mockReset();

    getCurrentActorRoleMock.mockResolvedValue('admin');
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } });
    createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
    auditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        audytorzy: { findUnique: auditorFindUniqueMock, delete: auditorDeleteMock },
        auditLog: { create: auditLogCreateMock },
      }),
    );
  });

  // @REQ: CRM-AUDYT-AC1
  it('AC1.1 - odmowa i lista blokujacych leadow, gdy audytor ma lead w AWAITING_AUDIT', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [HANGING_LEAD] });

    const result = await deleteAuditorAction('aud-1', VALID_INPUT);

    expect(result.success).toBe(false);
    expect(auditorDeleteMock).not.toHaveBeenCalled();
    expect(result.blockingLeads).toBeDefined();
    expect(result.blockingLeads?.map((l: { id: string }) => l.id)).toEqual(['lead-1']);
  });

  // @REQ: CRM-AUDYT-AC1
  it('D1 - leady zimne (QUOTE_REJECTED) i zarchiwizowane (ARCHIVED_LOST) NIE blokuja usuniecia', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [COLD_LEAD, ARCHIVED_LEAD] });

    const result = await deleteAuditorAction('aud-1', VALID_INPUT);

    expect(result.success).toBe(true);
    expect(auditorDeleteMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'aud-1' } }));
  });

  // @REQ: CRM-AUDYT-AC1
  it('AC1.2 - po przepieciu wszystkich blokujacych leadow usuniecie sie udaje', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [] });

    const result = await deleteAuditorAction('aud-1', VALID_INPUT);

    expect(result.success).toBe(true);
    expect(auditorDeleteMock).toHaveBeenCalled();
  });

  // @REQ: CRM-AUDYT-AC1
  it('AC1.3 - odrzucona proba nie odpina leadow po cichu: delete nie jest wywolywany', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [HANGING_LEAD] });

    await deleteAuditorAction('aud-1', VALID_INPUT);

    expect(auditorDeleteMock).not.toHaveBeenCalled();
  });

  // AC1.4 dowodzi jednocześnie D1 (rola nieadmin odrzucona przed logika wiszacych
  // leadow) ORAZ warstwy Server Action wymagania CRM-DELETE-ADMIN-ONLY-AUDITORS
  // ("wywolanie z pominieciem interfejsu przez role nie-admin jest odrzucone ZANIM
  // otworzy sie transakcja") - stad podwojny tag, zeby zaden wpis nie stracil pokrycia.
  // @REQ: CRM-AUDYT-AC1, CRM-DELETE-ADMIN-ONLY-AUDITORS
  it('AC1.4 - rola inna niz admin jest odrzucona po stronie serwera, nawet z pominieciem UI', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [] });

    const result = await deleteAuditorAction('aud-1', VALID_INPUT);

    expect(result.success).toBe(false);
    // AC2 wymaga odrzucenia PRZED otwarciem transakcji, nie tylko przed samym DELETE:
    // sprawdzenie samego auditorDeleteMock nie odrozniłoby "odrzucone przed transakcja"
    // od "transakcja otwarta, ale delete wewnatrz niej pominiety".
    expect(transactionMock).not.toHaveBeenCalled();
    expect(auditorDeleteMock).not.toHaveBeenCalled();
    expect(can('dyspozytor', 'auditors', 'delete')).toBe('no');
    // Whitelist calej macierzy, nie blacklista jednej roli: mutant rozszerzajacy
    // PERMISSIONS.auditors.delete o np. 'monter' przechodzilby obok samej blacklisty na
    // 'dyspozytor', mimo ze otwiera dodatkowa, nieautoryzowana role.
    expect(PERMISSIONS.auditors.delete).toEqual(['admin']);
  });

  // Fail-closed: brak roli (sesja bez wpisu w AuthorizedUser albo brak zalogowania)
  // MUSI byc traktowany jak brak uprawnien, nie jak przejscie. getCurrentActorRole()
  // zwraca `null` dokladnie w tym przypadku (utils/supabase/server.ts).
  // Fail-closed dotyczy jednoczesnie D1 (blokady wiszacych leadow) i warstwy Server
  // Action CRM-DELETE-ADMIN-ONLY-AUDITORS - stad podwojny tag.
  // @REQ: CRM-AUDYT-AC1, CRM-DELETE-ADMIN-ONLY-AUDITORS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed, nie przepuszczony', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [] });

    const result = await deleteAuditorAction('aud-1', VALID_INPUT);

    expect(result.success).toBe(false);
    expect(auditorDeleteMock).not.toHaveBeenCalled();
  });

  // Kontrola pozytywna (nie jest odrebnym AC — AC1.7 dotyczy odwracalnosci BLOKADY
  // konta, nie usuniecia; test na toggleAuditorActiveAction zyje w
  // auditors-toggle-active.test.ts): rola admin z macierzy uprawnien przechodzi
  // sprawdzenie roli w deleteAuditorAction.
  // Kontrola pozytywna dla obu wymagan naraz: bez niej zestaw przechodzi takze dla
  // akcji zepsutej tak, ze odrzuca wszystkich, w tym admina.
  // @REQ: CRM-AUDYT-AC1, CRM-DELETE-ADMIN-ONLY-AUDITORS
  it('kontrola pozytywna - rola admin przechodzi sprawdzenie roli w deleteAuditorAction', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [] });
    expect(can('admin', 'auditors', 'delete')).toBe('yes');

    const result = await deleteAuditorAction('aud-1', VALID_INPUT);
    expect(result.success).toBe(true);
  });

  // Przypadek brzegowy #1 z WO ("Wspolbieznosc, usuniecie audytora"): sprawdzenie
  // w JS przed delete nie wystarcza - musi byc jedna atomowa operacja bazodanowa.
  // @REQ: CRM-AUDYT-AC1
  it('przypadek brzegowy - sprawdzenie blokujacych leadow i DELETE dzieja sie w jednej transakcji', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [] });

    await deleteAuditorAction('aud-1', VALID_INPUT);

    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  // Przypadek brzegowy #1 (kontynuacja): blokujacy lead widoczny wewnatrz transakcji
  // nie pozwala na delete w tej samej transakcji.
  // @REQ: CRM-AUDYT-AC1
  it('przypadek brzegowy - blokujacy lead widoczny wewnatrz transakcji: delete nie nastepuje', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [HANGING_LEAD] });

    const result = await deleteAuditorAction('aud-1', VALID_INPUT);

    expect(result.success).toBe(false);
    expect(auditorDeleteMock).not.toHaveBeenCalled();
  });

  // Przypadek pusty (WO, "Zawsze dopisujesz"): audytor bez zadnych leadow.
  // @REQ: CRM-AUDYT-AC1
  it('przypadek pusty - audytor bez leadow usuwa sie bez bledu', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [] });

    const result = await deleteAuditorAction('aud-1', VALID_INPUT);

    expect(result.success).toBe(true);
    expect(result.blockingLeads ?? []).toEqual([]);
  });
});
