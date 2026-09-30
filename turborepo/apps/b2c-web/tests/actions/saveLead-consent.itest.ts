import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { fromZonedTime } from 'date-fns-tz';
import { prisma } from '@repo/database';

/**
 * WO: docs/workorders/B2C-CONSENT-RODO.md — AC3 (FK RESTRICT, transakcja żywa), AC4
 * (publikacja nowej wersji nie zmienia wersji zapisanej u istniejących leadów) oraz
 * przypadki brzegowe "usunięcie wersji wskazanej przez lead" (FK RESTRICT).
 *
 * Konwencja repo (patrz `saveLead-atomic.itest.ts`): `*.itest.ts` →
 * `vitest.integration.config.mts`, żywy Postgres, `npm run test:integration`. W TYM
 * środowisku (brak Dockera) ten plik jest odrzucany przez
 * `tools/vitest-integration-db-guard.mjs` przed wykonaniem — weryfikacja realnego
 * przebiegu zostaje jobowi `integracja` w CI / lokalnemu `supabase start` (patrz
 * `project_itest_no_docker_sandbox` w pamięci test-authora).
 *
 * DECYZJA TEST-AUTHORA — dwa różne mechanizmy odrzucenia, testowane osobno (patrz
 * uzasadnienie w `saveLead.consent.test.ts`, sekcja "KONTRAKT WERYFIKACJI WERSJI"):
 *
 *   1. AC3 "wskazanie NIEISTNIEJĄCEJ wersji" — wywołuje `saveLead()` (nie omija Server
 *      Action) z UUID, który nie odpowiada ŻADNEMU wierszowi `legal_document_versions`.
 *      Dowodzi wyłącznie WYNIKU (success:false, zero nowych wierszy klient/adres/lead)
 *      NIEZALEŻNIE od tego, czy implementacja odrzuca to app-side (findUnique zwraca
 *      null) czy DB-side (FK przy insert) — obu wariantów nie da się odróżnić z zewnątrz
 *      Server Action, a WO wymaga dowodu na żywym Postgresie, bo atrapa `findUnique`
 *      zwracająca `null` dowodziłaby wyłącznie konfiguracji atrapy.
 *
 *   2. Test "ograniczenie FK istnieje NIEZALEŻNIE od Server Action" (obrona w głąb, patrz
 *      pamięć `feedback_db_constraint_itest_bypass_domain`: "dla kryteriów granicznych
 *      ograniczenia bazy wstawiaj wiersze przez `prisma.<model>.create()`, nie przez
 *      funkcję domenową — filtrowanie w warstwie wyższej ukrywa kolizję") — OMIJA
 *      `saveLead()` i wstawia wiersz `leady` BEZPOŚREDNIO przez `prisma.leady.create()` z
 *      nieistniejącym `privacyPolicyConsentVersionId`. Jeśli kiedykolwiek ktoś usunie albo
 *      osłabi walidację w Server Action, ten test nadal wykryje regresję na poziomie
 *      bazy — Server Action nie jest jedyną linią obrony (WO: "wskazanie nieistniejącej
 *      wersji odrzuca BAZA").
 */

const TIME_ZONE = 'Europe/Warsaw';

function localMoment(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, TIME_ZONE);
}

function timeOfDay(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

function futureSaturday(weeksFromNow: number, hhmm: string): Date {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + weeksFromNow * 7);
  const day = base.getUTCDay();
  const diffToSaturday = (6 - day + 7) % 7;
  base.setUTCDate(base.getUTCDate() + diffToSaturday);
  const dateStr = base.toISOString().slice(0, 10);
  return localMoment(dateStr, hhmm);
}

// Stub nieużywany merytorycznie — patrz uzasadnienie identyczne w `saveLead-atomic.itest.ts`
// (import `@/lib/supabaseClient` bez mocka pada na aliasie `@/*` nierozwiązywalnym w
// `vitest.integration.config.mts`, RED z niewłaściwego powodu).
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }));

const { saveLead } = await import('../../app/actions/saveLead');

async function createTestAuditor(): Promise<{ id: string }> {
  const suffix = randomUUID();
  const auditor = await prisma.audytorzy.create({
    data: {
      imie_i_nazwisko: `ITEST B2C-CONSENT-RODO ${suffix}`,
      email: `itest-b2c-consent-rodo-${suffix}@example.invalid`,
      is_active: true,
      leave_status: 'ACTIVE',
    },
  });
  return auditor;
}

async function createTestSaturdayRule(auditorId: string, start: string, end: string): Promise<void> {
  await prisma.availabilityRule.create({
    data: { auditorId, weekday: 6, startTime: timeOfDay(start), endTime: timeOfDay(end), isActive: true },
  });
}

function testEmail(marker: string): string {
  return `itest-b2c-consent-rodo-${marker}-${randomUUID()}@example.invalid`;
}

/**
 * Wersja OBOWIĄZUJĄCA (isCurrent: true, publishedAt ustawiony — CHECK
 * legal_document_versions_current_is_published wymaga tego skojarzenia).
 * Częściowy indeks unikalny (legal_document_versions_current_per_kind_key) dopuszcza
 * DOKŁADNIE JEDNĄ wersję isCurrent na dany documentKind — kolejne wywołanie dla tego
 * samego rodzaju w obrębie jednego przebiegu testów MUSI najpierw zdjąć flagę z
 * poprzedniej, inaczej INSERT pada na P2002 (dokładnie ten wzorzec, jakim
 * publishLegalDocumentVersionAction/skrypt publikacji na produkcji już to robią).
 */
async function createCurrentVersion(kind: 'B2C_PRIVACY_POLICY' | 'B2C_TERMS'): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const last = await tx.legalDocumentVersion.findFirst({ where: { documentKind: kind }, orderBy: { versionNo: 'desc' } });
    const versionNo = (last?.versionNo ?? 0) + 1;

    await tx.legalDocumentVersion.updateMany({
      where: { documentKind: kind, isCurrent: true },
      data: { isCurrent: false },
    });

    return tx.legalDocumentVersion.create({
      data: {
        documentKind: kind,
        versionNo,
        content: `Treść ITEST ${kind} v${versionNo}`,
        publishedAt: new Date(),
        isCurrent: true,
      },
    });
  });
}

/** Wersja SZKICU — nigdy obowiązująca (AC5, nie centralny do tego pliku, ale użyty w AC4). */
async function createDraftVersion(kind: 'B2C_PRIVACY_POLICY' | 'B2C_TERMS'): Promise<{ id: string }> {
  const last = await prisma.legalDocumentVersion.findFirst({ where: { documentKind: kind }, orderBy: { versionNo: 'desc' } });
  const versionNo = (last?.versionNo ?? 0) + 1;
  const version = await prisma.legalDocumentVersion.create({
    data: {
      documentKind: kind,
      versionNo,
      content: `Treść ITEST szkic ${kind} v${versionNo}`,
      publishedAt: null,
      isCurrent: false,
    },
  });
  return version;
}

/** Publikuje `next` jako nową bieżącą wersję TEGO SAMEGO rodzaju, zdejmując isCurrent z poprzedniej — dokładnie kolejność z `publishLegalDocumentVersionAction` (apps/b2b-web/.../settings/actions.ts), bez uprawnień/RSC, bo ta akcja dziś obsługuje wyłącznie rodzaje pracownicze (RODO_CONSENT/EMPLOYEE_TERMS). */
async function publishNewCurrentVersion(kind: 'B2C_PRIVACY_POLICY' | 'B2C_TERMS', draftId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.legalDocumentVersion.updateMany({
      where: { documentKind: kind, isCurrent: true, NOT: { id: draftId } },
      data: { isCurrent: false },
    });
    await tx.legalDocumentVersion.update({
      where: { id: draftId },
      data: { isCurrent: true, publishedAt: new Date() },
    });
  });
}

async function countByEmail(email: string): Promise<{ klienci: number; adresy: number; leady: number }> {
  const klienci = await prisma.klienci.count({ where: { email } });
  const adresy = await prisma.adresy.count({ where: { klient: { email } } });
  const leady = await prisma.leady.count({ where: { klient: { email } } });
  return { klienci, adresy, leady };
}

async function cleanupByEmail(email: string): Promise<void> {
  const client = await prisma.klienci.findFirst({ where: { email } });
  if (!client) return;
  await prisma.booking.deleteMany({ where: { lead: { klient_id: client.id } } });
  await prisma.leady.deleteMany({ where: { klient_id: client.id } });
  await prisma.adresy.deleteMany({ where: { klient_id: client.id } });
  await prisma.klienci.deleteMany({ where: { id: client.id } });
}

let cleanupEmails: string[] = [];
let cleanupAuditorIds: string[] = [];
let cleanupVersionIds: string[] = [];
let cleanupBareLeadIds: string[] = [];

async function afterEachCleanup(): Promise<void> {
  if (cleanupBareLeadIds.length > 0) {
    await prisma.leady.deleteMany({ where: { id: { in: cleanupBareLeadIds } } });
  }
  for (const email of cleanupEmails) {
    await cleanupByEmail(email);
  }
  if (cleanupAuditorIds.length > 0) {
    await prisma.booking.deleteMany({ where: { auditorId: { in: cleanupAuditorIds } } });
    await prisma.availabilityRule.deleteMany({ where: { auditorId: { in: cleanupAuditorIds } } });
    await prisma.audytorzy.deleteMany({ where: { id: { in: cleanupAuditorIds } } });
  }
  // Wersje dokumentów NA KOŃCU — po tym, jak wszystkie leady, które mogły je wskazywać,
  // już nie istnieją (FK RESTRICT odrzuciłby usunięcie wersji wciąż wskazywanej).
  if (cleanupVersionIds.length > 0) {
    await prisma.legalDocumentVersion.deleteMany({ where: { id: { in: cleanupVersionIds } } });
  }
  cleanupEmails = [];
  cleanupAuditorIds = [];
  cleanupVersionIds = [];
  cleanupBareLeadIds = [];
}

afterEach(async () => {
  await afterEachCleanup();
});

let auditBasketId: string;

async function requireBasket(code: string): Promise<string> {
  const basket = await prisma.visitDurationBasket.findFirst({ where: { code, isActive: true } });
  if (!basket) {
    throw new Error(
      `Koszyk '${code}' nie istnieje na tej bazie — uruchom \`supabase start\` przed \`npm run test:integration\`.`,
    );
  }
  return basket.id;
}

beforeAll(async () => {
  auditBasketId = await requireBasket('AUDIT');
});

function basePayload(email: string, startAtIso: string, privacyVersionId: string, termsVersionId: string) {
  return {
    name: 'Jan Testowy',
    email,
    phone: '500600700',
    address: 'Marszałkowska 1, Warszawa',
    startAtIso,
    triageData: { location: 'Dom jednorodzinny' },
    consent: {
      privacyPolicyConsentVersionId: privacyVersionId,
      termsConsentVersionId: termsVersionId,
    },
  };
}

describe('saveLead — zgoda B2C na żywym Postgresie (WO B2C-CONSENT-RODO, AC3/AC4)', () => {
  // @REQ: B2C-CONSENT-RODO
  it(
    'AC1/AC1(itest) — sukces na żywej bazie: leady.privacy_policy_consent_version_id i terms_consent_version_id są DOKŁADNIE wersjami przysłanymi, oba granted_at są niepuste',
    async () => {
      const auditor = await createTestAuditor();
      cleanupAuditorIds.push(auditor.id);
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');

      const privacy = await createCurrentVersion('B2C_PRIVACY_POLICY');
      const terms = await createCurrentVersion('B2C_TERMS');
      cleanupVersionIds.push(privacy.id, terms.id);

      const email = testEmail('sukces');
      cleanupEmails.push(email);

      const startAt = futureSaturday(20, '08:00');
      const result = await saveLead(
        basePayload(email, startAt.toISOString(), privacy.id, terms.id) as unknown as Parameters<typeof saveLead>[0],
      );

      expect(result.success).toBe(true);

      const lead = await prisma.leady.findFirst({ where: { klient: { email } } });
      expect(lead).not.toBeNull();
      expect(lead!.privacyPolicyConsentVersionId).toBe(privacy.id);
      expect(lead!.termsConsentVersionId).toBe(terms.id);
      expect(lead!.privacyPolicyConsentGrantedAt).not.toBeNull();
      expect(lead!.termsConsentGrantedAt).not.toBeNull();
    },
    30000,
  );

  // @REQ: B2C-CONSENT-RODO
  it(
    'AC3 — wskazanie NIEISTNIEJĄCEJ wersji polityki prywatności (UUID bez odpowiednika w legal_document_versions) -> success:false, ZERO nowego klienta/adresu/leada',
    async () => {
      const auditor = await createTestAuditor();
      cleanupAuditorIds.push(auditor.id);
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');

      const terms = await createCurrentVersion('B2C_TERMS');
      cleanupVersionIds.push(terms.id);

      const nonexistentPrivacyVersionId = randomUUID();
      const email = testEmail('nieistniejaca-wersja');
      cleanupEmails.push(email);

      const startAt = futureSaturday(21, '08:00');
      const result = await saveLead(
        basePayload(email, startAt.toISOString(), nonexistentPrivacyVersionId, terms.id) as unknown as Parameters<
          typeof saveLead
        >[0],
      );

      expect(result.success).toBe(false);

      const counts = await countByEmail(email);
      expect(counts).toEqual({ klienci: 0, adresy: 0, leady: 0 });
    },
    30000,
  );

  // @REQ: B2C-CONSENT-RODO
  it(
    'brzeg (obrona w głąb): ograniczenie FK na leady.privacy_policy_consent_version_id istnieje niezależnie od Server Action — insert BEZPOŚREDNIO przez prisma.leady.create() z nieistniejącym UUID jest odrzucony przez bazę (SQLSTATE 23503)',
    async () => {
      const nonexistentVersionId = randomUUID();
      const leadId = randomUUID();

      await expect(
        prisma.leady.create({
          data: {
            id: leadId,
            privacyPolicyConsentVersionId: nonexistentVersionId,
          },
        }),
      ).rejects.toMatchObject({
        meta: expect.objectContaining({
          constraint: 'leady_privacy_policy_consent_version_id_fkey',
        }),
      });

      const shouldNotExist = await prisma.leady.findUnique({ where: { id: leadId } });
      expect(shouldNotExist).toBeNull();
    },
    30000,
  );

  // @REQ: B2C-CONSENT-RODO
  it(
    'brzeg (obrona w głąb): ograniczenie FK na leady.terms_consent_version_id istnieje niezależnie od Server Action — insert BEZPOŚREDNIO przez prisma.leady.create() z nieistniejącym UUID jest odrzucony przez bazę (SQLSTATE 23503)',
    async () => {
      const nonexistentVersionId = randomUUID();
      const leadId = randomUUID();

      await expect(
        prisma.leady.create({
          data: {
            id: leadId,
            termsConsentVersionId: nonexistentVersionId,
          },
        }),
      ).rejects.toMatchObject({
        meta: expect.objectContaining({
          constraint: 'leady_terms_consent_version_id_fkey',
        }),
      });

      const shouldNotExist = await prisma.leady.findUnique({ where: { id: leadId } });
      expect(shouldNotExist).toBeNull();
    },
    30000,
  );

  // @REQ: B2C-CONSENT-RODO
  it(
    'AC4 — publikacja NOWEJ wersji polityki prywatności PO utworzeniu leada nie zmienia wersji zapisanej przy tym leadzie: lead nadal wskazuje starą wersję, moment zgody niezmieniony',
    async () => {
      const auditor = await createTestAuditor();
      cleanupAuditorIds.push(auditor.id);
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');

      const oldPrivacy = await createCurrentVersion('B2C_PRIVACY_POLICY');
      const terms = await createCurrentVersion('B2C_TERMS');
      cleanupVersionIds.push(oldPrivacy.id, terms.id);

      const email = testEmail('ac4-publikacja');
      cleanupEmails.push(email);

      const startAt = futureSaturday(22, '08:00');
      const result = await saveLead(
        basePayload(email, startAt.toISOString(), oldPrivacy.id, terms.id) as unknown as Parameters<
          typeof saveLead
        >[0],
      );
      expect(result.success).toBe(true);

      const leadBeforePublish = await prisma.leady.findFirst({ where: { klient: { email } } });
      expect(leadBeforePublish).not.toBeNull();
      const grantedAtBefore = leadBeforePublish!.privacyPolicyConsentGrantedAt;

      // Publikacja NOWEJ wersji tego samego rodzaju (B2C_PRIVACY_POLICY) — zdejmuje
      // isCurrent ze starej, ustawia na nowej. Lead już istnieje i wskazuje starą wersję
      // kluczem obcym (nie kopią treści) — publikacja NIE dotyka jego wierszy.
      const newPrivacy = await createDraftVersion('B2C_PRIVACY_POLICY');
      cleanupVersionIds.push(newPrivacy.id);
      await publishNewCurrentVersion('B2C_PRIVACY_POLICY', newPrivacy.id);

      const leadAfterPublish = await prisma.leady.findUnique({ where: { id: leadBeforePublish!.id } });
      expect(leadAfterPublish).not.toBeNull();
      expect(leadAfterPublish!.privacyPolicyConsentVersionId).toBe(oldPrivacy.id);
      expect(leadAfterPublish!.privacyPolicyConsentVersionId).not.toBe(newPrivacy.id);
      expect(leadAfterPublish!.privacyPolicyConsentGrantedAt?.getTime()).toBe(grantedAtBefore?.getTime());
    },
    30000,
  );

  // @REQ: B2C-CONSENT-RODO
  it(
    'brzeg: usunięcie wersji dokumentu WSKAZYWANEJ przez istniejącego leada jest odrzucone (FK RESTRICT, nie CASCADE, nie SET NULL) — lead i jego zgoda przeżywają próbę usunięcia',
    async () => {
      const auditor = await createTestAuditor();
      cleanupAuditorIds.push(auditor.id);
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');

      const privacy = await createCurrentVersion('B2C_PRIVACY_POLICY');
      const terms = await createCurrentVersion('B2C_TERMS');
      cleanupVersionIds.push(privacy.id, terms.id);

      const email = testEmail('ac-delete-restrict');
      cleanupEmails.push(email);

      const startAt = futureSaturday(23, '08:00');
      const result = await saveLead(
        basePayload(email, startAt.toISOString(), privacy.id, terms.id) as unknown as Parameters<
          typeof saveLead
        >[0],
      );
      expect(result.success).toBe(true);

      await expect(prisma.legalDocumentVersion.delete({ where: { id: privacy.id } })).rejects.toMatchObject({
        meta: expect.objectContaining({
          constraint: 'leady_privacy_policy_consent_version_id_fkey',
        }),
      });

      const leadAfterFailedDelete = await prisma.leady.findFirst({ where: { klient: { email } } });
      expect(leadAfterFailedDelete).not.toBeNull();
      expect(leadAfterFailedDelete!.privacyPolicyConsentVersionId).toBe(privacy.id);
    },
    30000,
  );
});
