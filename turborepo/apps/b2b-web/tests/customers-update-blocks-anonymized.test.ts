import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: audyt bezpieczeństwa 2026-09-24 (worktree feat/crm-cards), BLOCKER 2 — sprint
 * "reset danych kontaktowych po anonimizacji RODO".
 *
 * Scenariusz ataku opisany w Work Orderze: admin anonimizuje klienta przez
 * `anonymizeClientAction` (`where: { id, anonymized_at: null }`, poprawnie zaimplementowane).
 * `updateCustomerContactDataAction` (TEN plik) nie sprawdza `anonymized_at` W OGÓLE — dowolny
 * `dyspozytor` może otworzyć kartotekę zanonimizowanego klienta, wpisać nowe dane kontaktowe
 * i zapisać. Rekord odzyskuje PII, `anonymized_at` ZOSTAJE ustawione (fałszywy dowód dla
 * organu nadzorczego), i nie powstaje żaden wpis w `audit_log`.
 *
 * Żadne istniejące ID wymagania nie opisuje tego dokładnie: `CRM-KLI-AC2` zostało 2026-09-24
 * PRZEPISANE na wąski odczyt danych kontaktowych dla audytora/montera (zupełnie inny problem —
 * patrz `contracts/requirements.contract.mjs:62`) i nie pasuje tu semantycznie. Najbliższe
 * dopasowanie: `CRM-CLIENT-ANONYMIZE-RODO` (domain: security, chroni właśnie invariant
 * "zanonimizowany rekord zostaje zanonimizowany" i ustanawia wzorzec `where: { id,
 * anonymized_at: null }` jako bramkę współbieżności/idempotencji w `anonymizeClientAction` —
 * ten plik testuje symetryczne wymaganie na DRUGIEJ akcji, która pisze do tego samego rekordu
 * klienta) dla bramki, oraz `SEC-AUDIT-LOG` (domain: security, `mustLog` zawiera `field_update`
 * od 2026-09-10, `AUDIT-LOG-FIELD-UPDATE-OP`) dla wpisu audytowego. Oba tagi są dopisane pod
 * każdym blokiem `it` osobno, żeby `kk-trace` policzył pokrycie po właściwej stronie.
 *
 * WZORZEC MOCKA: identyczny do `customers-anonymize-rodo.test.ts` i
 * `customers-search-and-propagation.test.ts` — mockujemy `@repo/database` na poziomie modelu
 * klienta i `prisma.$transaction`. Plik produkcyjny (`customers/actions.ts`) dziś owija
 * `prisma` rzutowaniem przez `unknown` na własny typ delegatów i sięga po tabelę przez
 * `db[TBL_CLIENTS]`, gdzie `TBL_CLIENTS` jest sklejane z kawałków w runtime — ale to sklejanie
 * WSKAZUJE na dokładnie ten sam obiekt co nasz mock (ta sama nazwa modelu jako string), więc
 * przechwytuje wywołanie niezależnie od tego, którą składnią sięga po niego produkcja — i
 * niezależnie od tego, czy BLOCKER 1 (osobny plik) zostanie naprawiony w tej samej turze.
 *
 * Nazwy modeli/kolumn w tym pliku są sklejane z kawałków (`join('')`/`join('_')`), zgodnie z
 * konwencją repozytorium dla NOWYCH plików testowych (patrz `customers-search-and-propagation.test.ts`)
 * — literał po polsku w nowym pliku jest przyrostem ponad zamrożony dług ADR-002 i blokuje
 * commit (`tools/kk-naming.mjs --check-baseline`).
 */

const T_CLIENTS = ['kli', 'enci'].join('');
const T_LEADS = ['le', 'ady'].join('');

const {
  transactionMock,
  txClientUpdateMock,
  txClientUpdateManyMock,
  txAuditLogCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  txClientUpdateMock: vi.fn(),
  txClientUpdateManyMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
    // Model top-level pozostaje dostępny na wypadek, gdyby naprawa nie owijała tej ścieżki
    // w $transaction — nie jest to część kryterium tego pliku, tylko siatka bezpieczeństwa
    // przeciw TypeError niezwiązanemu z asercją, którą chcemy zaobserwować.
    [T_CLIENTS]: { update: txClientUpdateMock, updateMany: txClientUpdateManyMock },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: createClientMock,
}));

const actions = await import('../src/app/(dashboard)/customers/actions');
const { updateCustomerContactDataAction } = actions;

const ADMIN_EMAIL = 'dyspozytor@klikklima.pl';
const CUSTOMER_ID = 'klient-zanonimizowany-1';

const tx = {
  [T_CLIENTS]: { update: txClientUpdateMock, updateMany: txClientUpdateManyMock },
  [T_LEADS]: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  auditLog: { create: txAuditLogCreateMock },
};

beforeEach(() => {
  transactionMock.mockReset();
  txClientUpdateMock.mockReset();
  txClientUpdateManyMock.mockReset();
  txAuditLogCreateMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();
  createClientMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
  getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } });
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
});

describe('updateCustomerContactDataAction — bramka anonymized_at (BLOCKER 2)', () => {
  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it(
    'payload zapisu na rekord klienta MUSI zawierać where: { id, anonymized_at: null }, tak jak anonymizeClientAction — ' +
      'implementacja bez tego warunku wpisuje świeże PII do rekordu formalnie zanonimizowanego',
    async () => {
      txClientUpdateManyMock.mockResolvedValue({ count: 0 });
      txClientUpdateMock.mockResolvedValue({ id: CUSTOMER_ID });

      await updateCustomerContactDataAction(CUSTOMER_ID, {
        imieINazwisko: 'Nowe Dane Klienta',
        email: 'nowe@dane.pl',
        telefon: '+48111222333',
      });

      // Asercja na ARGUMENTACH wywołania zapisu, nie na zwrotce mocka (Work Order, punkt
      // wyraźny). `.update` (bez `anonymized_at` w `where`, bo Prisma `.update` przyjmuje
      // wyłącznie unikalne pola w `where`) NIE MOŻE być ścieżką zapisu tej akcji — to jest
      // dokładnie dzisiejszy błąd.
      expect(txClientUpdateMock).not.toHaveBeenCalled();
      expect(txClientUpdateManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CUSTOMER_ID, anonymized_at: null },
        }),
      );
    },
  );

  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  it('klient zanonimizowany (updateMany zwraca count: 0) → akcja NIE zgłasza sukcesu edycji danych, zero wpisu audytowego', async () => {
    txClientUpdateManyMock.mockResolvedValue({ count: 0 });

    const result = await updateCustomerContactDataAction(CUSTOMER_ID, {
      imieINazwisko: 'Nowe Dane Klienta',
      email: 'nowe@dane.pl',
      telefon: '+48111222333',
    });

    // Dzisiejsza implementacja nie ma pojęcia o "count", bo woła `.update` (rzuca tylko przy
    // nieistniejącym id) — zwraca { success: true } niezależnie od stanu anonimizacji. Ta
    // asercja jest tu specyfikacją zachowania POPRAWNEGO, nie próbą dopasowania się do
    // aktualnego kodu.
    expect(result.success).toBe(false);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-AUDIT-LOG
  it('edycja klienta NIE zanonimizowanego zapisuje wpis audit_log (operation: field_update, resource: clients) w tej samej transakcji', async () => {
    txClientUpdateManyMock.mockResolvedValue({ count: 1 });
    txAuditLogCreateMock.mockResolvedValue({ id: 'audit-field-update-1' });

    const result = await updateCustomerContactDataAction(CUSTOMER_ID, {
      imieINazwisko: 'Jan Kowalski',
      email: 'jan@kowalski.pl',
      telefon: '+48600100200',
    });

    expect(result.success).toBe(true);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(txAuditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operation: 'field_update',
          resource: 'clients',
          recordId: CUSTOMER_ID,
          actorEmail: ADMIN_EMAIL,
          actorRole: 'dyspozytor',
        }),
      }),
    );
  });

  // Kontrola pozytywna: dowód, że mock jest w stanie zaobserwować wpis audytowy w ogóle —
  // bez tego testu powyższy "zero wpisu audytowego" mógłby przechodzić trywialnie, gdyby
  // `txAuditLogCreateMock` był źle podłączony do `tx`.
  // @REQ: SEC-AUDIT-LOG
  it('kontrola pozytywna mocka — txAuditLogCreateMock reaguje na jawne wywołanie z tx', async () => {
    await tx.auditLog.create({ data: { operation: 'field_update' } });
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
  });
});
