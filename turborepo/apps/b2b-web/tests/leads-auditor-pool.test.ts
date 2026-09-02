import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISSIONS, can } from '@klikklima/contracts';

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
 * DOPISANO (CRM-LEAD-UPDATE-ADMIN-DISPATCHER, review 2026-08-25): `updateLeadAuditor`
 * nie ma dzis ZADNEGO sprawdzenia roli — dowolne zalogowane konto (audytor spoza
 * sprawy, monter) moze dzis przez bezposrednie wywolanie tej Server Action podmienic
 * audytora dowolnego leada. Macierz: `leads.update = ['admin', 'dyspozytor']` (NIE
 * admin-only, w odroznieniu od CRM-DELETE-ADMIN-ONLY). Dopisujemy mock
 * `getCurrentActorRole` (wzorem crews-admin-gates.test.ts / auditors-toggle-active.test.ts)
 * i nowy opis testowy z bramka roli. Trzy JUZ ISTNIEJACE testy logiki `is_active`
 * (ponizej, w tym samym describe) MUSZA dalej przechodzic pod dozwolona rola — dlatego
 * beforeEach tego describe ustawia `getCurrentActorRoleMock.mockResolvedValue('dyspozytor')`
 * (rola dozwolona w `leads.update`), zeby bramka roli — gdy powstanie w produkcji —
 * nie zaslaniala logiki `is_active`, ktora te testy faktycznie sprawdzaja. Dzis (przed
 * implementacja bramki) ten mock jest zwyczajnie nieuzywany przez kod produkcyjny i te
 * trzy testy przechodza dokladnie tak jak wczesniej.
 *
 * Mockujemy @repo/database (brak zywej instancji testowej), next/cache
 * (revalidatePath wymaga kontekstu zadania Next.js) i ../src/utils/supabase/server
 * (getCurrentActorRole). Model Prisma po polsku (audytorzy, leady) — dlug
 * KK-NAMING-BASELINE, ADR-002 zamrozony.
 */

const {
  auditorFindManyMock,
  auditorFindUniqueMock,
  leadFindUniqueMock,
  leadUpdateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  auditorFindManyMock: vi.fn(),
  auditorFindUniqueMock: vi.fn(),
  leadFindUniqueMock: vi.fn(),
  leadUpdateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
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
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — ten plik nie testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser` dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });

const { getAuditors } = await import('../src/app/(dashboard)/leads/actions');
const { updateLeadAuditor } = await import('../src/app/(dashboard)/leads/[id]/actions');

const UNAUTHORIZED_LEAD_UPDATE_ROLES = ['audytor', 'monter'] as const;

describe('getAuditors (leads/actions.ts) - pula wyboru wyklucza zablokowanych (CRM-AUDYT-AC1.6)', () => {
  beforeEach(() => {
    auditorFindManyMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    // Przygotowanie pod bramkę roli (patrz leads-get-auditors-authz-gate.test.ts,
    // dopisane w tej samej turze): dziś getAuditors() nie sprawdza roli w ogóle, więc
    // ten mock jest jeszcze nieużywany przez kod produkcyjny. Rola dozwolona w
    // auditors.read (['admin','dyspozytor']) ustawiona z góry, żeby te testy logiki
    // is_active dalej przechodziły POD przyszłą bramką, nie zamiast niej — dokładnie
    // ten sam wzorzec co beforeEach niżej w tym pliku (updateLeadAuditor).
    getCurrentActorRoleMock.mockResolvedValue('admin');
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
    getCurrentActorRoleMock.mockReset();
    // Rola dozwolona w leads.update (['admin','dyspozytor']) — te testy sprawdzaja
    // logike is_active/przejscia statusu, POD bramka roli, nie zamiast niej.
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
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

describe('updateLeadAuditor - bramka roli (CRM-LEAD-UPDATE-ADMIN-DISPATCHER)', () => {
  beforeEach(() => {
    leadFindUniqueMock.mockReset();
    leadUpdateMock.mockReset();
    auditorFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // Kryterium 1 kontraktu: audytor/monter odrzucony PRZED jakimkolwiek zapytaniem do
  // Prismy — takze zapytaniem odczytujacym (leadFindUniqueMock).
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it.each(UNAUTHORIZED_LEAD_UPDATE_ROLES)(
    'rola %s jest odrzucona przed jakimkolwiek zapytaniem do Prismy',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'leads', 'update')).toBe('no');

      const result = await updateLeadAuditor('lead-1', 'aud-active');

      expect(leadFindUniqueMock).not.toHaveBeenCalled();
      expect(auditorFindUniqueMock).not.toHaveBeenCalled();
      expect(leadUpdateMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Kryterium 4 kontraktu: fail-closed, brak roli.
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await updateLeadAuditor('lead-1', 'aud-active');

    expect(leadFindUniqueMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Kryterium 4 kontraktu: blad samego zapytania o role konczy sie odmowa, nie
  // nieobslugowanym wyjatkiem (bramka musi stac PRZED try/catch ciala akcji albo miec
  // wlasna obsluge — dzisiejsze cialo jest w try/catch zwracajacym blad zapisu).
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await updateLeadAuditor('lead-1', 'aud-active');

    expect(leadFindUniqueMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kryterium 3 kontraktu: kontrola pozytywna OSOBNO dla admin i OSOBNO dla dyspozytor —
  // bez tego zestaw przechodzi tez dla bramki bledenie zawezonej do samego admina.
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('admin - dozwolony, wywolanie konczy sie zapisem', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    leadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'NEW_LEAD' });
    auditorFindUniqueMock.mockResolvedValue({ is_active: true });
    leadUpdateMock.mockResolvedValue({});

    const result = await updateLeadAuditor('lead-1', 'aud-active');

    expect(result.success).toBe(true);
    expect(leadUpdateMock).toHaveBeenCalled();
  });

  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('dyspozytor - dozwolony, wywolanie konczy sie zapisem', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    leadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'NEW_LEAD' });
    auditorFindUniqueMock.mockResolvedValue({ is_active: true });
    leadUpdateMock.mockResolvedValue({});

    const result = await updateLeadAuditor('lead-1', 'aud-active');

    expect(result.success).toBe(true);
    expect(leadUpdateMock).toHaveBeenCalled();
  });

  // Kontrola pozytywna kontraktu (wzorem crews-admin-gates.test.ts) — dowod, ze
  // macierz RBAC faktycznie przyznaje leads.update adminowi i dyspozytorowi razem,
  // zeby bramka nie "przechodzila" odrzucajac wszystkich.
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('kontrola pozytywna kontraktu - admin i dyspozytor maja update na leads w macierzy RBAC', () => {
    expect(can('admin', 'leads', 'update')).toBe('yes');
    expect(can('dyspozytor', 'leads', 'update')).toBe('yes');
    expect(PERMISSIONS.leads.update).toEqual(['admin', 'dyspozytor']);
  });

  // Odmowa ma jawny, odroznialny ksztalt — nie wyjatek, nie cichy sukces.
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await updateLeadAuditor('lead-1', 'aud-active');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });
});
