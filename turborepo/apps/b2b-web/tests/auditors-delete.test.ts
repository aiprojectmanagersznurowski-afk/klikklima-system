import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISSIONS, can } from '@klikklima/contracts';

/**
 * WO: docs/workorders/CRM-SAFE-RECORD-ACTIONS.md — CRM-AUDYT-AC1 (AC1.1-AC1.4)
 * + przypadek brzegowy #1 (wspolbieznosc) i #4 (uprawnienia, warstwa Server Action).
 *
 * Cel pliku (WO, "Podzial pracy"): apps/b2b-web/src/app/(dashboard)/auditors/actions.ts
 * ma zablokowac deleteAuditorAction dopoki wisza leady audytora (D1: AWAITING_AUDIT /
 * AUDIT_COMPLETED - zimne/zarchiwizowane NIE blokuja) i odrzucic wywolanie od roli innej
 * niz admin (contracts/rbac.contract.mjs: PERMISSIONS.auditors.delete = ['admin']).
 *
 * BLOCKER 1 (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #1) NAPRAWIONY: `deleteAuditorAction`
 * NIE przyjmuje juz roli jako argumentu wywolania (klient moglby wyslac dowolna wartosc,
 * Prisma omija RLS) — rola pochodzi wylacznie z `getCurrentActorRole()`
 * (`apps/b2b-web/src/utils/supabase/server.ts`), importowanej w pliku produkcyjnym
 * relatywnie jako `../../../utils/supabase/server`. Realna sygnatura dzis:
 * `deleteAuditorAction(id: string): Promise<DeleteAuditorResult>`.
 *
 * TEST-DEFECT z poprzedniej iteracji (potwierdzony w WO tej tury): ten plik wywolywal
 * `deleteAuditorAction(id, 'admin'|'dyspozytor')` — dokladnie ta wersja API, ktora
 * zostala naprawiona jako luka bezpieczenstwa. Naprawa: mockujemy
 * `getCurrentActorRole` i sterujemy rola PRZED kazdym wywolaniem, bez drugiego
 * argumentu.
 *
 * Model Prisma jest nazwany po polsku (audytorzy/leady) - dlug KK-NAMING-BASELINE
 * zamrozony przez ADR-002 i swiadomie NIE ruszany w tym WO (schema.prisma, Z2/Z6).
 * Mockujemy realny ksztalt @repo/database, nie wolno wymyslac angielskich nazw
 * modeli, ktorych schema nie ma.
 *
 * Mockujemy @repo/database (nie mamy zywej instancji testowej), next/cache
 * (revalidatePath wymaga kontekstu zadania Next.js, ktorego w vitest nie ma) i
 * ../src/utils/supabase/server (getCurrentActorRole woluje next/headers cookies(),
 * ktore poza kontekstem zadania rzuca "cookies was called outside a request scope").
 *
 * Wzorzec zapytania `include: { leady: true }` na prisma.audytorzy.findUnique jest
 * skopiowany 1:1 z istniejacego getAuditors() w tym samym pliku (juz dzis wola
 * prisma.audytorzy.findMany({ include: { leady: true } }) i liczy a.leady.length)
 * - to jedyny already-established ksztalt zapytania w tej bazie kodu.
 */

const {
  auditorFindUniqueMock,
  auditorDeleteMock,
  transactionMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  auditorFindUniqueMock: vi.fn(),
  auditorDeleteMock: vi.fn(),
  transactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    audytorzy: {
      findUnique: auditorFindUniqueMock,
      delete: auditorDeleteMock,
    },
    $transaction: transactionMock,
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — ten plik nie testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser` dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });

const { deleteAuditorAction } = await import(
  '../src/app/(dashboard)/auditors/actions'
);

const HANGING_LEAD = { id: 'lead-1', status: 'AWAITING_AUDIT', klient: { imie_i_nazwisko: 'Jan Kowalski' } };
const COLD_LEAD = { id: 'lead-2', status: 'QUOTE_REJECTED', klient: { imie_i_nazwisko: 'Anna Nowak' } };
const ARCHIVED_LEAD = { id: 'lead-3', status: 'ARCHIVED_LOST', klient: { imie_i_nazwisko: 'Piotr Zielinski' } };

describe('deleteAuditorAction - blokada usuniecia audytora z wiszacymi leadami (CRM-AUDYT-AC1)', () => {
  beforeEach(() => {
    auditorFindUniqueMock.mockReset();
    auditorDeleteMock.mockReset();
    transactionMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ audytorzy: { findUnique: auditorFindUniqueMock, delete: auditorDeleteMock } }),
    );
  });

  // @REQ: CRM-AUDYT-AC1
  it('AC1.1 - odmowa i lista blokujacych leadow, gdy audytor ma lead w AWAITING_AUDIT', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [HANGING_LEAD] });

    const result = await deleteAuditorAction('aud-1');

    expect(result.success).toBe(false);
    expect(auditorDeleteMock).not.toHaveBeenCalled();
    expect(result.blockingLeads).toBeDefined();
    expect(result.blockingLeads?.map((l: { id: string }) => l.id)).toEqual(['lead-1']);
  });

  // @REQ: CRM-AUDYT-AC1
  it('D1 - leady zimne (QUOTE_REJECTED) i zarchiwizowane (ARCHIVED_LOST) NIE blokuja usuniecia', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [COLD_LEAD, ARCHIVED_LEAD] });

    const result = await deleteAuditorAction('aud-1');

    expect(result.success).toBe(true);
    expect(auditorDeleteMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'aud-1' } }));
  });

  // @REQ: CRM-AUDYT-AC1
  it('AC1.2 - po przepieciu wszystkich blokujacych leadow usuniecie sie udaje', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [] });

    const result = await deleteAuditorAction('aud-1');

    expect(result.success).toBe(true);
    expect(auditorDeleteMock).toHaveBeenCalled();
  });

  // @REQ: CRM-AUDYT-AC1
  it('AC1.3 - odrzucona proba nie odpina leadow po cichu: delete nie jest wywolywany', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [HANGING_LEAD] });

    await deleteAuditorAction('aud-1');

    expect(auditorDeleteMock).not.toHaveBeenCalled();
  });

  // @REQ: CRM-AUDYT-AC1
  it('AC1.4 - rola inna niz admin jest odrzucona po stronie serwera, nawet z pominieciem UI', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [] });

    const result = await deleteAuditorAction('aud-1');

    expect(result.success).toBe(false);
    expect(auditorDeleteMock).not.toHaveBeenCalled();
    expect(can('dyspozytor', 'auditors', 'delete')).toBe('no');
    expect(PERMISSIONS.auditors.delete).not.toContain('dyspozytor');
  });

  // Fail-closed: brak roli (sesja bez wpisu w AuthorizedUser albo brak zalogowania)
  // MUSI byc traktowany jak brak uprawnien, nie jak przejscie. getCurrentActorRole()
  // zwraca `null` dokladnie w tym przypadku (utils/supabase/server.ts).
  // @REQ: CRM-AUDYT-AC1
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed, nie przepuszczony', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [] });

    const result = await deleteAuditorAction('aud-1');

    expect(result.success).toBe(false);
    expect(auditorDeleteMock).not.toHaveBeenCalled();
  });

  // Kontrola pozytywna (nie jest odrebnym AC — AC1.7 dotyczy odwracalnosci BLOKADY
  // konta, nie usuniecia; test na toggleAuditorActiveAction zyje w
  // auditors-toggle-active.test.ts): rola admin z macierzy uprawnien przechodzi
  // sprawdzenie roli w deleteAuditorAction.
  // @REQ: CRM-AUDYT-AC1
  it('kontrola pozytywna - rola admin przechodzi sprawdzenie roli w deleteAuditorAction', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [] });
    expect(can('admin', 'auditors', 'delete')).toBe('yes');

    const result = await deleteAuditorAction('aud-1');
    expect(result.success).toBe(true);
  });

  // Przypadek brzegowy #1 z WO ("Wspolbieznosc, usuniecie audytora"): sprawdzenie
  // w JS przed delete nie wystarcza - musi byc jedna atomowa operacja bazodanowa.
  // @REQ: CRM-AUDYT-AC1
  it('przypadek brzegowy - sprawdzenie blokujacych leadow i DELETE dzieja sie w jednej transakcji', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [] });

    await deleteAuditorAction('aud-1');

    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  // Przypadek brzegowy #1 (kontynuacja): blokujacy lead widoczny wewnatrz transakcji
  // nie pozwala na delete w tej samej transakcji.
  // @REQ: CRM-AUDYT-AC1
  it('przypadek brzegowy - blokujacy lead widoczny wewnatrz transakcji: delete nie nastepuje', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [HANGING_LEAD] });

    const result = await deleteAuditorAction('aud-1');

    expect(result.success).toBe(false);
    expect(auditorDeleteMock).not.toHaveBeenCalled();
  });

  // Przypadek pusty (WO, "Zawsze dopisujesz"): audytor bez zadnych leadow.
  // @REQ: CRM-AUDYT-AC1
  it('przypadek pusty - audytor bez leadow usuwa sie bez bledu', async () => {
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', leady: [] });

    const result = await deleteAuditorAction('aud-1');

    expect(result.success).toBe(true);
    expect(result.blockingLeads ?? []).toEqual([]);
  });
});
