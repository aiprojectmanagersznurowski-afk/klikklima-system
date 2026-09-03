import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ROLES, can, AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * WO: docs/workorders/CLIENT-ANONYMIZATION-RODO.md — Faza B (`test-author` → `implementer-server`).
 * Wymaganie: `CRM-CLIENT-ANONYMIZE-RODO` (`contracts/requirements.contract.mjs:176`, status TODO).
 *
 * Faza A (schemat/kontrakt) jest już na `main`, zweryfikowana bezpośrednim zapytaniem do żywej
 * bazy przez poprzednią turę: tabela `audit_log` (model Prisma `AuditLog`, `@@map("audit_log")`,
 * wyzwalacz append-only `audit_log_append_only_trg`, CHECK-i na `operation`/`resource`/
 * `legal_basis`/`justification`) i kolumna `klienci.anonymized_at`. AC9 (append-only, warstwa
 * bazy) jest POZA ZAKRESEM tego pliku. SPROSTOWANIE (docs/workorders/SEC-AUDIT-COVERAGE-RETAG.md,
 * Blok C3): do 2026-09-03 to zdanie było FAŁSZYWE — żaden plik testowy w repozytorium nie
 * odwoływał się do migracji 20260901220000 (zweryfikowane grepem). Dziś jest pokryte statycznie
 * (bez żywego Postgresa) w `sec-audit-log-append-only-migration-static.test.ts` (funkcja/trigger/
 * ENABLE RLS/CHECK-i, tekst migracji) i `sec-audit-log-append-only-permissions.test.ts`
 * (`PERMISSIONS.audit_log` ma `update`/`delete` puste) — oba otagowane wymaganiem
 * SEC-AUDIT-LOG-APPEND-ONLY (bez dwukropka, żeby nie mylić skanera kk-trace, który
 * liczy znaczniki tekstowo, z faktycznym pokryciem bloku `it` w TYM pliku).
 *
 * ═══════════════════════ ODKRYCIE PRZY PISANIU TEGO PLIKU (zgłoszenie, nie TEST-DEFECT) ═══
 *
 * `AUDIT_REQUIREMENTS` (progi `legalBases`, `mustLog`, `requiresJustification`) jest zdefiniowane
 * w `contracts/rbac.contract.mjs`, ale `tools/kk-codegen.mjs` (linia z `import(... 'rbac.contract.mjs')`)
 * dziś destrukturyzuje z tego modułu WYŁĄCZNIE `ROLES`, `MATRIX`, `DELETE_POLICIES` — `AUDIT_
 * REQUIREMENTS` NIE trafia do `packages/contracts/src/generated/rbac.ts` i nie jest eksportowane
 * z `@klikklima/contracts`. Import poniżej jest więc CELOWO na obecnie nieistniejącym eksporcie:
 * to jest poprawny RED tego pliku (kategoria „brak eksportu funkcji/wartości domenowej", nie
 * literówka ani błąd składni) i sygnalizuje lukę, którą `contract-steward` musi zamknąć w
 * `kk-codegen.mjs` PRZED (albo równolegle z) fazą GREEN tego WO — bez tego eksportu implementer
 * i tak nie ma skąd wziąć progu `legalBases` bez łamania zasady „zero literałów" tej roli.
 * Nie naprawiam tego sam: `tools/kk-codegen.mjs` i `packages/contracts/src/generated/` są poza
 * uprawnieniami `test-author` (i są plikami generowanymi/narzędziowymi kontraktu).
 *
 * ═══════════════════════ KSZTAŁT AKCJI (z WO, kolejność wiążąca) ═══════════════════════
 *
 * `anonymizeClientAction(id: string, input: { justification: string; legalBasis: string }):
 *    Promise<{ success: boolean; error?: string }>`, zastępuje USUNIĘTĄ `deleteCustomerAction`
 * (patrz `customers-authz-gates.test.ts` — ta nazwa tam już nie istnieje).
 *
 * 1. `getCurrentActorRole()` w try/catch → wyjątek = odmowa fail-closed (nie generyczny błąd).
 * 2. `can(actorRole, 'clients', 'delete') !== 'yes'` → odmowa PRZED jakimkolwiek zapytaniem
 *    (zero wywołań `getUser`, zero otwarcia transakcji).
 * 3. Odczyt tożsamości aktora `createClient().auth.getUser()` — brak e-maila = odmowa fail-closed,
 *    PRZED transakcją (audit_log.actor_email jest NOT NULL, więc brak e-maila nie może dotrzeć
 *    do zapisu).
 * 4. Walidacja wejścia: `justification` min. 10 znaków PO trim, `legalBasis` z
 *    `AUDIT_REQUIREMENTS.legalBases` — odrzucone PRZED transakcją.
 * 5. Jedna `prisma.$transaction(async (tx) => { ... })`:
 *    a. `tx.klienci.updateMany({ where: { id, anonymized_at: null }, data: {...} })` — `count`
 *       jest bramką idempotencji/współbieżności.
 *    b. `count === 0` → transakcja kończy się BEZ dotykania `adresy` i BEZ wpisu audytowego,
 *       akcja zwraca `{ success: true }` (rekord nie istnieje albo już zanonimizowany).
 *    c. w przeciwnym razie: `tx.adresy.updateMany({ where: { klient_id: id }, data: {...} })`.
 *    d. `tx.auditLog.create({ data: { operation: 'anonymize', resource: 'clients',
 *       recordId: id, actorEmail, actorRole, justification, legalBasis } })`.
 * 6. `revalidatePath('/customers')` i `revalidatePath('/customers/' + id)` POZA transakcją.
 *
 * ═══════════════════════ MOCKOWANE ZALEŻNOŚCI ═══════════════════════
 *
 * `@repo/database` (brak żywej instancji testowej w tym środowisku — mockujemy WYŁĄCZNIE
 * `$transaction`; wzorzec identyczny do `legal-document-versions.test.ts`, transactionMock
 * woła bezpośrednio `callback(tx)` i `tx` udostępnia `klienci`/`adresy`/`auditLog`. Celowo NIE
 * dodajemy do `tx` żadnych innych modeli (`leady`, `serwisy`, `usterki_incidents`) — próba ich
 * dotknięcia przez implementację skończy się `TypeError`, co jest dodatkowym, twardym dowodem
 * AC2 „żadne inne encje nie są modyfikowane" ponad to, co asercje sprawdzają wprost).
 * `next/cache` (`revalidatePath`) i `../src/utils/supabase/server` (`getCurrentActorRole` i
 * `createClient` wołają `next/headers cookies()`, niedostępne poza kontekstem żądania Next.js).
 *
 * ═══════════════════════ NIETESTOWALNE NA TYM ETAPIE (jawnie, nie milcząco) ═══════════════════
 *
 * - AC1/AC2 w pełnym brzmieniu (odczyt PO operacji z żywej bazy, liczba wierszy `leady`/
 *   `serwisy`/`usterki_incidents`/`adresy` niezmieniona) wymaga integracji z żywym Postgresem —
 *   tu dowodzę WYŁĄCZNIE kształtu payloadu wysyłanego do `tx.klienci.updateMany` i
 *   `tx.adresy.updateMany` (dokładne pola, brak dotknięcia `id`/`klient_id`) oraz strukturalnego
 *   faktu, że `tx` nie ma w ogóle akcesorów do `leady`/`serwisy`/`usterki_incidents`.
 * - AC5 (atomowość — rollback rzeczywiście cofa `klienci` w bazie) jest tu dowodzone wyłącznie
 *   pośrednio: `revalidatePath` (efekt POZA transakcją) nie jest wołane, gdy `tx.auditLog.create`
 *   albo `tx.adresy.updateMany` odrzuci obietnicę. Że Postgres faktycznie wycofa `UPDATE` na
 *   `klienci` w tej samej transakcji, jest własnością silnika bazy, nie kodu JS.
 * - AC9 (wyzwalacz append-only) — jawnie POZA ZAKRESEM tego pliku. Pokryte statycznie w
 *   `sec-audit-log-append-only-migration-static.test.ts` i `sec-audit-log-append-only-permissions.test.ts`
 *   (patrz sprostowanie w nagłówku pliku, Blok C3 SEC-AUDIT-COVERAGE-RETAG.md) — nie tutaj.
 * - Współbieżność (dwa RÓWNOLEGŁE wywołania rywalizujące o ten sam wiersz w PRAWDZIWEJ bazie):
 *   dowodzę wyłącznie, że KAŻDE z dwóch wywołań niezależnie wysyła `where: { id, anonymized_at:
 *   null }` — że Postgres serializuje drugie na `count: 0`, jest własnością bazy, nie mocka
 *   (ten sam wzorzec zastrzeżenia co w `legal-document-versions.test.ts`).
 */

const {
  transactionMock,
  txKlientUpdateManyMock,
  txAdresyUpdateManyMock,
  txAuditLogCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  txKlientUpdateManyMock: vi.fn(),
  txAdresyUpdateManyMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
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
  getCurrentUser: getCurrentUserMock,
  createClient: createClientMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): `getCurrentUser` deleguje do tego samego
// `getUserMock`, którym testy już sterują dla `createClient().auth.getUser()` —
// jeden punkt prawdy o sesji, spójny niezależnie od tego, którą ścieżką kod
// produkcyjny po nią sięgnie.
getCurrentUserMock.mockImplementation(() => getUserMock());

const actions = await import('../src/app/(dashboard)/customers/actions');
const { anonymizeClientAction } = actions;

const tx = {
  klienci: { updateMany: txKlientUpdateManyMock },
  adresy: { updateMany: txAdresyUpdateManyMock },
  auditLog: { create: txAuditLogCreateMock },
};

const ADMIN_EMAIL = 'admin@klikklima.pl';
const VALID_BASIS = AUDIT_REQUIREMENTS.legalBases[0];
const INVALID_BASIS = 'NOT_A_REAL_LEGAL_BASIS';
const VALID_JUSTIFICATION = 'Klient złożył żądanie usunięcia danych osobowych (RODO).';

const DELETE_ALLOWED_ROLES = ROLES.filter((r) => can(r, 'clients', 'delete') === 'yes');
const DELETE_DENIED_ROLES = ROLES.filter((r) => can(r, 'clients', 'delete') !== 'yes');

beforeEach(() => {
  transactionMock.mockReset();
  txKlientUpdateManyMock.mockReset();
  txAdresyUpdateManyMock.mockReset();
  txAuditLogCreateMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();
  createClientMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  getCurrentActorRoleMock.mockResolvedValue('admin');
  getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } });
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
});

// Kontrola pozytywna kontraktu — dowód, że macierz RBAC dziś rzeczywiście rozróżnia role
// (bez tego DELETE_ALLOWED_ROLES/DELETE_DENIED_ROLES mogłyby cicho spłaszczyć się do jednej
// listy i test.each przechodziłby trywialnie z zerem przypadków po jednej stronie).
// @REQ: CRM-CLIENT-ANONYMIZE-RODO
it('kontrola pozytywna kontraktu — wyłącznie admin ma delete na clients w macierzy RBAC', () => {
  expect(DELETE_ALLOWED_ROLES).toEqual(['admin']);
  expect(DELETE_DENIED_ROLES.length).toBeGreaterThan(0);
});

describe('anonymizeClientAction — bramka roli, KROK 1-2 (AC6)', () => {
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  // @REQ: CRM-DELETE-ADMIN-ONLY-CLIENTS
  it.each(DELETE_DENIED_ROLES)(
    'rola %s jest odrzucona PRZED jakimkolwiek zapytaniem: zero getUser, zero transakcji',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await anonymizeClientAction('klient-1', {
        justification: VALID_JUSTIFICATION,
        legalBasis: VALID_BASIS,
      });

      expect(result.success).toBe(false);
      expect(getUserMock).not.toHaveBeenCalled();
      expect(transactionMock).not.toHaveBeenCalled();
      expect(txKlientUpdateManyMock).not.toHaveBeenCalled();
      expect(txAdresyUpdateManyMock).not.toHaveBeenCalled();
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    },
  );

  // Fail-closed: brak roli.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  // @REQ: CRM-DELETE-ADMIN-ONLY-CLIENTS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // KROK 1: wyjątek z getCurrentActorRole() → odmowa uprawnień, nie generyczny błąd zapisu.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  // @REQ: CRM-DELETE-ADMIN-ONLY-CLIENTS
  it('getCurrentActorRole rzuca → odmowa uprawnień (nie generyczny błąd zapisu), zero zapytań', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('sesja wygasła'));

    const result = await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/uprawn/i);
    expect(result.error).not.toMatch(/nie udało się/i);
    expect(getUserMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // Kontrola pozytywna: rola dozwolona NIE jest odrzucona na tym kroku (dowód, że test.each
  // powyżej faktycznie testuje odmowę, a nie przepuszcza wszystko).
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it.each(DELETE_ALLOWED_ROLES)('rola %s przechodzi bramkę roli (dociera do odczytu tożsamości)', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    txKlientUpdateManyMock.mockResolvedValue({ count: 1 });
    txAdresyUpdateManyMock.mockResolvedValue({ count: 0 });
    txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

    await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(getUserMock).toHaveBeenCalled();
  });
});

describe('anonymizeClientAction — tożsamość aktora, KROK 3', () => {
  beforeEach(() => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('brak e-maila w sesji jest odrzucony fail-closed, PRZED transakcją', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: null } } });

    const result = await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // Brak sesji w ogóle (user null) — wariant fail-closed pokrewny brakowi e-maila.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('brak sesji (user: null) jest odrzucony fail-closed, PRZED transakcją', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

describe('anonymizeClientAction — uzasadnienie i podstawa prawna, KROK 4 (AC7)', () => {
  beforeEach(() => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  // @REQ: SEC-AUDIT-LOG
  it('justification pusty jest odrzucony bez żadnego zapisu', async () => {
    const result = await anonymizeClientAction('klient-1', {
      justification: '',
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  // @REQ: SEC-AUDIT-LOG
  it('justification złożony z samych białych znaków jest odrzucony bez żadnego zapisu', async () => {
    const result = await anonymizeClientAction('klient-1', {
      justification: '            ',
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // Granica: 9 znaków po trim (za krótko) jest odrzucone.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  // @REQ: SEC-AUDIT-LOG
  it('justification krótszy niż 10 znaków po trim jest odrzucony bez żadnego zapisu', async () => {
    const result = await anonymizeClientAction('klient-1', {
      justification: '  123456789  ', // 9 znaków po trim
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // Granica: dokładnie 10 znaków po trim jest dozwolone (obliczenie musi trimować PRZED
  // porównaniem, nie liczyć długości surowego stringa z otaczającymi spacjami).
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('justification dokładnie 10 znaków po trim (z otaczającymi spacjami) jest dozwolony', async () => {
    txKlientUpdateManyMock.mockResolvedValue({ count: 1 });
    txAdresyUpdateManyMock.mockResolvedValue({ count: 0 });
    txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

    const result = await anonymizeClientAction('klient-1', {
      justification: '  1234567890  ', // 10 znaków po trim
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(true);
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  // @REQ: SEC-AUDIT-LOG
  it('legalBasis spoza AUDIT_REQUIREMENTS.legalBases jest odrzucony bez żadnego zapisu', async () => {
    expect(AUDIT_REQUIREMENTS.legalBases).not.toContain(INVALID_BASIS);

    const result = await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: INVALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // Kontrola pozytywna: każda wartość dozwolona w kontrakcie przechodzi walidację.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  // @REQ: SEC-AUDIT-LOG
  it.each(AUDIT_REQUIREMENTS.legalBases)('legalBasis %s (z kontraktu) jest dozwolony', async (basis) => {
    txKlientUpdateManyMock.mockResolvedValue({ count: 1 });
    txAdresyUpdateManyMock.mockResolvedValue({ count: 0 });
    txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

    const result = await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: basis,
    });

    expect(result.success).toBe(true);
  });
});

describe('anonymizeClientAction — ścieżka sukcesu, KROK 5 (AC1, AC8)', () => {
  beforeEach(() => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txKlientUpdateManyMock.mockResolvedValue({ count: 1 });
    txAdresyUpdateManyMock.mockResolvedValue({ count: 2 });
    txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
  });

  // AC1: treść, na jaką jest zamieniane PII klienta.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('AC1 — payload updateMany na klienci: gate współbieżności + treść anonimizująca, bez dotknięcia id', async () => {
    await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(txKlientUpdateManyMock).toHaveBeenCalledWith({
      where: { id: 'klient-1', anonymized_at: null },
      data: {
        imie_i_nazwisko: 'Klient usunięty',
        email: null,
        telefon: null,
        anonymized_at: expect.any(Date),
      },
    });
  });

  // AC1: wszystkie adresy klienta, treść anonimizująca — bez dotknięcia id/klient_id.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('AC1 — payload updateMany na adresy: WSZYSTKIE adresy klienta, treść anonimizująca', async () => {
    await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(txAdresyUpdateManyMock).toHaveBeenCalledWith({
      where: { klient_id: 'klient-1' },
      data: {
        ulica_miasto: 'Adres usunięty',
        latitude: null,
        longitude: null,
      },
    });
  });

  // AC8: treść dokładna wpisu audytowego.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  // @REQ: SEC-AUDIT-LOG
  it('AC8 — wpis audytowy ma operation/resource/recordId/actorEmail/actorRole/justification/legalBasis dokładnie jak przekazane', async () => {
    await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(txAuditLogCreateMock).toHaveBeenCalledWith({
      data: {
        operation: 'anonymize',
        resource: 'clients',
        recordId: 'klient-1',
        actorEmail: ADMIN_EMAIL,
        actorRole: 'admin',
        justification: VALID_JUSTIFICATION,
        legalBasis: VALID_BASIS,
      },
    });
  });

  // Kolejność wiążąca z WO: klienci → adresy → audit_log, wszystko w JEDNEJ transakcji.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('kolejność zapisów w transakcji: klienci.updateMany → adresy.updateMany → auditLog.create', async () => {
    await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(txKlientUpdateManyMock.mock.invocationCallOrder[0]).toBeLessThan(
      txAdresyUpdateManyMock.mock.invocationCallOrder[0],
    );
    expect(txAdresyUpdateManyMock.mock.invocationCallOrder[0]).toBeLessThan(
      txAuditLogCreateMock.mock.invocationCallOrder[0],
    );
  });

  // KROK 6: revalidatePath POZA transakcją, na oba szlaki, PO jej zakończeniu.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('revalidatePath jest wołane dla /customers i /customers/:id, PO zakończeniu transakcji', async () => {
    const result = await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(true);
    expect(revalidatePathMock).toHaveBeenCalledWith('/customers');
    expect(revalidatePathMock).toHaveBeenCalledWith('/customers/klient-1');
    expect(transactionMock.mock.invocationCallOrder[0]).toBeLessThan(
      revalidatePathMock.mock.invocationCallOrder[0],
    );
  });

  // Klient bez adresów: adresy.updateMany trafia w zero wierszy, operacja mimo to kończy się
  // sukcesem I wpisem audytowym (odróżnione od bramki idempotencji na klienci, gdzie count:0
  // oznacza co innego — patrz opis niżej).
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('przypadek brzegowy — klient bez adresów (adresy.updateMany count:0) kończy się sukcesem i wpisem audytowym', async () => {
    txAdresyUpdateManyMock.mockResolvedValue({ count: 0 });

    const result = await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
  });
});

describe('anonymizeClientAction — idempotencja i współbieżność (AC3)', () => {
  beforeEach(() => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // Bramka idempotencji: count:0 na klienci (rekord już zanonimizowany albo nieistniejący)
  // → sukces, ale BEZ dotknięcia adresy i BEZ wpisu audytowego (transakcja "kończy się" tu,
  // wg dosłownego brzmienia WO, punkt 5b).
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('klienci.updateMany zwraca count:0 → sukces, zero adresy.updateMany, zero wpisu audytowego', async () => {
    txKlientUpdateManyMock.mockResolvedValue({ count: 0 });

    const result = await anonymizeClientAction('klient-nieistniejacy', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(true);
    expect(txAdresyUpdateManyMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // AC3 dosłownie: drugie wywołanie na tym samym id → sukces, nie rzuca, nie tworzy drugiego
  // wpisu audit_log, nie zmienia anonymized_at (symulowane przez to, że drugi updateMany
  // zwraca count:0, bo where: { anonymized_at: null } już nie dopasowuje wiersza).
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('AC3 — drugie wywołanie na tym samym id: sukces, nie rzuca, dokładnie jeden wpis audit_log łącznie', async () => {
    txKlientUpdateManyMock
      .mockResolvedValueOnce({ count: 1 }) // pierwsze wywołanie: rekord istnieje, jeszcze nie zanonimizowany
      .mockResolvedValueOnce({ count: 0 }); // drugie wywołanie: where.anonymized_at:null już nie dopasowuje
    txAdresyUpdateManyMock.mockResolvedValue({ count: 0 });
    txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

    const first = await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });
    const second = await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(first).toEqual({ success: true });
    expect(second).toEqual({ success: true });
    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  // Współbieżność (proxy strukturalny — patrz zastrzeżenie na górze pliku): dwa równoległe
  // wywołania na ten sam id niezależnie wysyłają WŁAŚNIE `where: { id, anonymized_at: null }`,
  // czyli bramka współbieżności jest rozstrzygana w zapytaniu do bazy, nie odczytem w JS
  // poprzedzającym zapis (ten sam błąd co rezerwacja slotu — zabroniony przez WO wprost).
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('dwa równoległe wywołania na ten sam id niezależnie używają where: { id, anonymized_at: null }', async () => {
    txKlientUpdateManyMock.mockResolvedValue({ count: 1 });
    txAdresyUpdateManyMock.mockResolvedValue({ count: 0 });
    txAuditLogCreateMock.mockResolvedValue({ id: 'audit-x' });

    await Promise.all([
      anonymizeClientAction('klient-wyscig', {
        justification: VALID_JUSTIFICATION,
        legalBasis: VALID_BASIS,
      }),
      anonymizeClientAction('klient-wyscig', {
        justification: VALID_JUSTIFICATION,
        legalBasis: VALID_BASIS,
      }),
    ]);

    expect(txKlientUpdateManyMock).toHaveBeenCalledTimes(2);
    for (const call of txKlientUpdateManyMock.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({ where: { id: 'klient-wyscig', anonymized_at: null } }),
      );
    }
    // Bramka NIE może być poprzedzona odczytem findUnique/findFirst na klienci — taki
    // akcesor w ogóle nie istnieje w `tx` zamockowanym w tym pliku, więc próba jego użycia
    // rzuciłaby TypeError, a oba wywołania powyżej zakończyły się bez wyjątku.
  });
});

describe('anonymizeClientAction — atomowość audytu, KROK 5 (AC5)', () => {
  beforeEach(() => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // AC5: błąd na wstawieniu wpisu audytowego → cała transakcja się cofa. Na mocku dowodzimy
  // tego pośrednio: $transaction odrzuca obietnicę, akcja zwraca porażkę, a efekt POZA
  // transakcją (revalidatePath) w ogóle nie jest wołany.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  // @REQ: SEC-AUDIT-LOG
  it('błąd audit_log.create → transakcja odrzucona, wynik porażka, revalidatePath NIE wołane', async () => {
    txKlientUpdateManyMock.mockResolvedValue({ count: 1 });
    txAdresyUpdateManyMock.mockResolvedValue({ count: 1 });
    txAuditLogCreateMock.mockRejectedValue(new Error('CHECK constraint violation'));

    const result = await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  // Symetrycznie: błąd na adresy.updateMany → audit_log.create nigdy nie jest osiągnięte
  // (sekwencyjne wołania w tej samej transakcji), a klient i tak nie jest zanonimizowany.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  // @REQ: SEC-AUDIT-LOG
  it('błąd adresy.updateMany → auditLog.create nie zostaje osiągnięte, wynik porażka', async () => {
    txKlientUpdateManyMock.mockResolvedValue({ count: 1 });
    txAdresyUpdateManyMock.mockRejectedValue(new Error('deadlock detected'));

    const result = await anonymizeClientAction('klient-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

/**
 * AC4 — testy statyczne nad tekstem źródeł (`apps/**\/*.ts`, `apps/**\/*.tsx`), nie nad
 * zachowaniem runtime. Wzorzec: `format-date-no-bare-format.test.ts`.
 */
describe('AC4 — jedyna ścieżka kasowania klienta (test statyczny)', () => {
  function findSourceFiles(dir: string, results: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findSourceFiles(fullPath, results);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const appsDir = path.resolve(__dirname, '../../');
  const allSourceFiles = findSourceFiles(appsDir).filter(
    (f) => !f.includes(`${path.sep}tests${path.sep}`) && !f.endsWith('.test.ts'),
  );

  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('literał "klienci.delete" nie występuje w żadnym pliku .ts/.tsx spoza testów', () => {
    expect(allSourceFiles.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of allSourceFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('klienci.delete')) {
        offenders.push(path.relative(appsDir, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('deleteCustomerAction nie jest eksportowane ani importowane nigdzie w apps/', () => {
    const offenders: string[] = [];
    for (const file of allSourceFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('deleteCustomerAction')) {
        offenders.push(path.relative(appsDir, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  // Kontrola pozytywna kompilacji: gdyby moduł nadal eksportował `deleteCustomerAction`,
  // ten import wykazałby to niezależnie od grepa powyżej.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('kontrola pozytywna — import modułu potwierdza brak eksportu deleteCustomerAction', () => {
    expect('deleteCustomerAction' in actions).toBe(false);
  });

  // AC1, druga połowa: "żadna eksportowana funkcja w apps/b2b-web nie przyjmuje poprzednich
  // wartości ani ich nie przechowuje". Sprawdzamy to na poziomie schematu: model AuditLog
  // (jedyne miejsce, do którego anonimizacja cokolwiek zapisuje poza `klienci`/`adresy`) nie
  // ma ŻADNEJ kolumny nazwanej jak pole PII klienta/adresu — więc nie ma gdzie fizycznie
  // wstawić kopii "przed" anonimizacją, nawet gdyby ktoś spróbował.
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  // @REQ: SEC-AUDIT-LOG
  it('AC1 — model AuditLog w schema.prisma nie zawiera żadnej kolumny z PII klienta/adresu', () => {
    const schemaPath = path.resolve(
      __dirname,
      '../../../packages/database/prisma/schema.prisma',
    );
    const schema = readFileSync(schemaPath, 'utf-8');
    const match = schema.match(/model\s+AuditLog\s*\{([\s\S]*?)\n\}/);

    expect(match).not.toBeNull();

    const body = match![1];
    const forbiddenFieldNames = [
      'imie_i_nazwisko',
      'imieNazwisko',
      'telefon',
      'ulica_miasto',
      'ulicaMiasto',
      'latitude',
      'longitude',
    ];
    for (const forbidden of forbiddenFieldNames) {
      expect(body).not.toContain(forbidden);
    }
  });
});
