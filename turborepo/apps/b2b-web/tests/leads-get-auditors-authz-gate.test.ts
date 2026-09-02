import { describe, it, expect, vi, beforeEach } from 'vitest';
import { can } from '@klikklima/contracts';

/**
 * RED nowa luka (nie WO — znalezisko sesji porządkującej wzorzec "zapytanie przed
 * autoryzacją", ten sam co `kk-authz-gate.mjs` łapał wcześniej w akcjach mutujących).
 *
 * `getAuditors()` w `leads/actions.ts` (pula wyboru audytora przy przypisywaniu do
 * leada, RÓŻNA od `getAuditors()` w `auditors/actions.ts` — panel kartoteki, świadomie
 * poza zakresem, patrz SEC-ASSIGNMENT-POOL-MINIMIZE) dziś w ogóle nie odpytuje
 * `getCurrentActorRole()` ani `can()` — woła `prisma.audytorzy.findMany()` gołym
 * odczytem. Macierz `contracts/rbac.contract.mjs` (`auditors.read = ['admin',
 * 'dyspozytor']`) wyklucza `audytor` i `monter` z tej puli, ale kod tej reguły nigdy
 * nie sprawdza. Do tej pory chroniła go przypadkowa kolejność w `leads/page.tsx`
 * (`await getLeads()` przed `getAuditors()`, `notFound()` przy odmowie) — zrównoleglenie
 * przez `Promise.all` tę przypadkową ochronę usunęło, więc zapytanie do `audytorzy`
 * startuje dziś dla KAŻDEJ roli, niezależnie od tego, czy wynik trafia do przeglądarki.
 * Dane nie wyciekają (odrzucone przed renderem), ale to dokładnie wzorzec "zapytanie
 * przed autoryzacją" — dowodem odmowy jest BRAK WYWOŁANIA `prisma.audytorzy.findMany`,
 * nie tylko odrzucony wynik (ten sam standard dowodowy co SEC-AUTHZ-B2B-MUTATIONS).
 *
 * Brak dedykowanego ID w `contracts/requirements.contract.mjs`: SEC-AUTHZ-B2B-MUTATIONS
 * jest jawnie zawężone do MUTACJI ("Każda Server Action ..., która wykonuje mutację
 * przez Prismę"), `getAuditors()` to czysty odczyt. SEC-ASSIGNMENT-POOL-MINIMIZE pilnuje
 * KSZTAŁTU zwracanych kolumn, nie tego, KTO w ogóle ma prawo odpytać — different oś tej
 * samej funkcji, już pokryta osobnym plikiem testów (jeśli/gdy powstanie). Zostawiamy
 * ten plik bez `@REQ`, żeby `node tools/kk-trace.mjs --enforce` nie dostał odnośnika do
 * ID, którego statement mu nie odpowiada.
 *
 * Kształt odmowy: zachowujemy DZISIEJSZY kontrakt zwrotny `getAuditors()` — funkcja już
 * dziś zwraca `[]` w gałęzi `catch`, więc pusta tablica jest naturalną, już-istniejącą
 * formą "nic do pokazania" i nie wymaga nowego typu ani zmiany u wywołujących
 * (`lead-detail-page-pool-spread.test.ts` mockuje `getAuditors` całkowicie i nie zależy
 * od tego rozróżnienia).
 *
 * Mockujemy `@repo/database` (`prisma.audytorzy.findMany` — dowód przez ZERO wywołań
 * dla ról bez uprawnień) i `../src/utils/supabase/server` (`getCurrentActorRole`).
 */

const { auditorFindManyMock, getCurrentActorRoleMock } = vi.hoisted(() => ({
  auditorFindManyMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    audytorzy: {
      findMany: auditorFindManyMock,
    },
  },
}));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

const { getAuditors } = await import('../src/app/(dashboard)/leads/actions');

const UNAUTHORIZED_ROLES = ['audytor', 'monter'] as const;

beforeEach(() => {
  auditorFindManyMock.mockReset();
  getCurrentActorRoleMock.mockReset();
});

describe('getAuditors (leads/actions.ts) - bramka roli PRZED zapytaniem (auditors.read = admin/dyspozytor)', () => {
  // Kontrola kontraktu: dowód, że macierz faktycznie wyklucza te dwie role z
  // auditors.read — bez tego cała bateria mogłaby przechodzić dla bramki
  // sprawdzającej złą zdolność.
  it('kontrola pozytywna kontraktu - audytor i monter NIE mają auditors.read w macierzy RBAC', () => {
    expect(can('audytor', 'auditors', 'read')).not.toBe('yes');
    expect(can('monter', 'auditors', 'read')).not.toBe('yes');
    expect(can('admin', 'auditors', 'read')).toBe('yes');
    expect(can('dyspozytor', 'auditors', 'read')).toBe('yes');
  });

  it.each(UNAUTHORIZED_ROLES)(
    'rola %s jest odrzucona PRZED jakimkolwiek zapytaniem do prisma.audytorzy.findMany',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await getAuditors();

      expect(auditorFindManyMock).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    },
  );

  // Fail-closed: brak roli (sesja nieznana / e-mail spoza authorized_users).
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed, findMany nie jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await getAuditors();

    expect(auditorFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  // Fail-closed: błąd samego zapytania o rolę kończy się odmową, nie nieobsłużonym
  // wyjątkiem wyciekającym do wywołującego (leads/page.tsx renderuje bezpośrednio
  // wynik tej funkcji w Promise.all).
  it('błąd zapytania o rolę daje odmowę (pustą pulę), nie nieobsłużony wyjątek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const result = await getAuditors();

    expect(auditorFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  // Kontrola pozytywna OSOBNO dla admin i OSOBNO dla dyspozytor — bez tego zestaw
  // przechodzi też dla bramki błędnie zawężonej do samego admina.
  it('admin - dozwolony, findMany jest wołane i wynik przechodzi (zachowanie bez zmian)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    auditorFindManyMock.mockResolvedValue([
      { id: 'aud-1', imie_i_nazwisko: 'Jan Aktywny', zdjecie_url: null, is_active: true, availability_declaration: null },
    ]);

    const result = await getAuditors();

    expect(auditorFindManyMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 'aud-1', imie_i_nazwisko: 'Jan Aktywny', zdjecie_url: null }]);
  });

  it('dyspozytor - dozwolony, findMany jest wołane i wynik przechodzi (zachowanie bez zmian)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    auditorFindManyMock.mockResolvedValue([
      { id: 'aud-1', imie_i_nazwisko: 'Jan Aktywny', zdjecie_url: null, is_active: true, availability_declaration: null },
    ]);

    const result = await getAuditors();

    expect(auditorFindManyMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 'aud-1', imie_i_nazwisko: 'Jan Aktywny', zdjecie_url: null }]);
  });

  // Dowód, że bramka precede'uje istniejący filtr `is_active`/dostępności — nie
  // duplikujemy tu całej baterii CRM-AUDYT-AC1.6 (leads-auditor-pool.test.ts), tylko
  // sprawdzamy, że dla roli DOZWOLONEJ istniejąca logika filtrowania nadal działa
  // dokładnie tak samo (zablokowany audytor nie wraca).
  it('admin - zablokowany audytor (is_active=false) nadal filtrowany przez where, bramka roli tego nie zmienia', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    auditorFindManyMock.mockResolvedValue([]);

    await getAuditors();

    expect(auditorFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ is_active: true }) }),
    );
  });
});
