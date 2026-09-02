import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, PERMISSIONS, can } from '@klikklima/contracts';

/**
 * SEC-AUTHZ-B2B-MUTATIONS — pokrycie dla `customers/actions.ts`
 * (`docs/workorders/SEC-AUTHZ-B2B-MUTATIONS.md`, findings #1 i #2).
 *
 * addCustomerAddress — bramka `can(role, 'clients', 'update') === 'yes'`
 * (decyzja D1(a) z WO: adres jako czesc agregatu klienta, NIE nowy zasob RBAC —
 * `contracts/rbac.contract.mjs:29` -> `['admin', 'dyspozytor']`).
 *
 * ═══════════════════════ WO CLIENT-ANONYMIZATION-RODO (2026-09-01) ═══════════════════════
 *
 * `deleteCustomerAction` ZNIKA z `customers/actions.ts` w Fazie B tego WO — zastępuje ją
 * `anonymizeClientAction(id, { justification, legalBasis })`. Stara nazwa NIE zostaje jako
 * alias (alias to druga ścieżka kasowania — AC4 WO). Sześć przypadków, które do tej pory
 * pokrywały `deleteCustomerAction` w tym pliku, jest PRZENIESIONYCH do nowego, dedykowanego
 * pliku `customers-anonymize-rodo.test.ts` w kształcie odpowiadającym nowej sygnaturze i
 * nowej kolejności bramek (AC1-AC8 WO). Ten plik zostaje wyłącznie dla `addCustomerAddress`,
 * które WO nie dotyka.
 *
 * Mockujemy @repo/database (brak zywej instancji testowej), next/cache (revalidatePath
 * wymaga kontekstu zadania Next.js) i ../src/utils/supabase/server (getCurrentActorRole
 * wola next/headers cookies(), ktore poza kontekstem zadania rzuca).
 */

const {
  adresCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
} = vi.hoisted(() => ({
  adresCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    adresy: {
      create: adresCreateMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

const actions = await import('../src/app/(dashboard)/customers/actions');
const { addCustomerAddress } = actions;

const UPDATE_ALLOWED_ROLES = ROLES.filter((r) => can(r, 'clients', 'update') === 'yes');
const UPDATE_DENIED_ROLES = ROLES.filter((r) => can(r, 'clients', 'update') !== 'yes');

// AC4 (WO CLIENT-ANONYMIZATION-RODO): la nazwa `deleteCustomerAction` nie może być
// eksportowana ani importowana nigdzie w repozytorium (poza samym testem statyczny
// nad tekstem źródeł, patrz `customers-anonymize-rodo.test.ts`). Ten test dowodzi
// wprost, że moduł `customers/actions.ts` NIE eksportuje już tej nazwy.
// @REQ: CRM-CLIENT-ANONYMIZE-RODO
describe('customers/actions.ts — deleteCustomerAction USUNIĘTE (WO CLIENT-ANONYMIZATION-RODO)', () => {
  it('deleteCustomerAction nie jest eksportowane z customers/actions.ts', () => {
    expect('deleteCustomerAction' in actions).toBe(false);
  });
});

describe('addCustomerAddress — bramka roli (SEC-AUTHZ-B2B-MUTATIONS, decyzja D1(a))', () => {
  beforeEach(() => {
    adresCreateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(UPDATE_DENIED_ROLES)(
    'rola %s jest odrzucona, mutacja dodania adresu nie jest wywołana',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'clients', 'update')).not.toBe('yes');

      const result = await addCustomerAddress('klient-1', 'Warszawa, ul. Testowa 1');

      expect(getCurrentActorRoleMock).toHaveBeenCalled();
      expect(adresCreateMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Fail-closed: brak roli.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await addCustomerAddress('klient-1', 'Warszawa, ul. Testowa 1');

    expect(adresCreateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await addCustomerAddress('klient-1', 'Warszawa, ul. Testowa 1');

    expect(adresCreateMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla kazdej dozwolonej roli osobno (AC3).
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(UPDATE_ALLOWED_ROLES)(
    'rola %s jest dozwolona, create faktycznie wywolane',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      adresCreateMock.mockResolvedValue({});

      const result = await addCustomerAddress('klient-1', 'Warszawa, ul. Testowa 1');

      expect(result).toEqual({ success: true });
      expect(adresCreateMock).toHaveBeenCalledWith({
        data: { klient_id: 'klient-1', ulica_miasto: 'Warszawa, ul. Testowa 1' },
      });
    },
  );

  // Kontrola pozytywna kontraktu.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('kontrola pozytywna kontraktu — admin i dyspozytor maja update na clients w macierzy RBAC', () => {
    expect(PERMISSIONS.clients.update).toEqual(['admin', 'dyspozytor']);
    expect(can('audytor', 'clients', 'update')).toBe('no');
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek ani void', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await addCustomerAddress('klient-1', 'Warszawa, ul. Testowa 1');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });
});

/**
 * BATCH-MEDIUM-LOW-CLEANUP — Punkt 18: `getCurrentActorRole()` jest dzis WEWNATRZ
 * `try` obejmujacego mutacje, wiec gdy rzuci wyjatek, uzytkownik dostaje generyczny
 * komunikat "Nie udało się..." zamiast odmowy uprawnien. Wzorzec docelowy:
 * `leads/actions.ts` (returnToFunnel/archiveLost), gdzie bramka jest przed `try`.
 *
 * Przypadek `deleteCustomerAction` z tego opisu jest teraz `anonymizeClientAction` i
 * jego RÓWNOWAŻNIK żyje w `customers-anonymize-rodo.test.ts` (AC6 WO CLIENT-
 * ANONYMIZATION-RODO — ta sama kolejność, ten sam wymóg fail-closed przed `try`).
 */
describe('customers/actions.ts — Punkt 18: fail-closed przed try (BATCH-MEDIUM-LOW-CLEANUP)', () => {
  beforeEach(() => {
    adresCreateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
  });

  // AC18.1 / AC18.2
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('addCustomerAddress: getCurrentActorRole rzuca -> odmowa uprawnien (nie generyczny blad zapisu), zero wywolan mutacji dodania adresu', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('sesja wygasla'));

    const result = await addCustomerAddress('klient-1', 'Warszawa, ul. Testowa 1');

    expect(adresCreateMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/uprawn/i);
    expect(result.error).not.toMatch(/nie udało się/i);
  });
});
