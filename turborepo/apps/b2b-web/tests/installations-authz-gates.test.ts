import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, PERMISSIONS, can } from '@klikklima/contracts';

/**
 * SEC-AUTHZ-B2B-MUTATIONS — pokrycie dla `installations/actions.ts`
 * (`docs/workorders/SEC-AUTHZ-B2B-MUTATIONS.md`, findings #4 i #6).
 *
 * `updateInstallationStatus` — bramka MUSI wymagac dokladnie
 * `can(role, 'installations', 'update') === 'yes'`, NIE `!== 'no'`. To jest znana
 * pulapka tej sesji (AC4 z WO): `can('monter', 'installations', 'update')` zwraca
 * `'own'` (`contracts/rbac.contract.mjs:32`), a `!== 'no'` przepusciloby ten wariant,
 * mimo ze ZADEN kod w tym repo nie implementuje sprawdzenia wlasnosci rekordu (D2 z
 * WO: swiadomie odcieta, wariant 'own' NIE przepuszcza w tej turze). Funkcja mutuje
 * DWA zasoby naraz przy `newStatus === "COMPLETED"`
 * (`prisma.instalacje.update` + `prisma.leady.update`) — oba MUSZA byc zablokowane
 * razem dla roli bez `installations.update === 'yes'`.
 *
 * `deleteInstallationAction` — bramka `can(role, 'installations', 'delete') === 'yes'`
 * (`contracts/rbac.contract.mjs:32` -> wylacznie `admin`).
 *
 * Funkcja `assignCrew` (installations/actions.ts:77) jest martwym kodem — zero
 * wywolan w calym repo poza wlasna definicja (potwierdzone grep w WO) i homonimem
 * akcji kontraktowej T05 realizowanej przez `assignCrewToLead`
 * (`leads/actions.ts:159`) — decyzja D3 to CALKOWITE usuniecie, nie dopisanie
 * bramki. Ten plik SWIADOMIE nie zawiera dla niej zadnego testu.
 *
 * Wzorzec bramki 1:1 z `deleteLeadAction` (`leads/actions.ts:490`). Sygnatura
 * docelowa obu funkcji: dzis `void`, po naprawie `{ success: boolean; error?: string }`
 * (edge case WO "Odmowa odroznialna od sukcesu" — `installations-client.tsx:28,41`).
 *
 * Mockujemy @repo/database, next/cache (revalidatePath) i
 * ../src/utils/supabase/server (getCurrentActorRole).
 */

const {
  installationUpdateMock,
  installationDeleteMock,
  leadUpdateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
} = vi.hoisted(() => ({
  installationUpdateMock: vi.fn(),
  installationDeleteMock: vi.fn(),
  leadUpdateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    instalacje: {
      update: installationUpdateMock,
      delete: installationDeleteMock,
    },
    leady: {
      update: leadUpdateMock,
    },
  },
  InstallationStatus: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

const { updateInstallationStatus, deleteInstallationAction } = await import(
  '../src/app/(dashboard)/installations/actions'
);

const UPDATE_ALLOWED_ROLES = ROLES.filter((r) => can(r, 'installations', 'update') === 'yes');
const UPDATE_DENIED_ROLES = ROLES.filter((r) => can(r, 'installations', 'update') !== 'yes');
const DELETE_ALLOWED_ROLES = ROLES.filter((r) => can(r, 'installations', 'delete') === 'yes');
const DELETE_DENIED_ROLES = ROLES.filter((r) => can(r, 'installations', 'delete') !== 'yes');

describe('updateInstallationStatus — bramka roli (SEC-AUTHZ-B2B-MUTATIONS)', () => {
  beforeEach(() => {
    installationUpdateMock.mockReset();
    installationDeleteMock.mockReset();
    leadUpdateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // Bramka pokrywa OBA statusy (nie-COMPLETED i COMPLETED), obie mutacje
  // (instalacje.update + leady.update) sa zablokowane razem dla roli bez update.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(UPDATE_DENIED_ROLES)(
    'rola %s jest odrzucona przy statusie COMPLETED, ani mutacja instalacji ani mutacja leada nie sa wywolane',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'installations', 'update')).not.toBe('yes');

      const result = await updateInstallationStatus('inst-1', 'COMPLETED' as never);

      expect(getCurrentActorRoleMock).toHaveBeenCalled();
      expect(installationUpdateMock).not.toHaveBeenCalled();
      expect(leadUpdateMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Pulapka AC4: monter ma 'own', NIE 'yes' — MUSI byc odrzucony, bo zadna czesc
  // kodu nie sprawdza wlasnosci rekordu. Test jawnie dowodzi wartosci zwracanej
  // przez can() PRZED wywolaniem akcji, zeby nie dalo sie przejsc tego testu przez
  // przypadek (naprawa oparta na `!== 'no'` przepuscilaby monter i test by to zlapal).
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('monter ma wariant "own" na installations.update, ale MUSI zostac odrzucony (brak realizacji :own)', async () => {
    expect(can('monter', 'installations', 'update')).toBe('own');
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await updateInstallationStatus('inst-1', 'COMPLETED' as never);

    expect(installationUpdateMock).not.toHaveBeenCalled();
    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: brak roli.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await updateInstallationStatus('inst-1', 'IN_PROGRESS' as never);

    expect(installationUpdateMock).not.toHaveBeenCalled();
    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await updateInstallationStatus('inst-1', 'COMPLETED' as never);

    expect(installationUpdateMock).not.toHaveBeenCalled();
    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla kazdej dozwolonej roli osobno (AC3) — status nie-COMPLETED,
  // wiec tylko instalacje.update powinno byc wywolane.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(UPDATE_ALLOWED_ROLES)(
    'rola %s jest dozwolona, status IN_PROGRESS aktualizuje wylacznie rekord montażu',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      installationUpdateMock.mockResolvedValue({ id: 'inst-1', lead_id: 'lead-1' });

      const result = await updateInstallationStatus('inst-1', 'IN_PROGRESS' as never);

      expect(result).toEqual({ success: true });
      expect(installationUpdateMock).toHaveBeenCalled();
      expect(leadUpdateMock).not.toHaveBeenCalled();
    },
  );

  // Kontrola pozytywna: status COMPLETED, rola dozwolona -> obie mutacje wywolane.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(UPDATE_ALLOWED_ROLES)(
    'rola %s jest dozwolona, status COMPLETED aktualizuje rekord montażu ORAZ leada',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      installationUpdateMock.mockResolvedValue({ id: 'inst-1', lead_id: 'lead-1' });
      leadUpdateMock.mockResolvedValue({});

      const result = await updateInstallationStatus('inst-1', 'COMPLETED' as never);

      expect(result).toEqual({ success: true });
      expect(installationUpdateMock).toHaveBeenCalled();
      expect(leadUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-1' },
          data: expect.objectContaining({ status: 'INSTALLATION_COMPLETED' }),
        }),
      );
    },
  );

  // Kontrola pozytywna kontraktu.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('kontrola pozytywna kontraktu — installations.update ma admin, dyspozytor (yes) i monter (own)', () => {
    expect(PERMISSIONS.installations.update).toEqual(['admin', 'dyspozytor', 'monter:own']);
    expect(can('admin', 'installations', 'update')).toBe('yes');
    expect(can('dyspozytor', 'installations', 'update')).toBe('yes');
    expect(can('monter', 'installations', 'update')).toBe('own');
    expect(can('audytor', 'installations', 'update')).toBe('no');
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek ani void', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');

    const result = await updateInstallationStatus('inst-1', 'COMPLETED' as never);

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });
});

describe('deleteInstallationAction — bramka roli (SEC-AUTHZ-B2B-MUTATIONS)', () => {
  beforeEach(() => {
    installationUpdateMock.mockReset();
    installationDeleteMock.mockReset();
    leadUpdateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(DELETE_DENIED_ROLES)(
    'rola %s jest odrzucona, mutacja usunięcia montażu nie jest wywołana',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'installations', 'delete')).not.toBe('yes');

      const result = await deleteInstallationAction('inst-1');

      expect(getCurrentActorRoleMock).toHaveBeenCalled();
      expect(installationDeleteMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Pulapka AC4 rowniez tutaj: monter (installations.update = 'own') NIE ma
  // installations.delete w ogole ('no'), wiec musi byc odrzucony niezaleznie.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('monter nie ma installations.delete, jest odrzucony', async () => {
    expect(can('monter', 'installations', 'delete')).toBe('no');
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await deleteInstallationAction('inst-1');

    expect(installationDeleteMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: brak roli.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await deleteInstallationAction('inst-1');

    expect(installationDeleteMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await deleteInstallationAction('inst-1');

    expect(installationDeleteMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla kazdej dozwolonej roli osobno.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(DELETE_ALLOWED_ROLES)('rola %s jest dozwolona, delete faktycznie wywolane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    installationDeleteMock.mockResolvedValue({});

    const result = await deleteInstallationAction('inst-1');

    expect(result).toEqual({ success: true });
    expect(installationDeleteMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inst-1' } }),
    );
  });

  // Kontrola pozytywna kontraktu.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('kontrola pozytywna kontraktu — wylacznie admin ma delete na installations w macierzy RBAC', () => {
    expect(PERMISSIONS.installations.delete).toEqual(['admin']);
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek ani void', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    const result = await deleteInstallationAction('inst-1');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });
});

/**
 * BATCH-MEDIUM-LOW-CLEANUP — Punkt 18: `getCurrentActorRole()` jest dzis WEWNATRZ
 * `try` obejmujacego mutacje, wiec gdy rzuci wyjatek, uzytkownik dostaje generyczny
 * komunikat "Nie udało się..." zamiast odmowy uprawnien. Wzorzec docelowy:
 * `leads/actions.ts` (returnToFunnel/archiveLost), gdzie bramka jest przed `try`.
 */
describe('installations/actions.ts — Punkt 18: fail-closed przed try (BATCH-MEDIUM-LOW-CLEANUP)', () => {
  beforeEach(() => {
    installationUpdateMock.mockReset();
    installationDeleteMock.mockReset();
    leadUpdateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
  });

  // AC18.1 / AC18.2
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('updateInstallationStatus: getCurrentActorRole rzuca -> odmowa uprawnien (nie generyczny blad zapisu), zero mutacji', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('sesja wygasla'));

    const result = await updateInstallationStatus('inst-1', 'COMPLETED' as never);

    expect(installationUpdateMock).not.toHaveBeenCalled();
    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/uprawn/i);
    expect(result.error).not.toMatch(/nie udało się/i);
  });

  // AC18.1 / AC18.2
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('deleteInstallationAction: getCurrentActorRole rzuca -> odmowa uprawnien (nie generyczny blad zapisu), zero wywolan mutacji usunięcia montażu', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('sesja wygasla'));

    const result = await deleteInstallationAction('inst-1');

    expect(installationDeleteMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/uprawn/i);
    expect(result.error).not.toMatch(/nie udało się/i);
  });
});
