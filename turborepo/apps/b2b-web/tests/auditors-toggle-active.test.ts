import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/CRM-SAFE-RECORD-ACTIONS.md — CRM-AUDYT-AC1.7.
 *
 * AC1.7: "Blokada jest odwracalna: odblokowane konto wraca do puli wyboru i
 * przechodzi autoryzacje." Dotad ten plik nie mial ZADNEGO testu (WO, Zadanie 2) —
 * poprzednia iteracja miala test OZNACZONY jako AC1.7 w auditors-delete.test.ts,
 * ale sprawdzal cos innego (role admin/AC1.4). Ta wersja testuje faktyczna funkcje
 * odpowiedzialna za odwracalnosc: `toggleAuditorActiveAction(id)` w
 * `apps/b2b-web/src/app/(dashboard)/auditors/actions.ts` — wywolane dwukrotnie na
 * tym samym audytorze musi wrocic do `is_active: true` po drugim wywolaniu.
 *
 * Puli wyboru (getAuditors() w leads/actions.ts) i bramki autoryzacyjnej
 * (middleware.ts) po odblokowaniu dotycza osobne testy w
 * leads-auditor-pool.test.ts i middleware-auditor-blocked.test.ts — ten plik
 * sprawdza wylacznie sam mechanizm przelacznika (zrodlo prawdy dla obu tamtych).
 *
 * Sygnatura przeczytana z produkcji (auditors/actions.ts):
 *   `toggleAuditorActiveAction(id: string): Promise<{ success: boolean; error?: string; is_active?: boolean }>`
 * Rola pochodzi z `getCurrentActorRole()` (ten sam wzorzec co deleteAuditorAction) —
 * mockujemy ten modul identycznie jak w auditors-delete.test.ts.
 *
 * Mockujemy @repo/database i next/cache — brak zywej instancji testowej, revalidatePath
 * wymaga kontekstu zadania Next.js.
 */

const { auditorFindUniqueMock, auditorUpdateMock, revalidatePathMock, getCurrentActorRoleMock, getCurrentUserMock } = vi.hoisted(() => ({
  auditorFindUniqueMock: vi.fn(),
  auditorUpdateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    audytorzy: {
      findUnique: auditorFindUniqueMock,
      update: auditorUpdateMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — ten plik nie testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser` dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });

const { toggleAuditorActiveAction } = await import('../src/app/(dashboard)/auditors/actions');

describe('toggleAuditorActiveAction - odwracalnosc blokady audytora (CRM-AUDYT-AC1.7)', () => {
  beforeEach(() => {
    auditorFindUniqueMock.mockReset();
    auditorUpdateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // @REQ: CRM-AUDYT-AC1
  it('AC1.7 - drugie wywolanie na tym samym audytorze przywraca is_active: true', async () => {
    // Pierwsze wywolanie: audytor aktywny -> zablokowany.
    auditorFindUniqueMock.mockResolvedValueOnce({ is_active: true });
    auditorUpdateMock.mockResolvedValueOnce({ is_active: false });

    const firstToggle = await toggleAuditorActiveAction('aud-1');
    expect(firstToggle.success).toBe(true);
    expect(firstToggle.is_active).toBe(false);
    expect(auditorUpdateMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: 'aud-1' },
      data: { is_active: false },
    }));

    // Drugie wywolanie: audytor zablokowany -> odblokowany.
    auditorFindUniqueMock.mockResolvedValueOnce({ is_active: false });
    auditorUpdateMock.mockResolvedValueOnce({ is_active: true });

    const secondToggle = await toggleAuditorActiveAction('aud-1');
    expect(secondToggle.success).toBe(true);
    expect(secondToggle.is_active).toBe(true);
    expect(auditorUpdateMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { id: 'aud-1' },
      data: { is_active: true },
    }));
  });

  // @REQ: CRM-AUDYT-AC1
  it('rola inna niz admin jest odrzucona (PERMISSIONS.auditors.update)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await toggleAuditorActiveAction('aud-1');

    expect(result.success).toBe(false);
    expect(auditorUpdateMock).not.toHaveBeenCalled();
  });

  // Fail-closed: brak roli nie moze przejsc jako "brak sprawdzenia".
  // @REQ: CRM-AUDYT-AC1
  it('brak roli (null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await toggleAuditorActiveAction('aud-1');

    expect(result.success).toBe(false);
    expect(auditorUpdateMock).not.toHaveBeenCalled();
  });

  // Przypadek brzegowy: audytor nieistniejacy nie ma czego przelaczac.
  // @REQ: CRM-AUDYT-AC1
  it('przypadek brzegowy - audytor nieznaleziony zwraca blad, update nie jest wywolywany', async () => {
    auditorFindUniqueMock.mockResolvedValue(null);

    const result = await toggleAuditorActiveAction('nieistniejacy');

    expect(result.success).toBe(false);
    expect(auditorUpdateMock).not.toHaveBeenCalled();
  });
});
