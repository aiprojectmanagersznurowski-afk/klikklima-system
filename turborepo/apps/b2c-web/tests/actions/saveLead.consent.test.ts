import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: docs/workorders/B2C-CONSENT-RODO.md — AC1, AC2, AC5 + przypadki brzegowe
 * ("nadmiarowe klucze", "strefa czasowa", "współbieżność z publikacją").
 *
 * D-C1 = (b) (Michał, 2026-09-28, potwierdzone w schema.prisma:139-158 i
 * contracts/requirements.contract.mjs:597): DWIE zgody, DWIE pary kolumn na `leady` —
 * `privacyPolicyConsentVersionId`/`privacyPolicyConsentGrantedAt` (B2C_PRIVACY_POLICY) i
 * `termsConsentVersionId`/`termsConsentGrantedAt` (B2C_TERMS). D-C3 = (a): obie pary
 * NULLABLE, bez CHECK w bazie — inwariant "nie ma leada bez zgody" żyje WYŁĄCZNIE w tej
 * Server Action (Zod + odczyt `legal_document_versions`), tak jak w `soft_leady`
 * (B2C-SOFT-LEAD-CONSENT) i w `employee_consents` (FLD-CONSENT-ACCEPT).
 *
 * KONTRAKT WEJŚCIA — DECYZJA TEST-AUTHORA (WO nie podaje "Proponowanego kształtu" pola;
 * ten sam status jak kontrakt mockowania `prepareBookingCandidates`/`writeBookingCandidate`
 * w `saveLead.atomic.test.ts` — jeśli implementer wybierze inny kształt, to NIE jest z
 * automatu TEST-DEFECT, zgłoszone w podsumowaniu tury jako ryzyko do potwierdzenia):
 *
 *   consent: {
 *     privacyPolicyConsentVersionId: string (UUID, wymagane),
 *     termsConsentVersionId: string (UUID, wymagane),
 *   }
 *
 * Zagnieżdżony obiekt (nie dwa pola płaskie) i `.strict()` NA TYM obiekcie — dokładnie
 * po to, żeby przypadek brzegowy "nadmiarowy klucz w polu zgody" (WO, "Przypadki
 * brzegowe") miał gdzie się zamanifestować bez włączania globalnej `.strict()` na całym
 * `saveLeadSchema` (AC8 z WO B2C-LEAD-ATOMIC zamiast tego używa `z.never().optional()`
 * per-pole na `status` — nie ruszamy tamtej decyzji).
 *
 * KONTRAKT WERYFIKACJI WERSJI — wzorem `executeAcceptLegalDocumentVersion`
 * (apps/b2b-web/src/lib/domain/consents.ts:94-116, FLD-CONSENT-ACCEPT kryt. 3, WO AC5
 * "doprecyzowanie wzorem FLD-CONSENT-ACCEPT"): `saveLead` odczytuje KAŻDĄ z dwóch wersji
 * po `id` przez `prisma.legalDocumentVersion.findUnique({ where: { id } })` PRZED
 * otwarciem `prisma.$transaction` (analogicznie do dzisiejszego odczytu koszyka AUDIT,
 * `saveLead.ts:186-196`) i odrzuca, gdy wiersz nie istnieje, `isCurrent !== true`, albo
 * `documentKind` nie zgadza się z oczekiwanym rodzajem dla danego pola (polityka ↔
 * B2C_PRIVACY_POLICY, regulamin ↔ B2C_TERMS — zgodność rodzaju NIE jest wymuszona przez
 * FK, WO, "Zgodność rodzaju... NIE jest wymuszona przez bazę... sprawdza ją Server
 * Action"). Ten plik mockuje `prisma.legalDocumentVersion.findUnique` dwa razy pod rząd
 * (kolejność: privacy, potem terms — jeśli implementer odwróci kolejność, testy
 * rozróżniające "który dokument padł" (np. AC5 "zły rodzaj") mogą wymagać przełożenia
 * `mockResolvedValueOnce`, zgłoszone jako ryzyko w podsumowaniu tury, nie TEST-DEFECT).
 *
 * PRZYPADEK "NIEISTNIEJĄCEJ WERSJI" (AC3) NIE JEST TU POKRYTY: WO wprost wymaga dowodu na
 * żywym Postgresie ("to wymaga żywego Postgresa, nie atrapy") — atrapa `findUnique`
 * zwracająca `null` dowodziłaby wyłącznie tego, jak zaprogramowano atrapę, nie że
 * ograniczenie FK `leady_privacy_policy_consent_version_id_fkey`/`..._terms_..._fkey`
 * istnieje i działa. Ten przypadek jest w `saveLead-consent.itest.ts` (AC3).
 */

const {
  transactionSpy,
  klienciCreateSpy,
  adresyCreateSpy,
  leadyCreateSpy,
  calendarSpy,
  prepareBookingCandidatesSpy,
  writeBookingCandidateSpy,
  visitDurationBasketFindFirstMock,
  legalDocumentVersionFindUniqueMock,
} = vi.hoisted(() => {
  const klienciCreateSpy = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }));
  const adresyCreateSpy = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }));
  const leadyCreateSpy = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }));

  const fakeTx = {
    klienci: { create: klienciCreateSpy },
    adresy: { create: adresyCreateSpy },
    leady: { create: leadyCreateSpy },
  };

  const transactionSpy = vi.fn(async (callback: (tx: typeof fakeTx) => Promise<unknown>) => callback(fakeTx));

  const calendarSpy = vi.fn(async () => ({ success: true, eventLink: 'stub' }));

  const prepareBookingCandidatesSpy = vi.fn(async (_params: Record<string, unknown>) => ({
    ok: true,
    candidates: [{ resource_id: 'aud-1', resource_kind: 'AUDITOR' as const }],
    resourceKind: 'AUDITOR' as const,
    scheduledEnd: new Date('2026-11-16T09:00:00.000Z'),
    visitBasketId: 'basket-audit-id',
  }));

  const writeBookingCandidateSpy = vi.fn(async (_tx: unknown, _params: Record<string, unknown>) => ({
    ok: true,
    booking: {
      id: 'booking-default',
      scheduledStart: new Date('2026-11-16T07:00:00.000Z'),
      scheduledEnd: new Date('2026-11-16T09:00:00.000Z'),
    },
  }));

  const visitDurationBasketFindFirstMock = vi.fn(async (_args: Record<string, unknown>) => ({
    id: 'basket-audit-id',
    code: 'AUDIT',
    isActive: true,
    durationMinutes: 120,
    pool: 'AUDITOR',
  }));

  type FakeLegalDocumentVersionRow = {
    id: string;
    documentKind: string;
    versionNo: number;
    content: string;
    isCurrent: boolean;
    publishedAt: Date | null;
  };

  const legalDocumentVersionFindUniqueMock = vi.fn(
    async (_args: { where: { id: string } }): Promise<FakeLegalDocumentVersionRow | null> => null,
  );

  return {
    transactionSpy,
    klienciCreateSpy,
    adresyCreateSpy,
    leadyCreateSpy,
    calendarSpy,
    prepareBookingCandidatesSpy,
    writeBookingCandidateSpy,
    visitDurationBasketFindFirstMock,
    legalDocumentVersionFindUniqueMock,
  };
});

// Stub NIEUŻYWANY merytorycznie — patrz uzasadnienie identyczne w saveLead.test.ts.
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../../app/actions/calendar', () => ({ createCalendarEvent: calendarSpy }));
vi.mock('@repo/scheduling', () => ({
  prepareBookingCandidates: prepareBookingCandidatesSpy,
  writeBookingCandidate: writeBookingCandidateSpy,
}));
vi.mock('@repo/database', () => ({
  prisma: {
    visitDurationBasket: { findFirst: visitDurationBasketFindFirstMock },
    legalDocumentVersion: { findUnique: legalDocumentVersionFindUniqueMock },
    $transaction: transactionSpy,
  },
}));

const { saveLead } = await import('../../app/actions/saveLead');

const PRIVACY_VERSION_ID = '11111111-1111-4111-8111-111111111111';
const TERMS_VERSION_ID = '22222222-2222-4222-8222-222222222222';

function currentPrivacyVersionRow() {
  return {
    id: PRIVACY_VERSION_ID,
    documentKind: 'B2C_PRIVACY_POLICY',
    versionNo: 3,
    content: 'Treść polityki prywatności v3',
    isCurrent: true,
    publishedAt: new Date('2026-09-01T00:00:00.000Z'),
  };
}

function currentTermsVersionRow() {
  return {
    id: TERMS_VERSION_ID,
    documentKind: 'B2C_TERMS',
    versionNo: 2,
    content: 'Treść regulaminu v2',
    isCurrent: true,
    publishedAt: new Date('2026-08-15T00:00:00.000Z'),
  };
}

/** Domyślnie: obie wersje istnieją, są aktualne, właściwego rodzaju. */
function mockBothVersionsCurrent(): void {
  legalDocumentVersionFindUniqueMock.mockImplementation(async ({ where }: { where: { id: string } }) => {
    if (where.id === PRIVACY_VERSION_ID) return currentPrivacyVersionRow();
    if (where.id === TERMS_VERSION_ID) return currentTermsVersionRow();
    return null;
  });
}

function resetAllMocks(): void {
  transactionSpy.mockClear();
  klienciCreateSpy.mockClear();
  adresyCreateSpy.mockClear();
  leadyCreateSpy.mockClear();
  calendarSpy.mockClear();
  prepareBookingCandidatesSpy.mockClear();
  writeBookingCandidateSpy.mockClear();
  visitDurationBasketFindFirstMock.mockClear();
  legalDocumentVersionFindUniqueMock.mockReset();

  visitDurationBasketFindFirstMock.mockResolvedValue({
    id: 'basket-audit-id',
    code: 'AUDIT',
    isActive: true,
    durationMinutes: 120,
    pool: 'AUDITOR',
  });
  prepareBookingCandidatesSpy.mockResolvedValue({
    ok: true,
    candidates: [{ resource_id: 'aud-1', resource_kind: 'AUDITOR' }],
    resourceKind: 'AUDITOR',
    scheduledEnd: new Date('2026-11-16T09:00:00.000Z'),
    visitBasketId: 'basket-audit-id',
  });
  writeBookingCandidateSpy.mockResolvedValue({
    ok: true,
    booking: {
      id: 'booking-default',
      scheduledStart: new Date('2026-11-16T07:00:00.000Z'),
      scheduledEnd: new Date('2026-11-16T09:00:00.000Z'),
    },
  });
  mockBothVersionsCurrent();
}

const basePayload = () => ({
  name: 'Jan Kowalski',
  email: 'jan.kowalski@example.com',
  phone: '500600700',
  address: 'Marszałkowska 1, Warszawa',
  startAtIso: '2026-11-16T08:00:00.000+01:00',
  triageData: { location: 'Dom jednorodzinny' },
  consent: {
    privacyPolicyConsentVersionId: PRIVACY_VERSION_ID,
    termsConsentVersionId: TERMS_VERSION_ID,
  },
});

function expectZeroWrites(): void {
  expect(transactionSpy).not.toHaveBeenCalled();
  expect(klienciCreateSpy).not.toHaveBeenCalled();
  expect(adresyCreateSpy).not.toHaveBeenCalled();
  expect(leadyCreateSpy).not.toHaveBeenCalled();
}

describe('saveLead — zgoda B2C zapisywana z leadem (WO B2C-CONSENT-RODO)', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // @REQ: B2C-CONSENT-RODO
  it('AC1 — sukces: leady.create() otrzymuje DOKŁADNIE oba UUID przysłane w żądaniu jako wskazania wersji, dla obu dokumentów osobno', async () => {
    const result = await saveLead(basePayload() as unknown as Parameters<typeof saveLead>[0]);

    expect(result.success).toBe(true);
    expect(leadyCreateSpy).toHaveBeenCalledTimes(1);

    const leadRow = leadyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;
    expect(leadRow.privacyPolicyConsentVersionId).toBe(PRIVACY_VERSION_ID);
    expect(leadRow.termsConsentVersionId).toBe(TERMS_VERSION_ID);
  });

  // @REQ: B2C-CONSENT-RODO
  it('AC1 — moment zgody dla OBU dokumentów jest ustawiany przez serwer (Date świeży, nie wartość z żądania — klient nigdy nie przysyła znacznika czasu zgody)', async () => {
    const before = Date.now();
    const result = await saveLead(basePayload() as unknown as Parameters<typeof saveLead>[0]);
    const after = Date.now();

    expect(result.success).toBe(true);
    const leadRow = leadyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;

    expect(leadRow.privacyPolicyConsentGrantedAt).toBeInstanceOf(Date);
    expect(leadRow.termsConsentGrantedAt).toBeInstanceOf(Date);

    const privacyGrantedAtMs = (leadRow.privacyPolicyConsentGrantedAt as Date).getTime();
    const termsGrantedAtMs = (leadRow.termsConsentGrantedAt as Date).getTime();
    expect(privacyGrantedAtMs).toBeGreaterThanOrEqual(before);
    expect(privacyGrantedAtMs).toBeLessThanOrEqual(after);
    expect(termsGrantedAtMs).toBeGreaterThanOrEqual(before);
    expect(termsGrantedAtMs).toBeLessThanOrEqual(after);
  });

  // @REQ: B2C-CONSENT-RODO
  describe('strefa czasowa: moment zgody jest zegarem serwera (new Date()), nie literałem ani czasem przeglądarki — sprawdzone w dacie realnej zmiany czasu Europe/Warsaw (2026-10-25)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('granted_at obu dokumentów jest RÓWNY DOKŁADNIE zegarowi systemowemu w chwili wywołania, także w oknie zmiany czasu', async () => {
      const dstBoundaryMoment = new Date('2026-10-25T00:30:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(dstBoundaryMoment);

      const result = await saveLead(basePayload() as unknown as Parameters<typeof saveLead>[0]);

      expect(result.success).toBe(true);
      const leadRow = leadyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;

      expect((leadRow.privacyPolicyConsentGrantedAt as Date).getTime()).toBe(dstBoundaryMoment.getTime());
      expect((leadRow.termsConsentGrantedAt as Date).getTime()).toBe(dstBoundaryMoment.getTime());
    });
  });

  // @REQ: B2C-CONSENT-RODO
  it('AC1 — flaga logiczna (consent: true) zamiast wskazania wersji jest odrzucana błędem walidacji, zero zapisów', async () => {
    const payload = { ...basePayload(), consent: true };

    const result = await saveLead(payload as unknown as Parameters<typeof saveLead>[0]);

    expect(result.success).toBe(false);
    expect((result as { code?: string }).code).toBe('VALIDATION_ERROR');
    expectZeroWrites();
  });

  // @REQ: B2C-CONSENT-RODO
  it('AC1 — numer wersji jako TEKST (nie UUID) zamiast klucza obcego jest odrzucany błędem walidacji, zero zapisów', async () => {
    const payload = {
      ...basePayload(),
      consent: { privacyPolicyConsentVersionId: '3', termsConsentVersionId: TERMS_VERSION_ID },
    };

    const result = await saveLead(payload as unknown as Parameters<typeof saveLead>[0]);

    expect(result.success).toBe(false);
    expect((result as { code?: string }).code).toBe('VALIDATION_ERROR');
    expectZeroWrites();
  });

  // @REQ: B2C-CONSENT-RODO
  describe('AC2 — brak zgody (pole consent pominięte) odrzuca żądanie w Server Action, PRZED transakcją i PRZED przygotowaniem rezerwacji', () => {
    it('pole consent całkowicie pominięte', async () => {
      const payload = basePayload() as Record<string, unknown>;
      delete payload.consent;

      const result = await saveLead(payload as unknown as Parameters<typeof saveLead>[0]);

      expect(result.success).toBe(false);
      expectZeroWrites();
      expect(prepareBookingCandidatesSpy).not.toHaveBeenCalled();
      expect(visitDurationBasketFindFirstMock).not.toHaveBeenCalled();
    });

    it('consent obecne, ale brakuje wskazania wersji polityki prywatności', async () => {
      const payload = { ...basePayload(), consent: { termsConsentVersionId: TERMS_VERSION_ID } };

      const result = await saveLead(payload as unknown as Parameters<typeof saveLead>[0]);

      expect(result.success).toBe(false);
      expectZeroWrites();
      expect(prepareBookingCandidatesSpy).not.toHaveBeenCalled();
    });

    it('consent obecne, ale brakuje wskazania wersji regulaminu', async () => {
      const payload = { ...basePayload(), consent: { privacyPolicyConsentVersionId: PRIVACY_VERSION_ID } };

      const result = await saveLead(payload as unknown as Parameters<typeof saveLead>[0]);

      expect(result.success).toBe(false);
      expectZeroWrites();
      expect(prepareBookingCandidatesSpy).not.toHaveBeenCalled();
    });
  });

  // @REQ: B2C-CONSENT-RODO
  it('brzeg: pole zgody z nadmiarowym kluczem jest odrzucane błędem walidacji, zero zapisów (.strict())', async () => {
    const payload = {
      ...basePayload(),
      consent: {
        privacyPolicyConsentVersionId: PRIVACY_VERSION_ID,
        termsConsentVersionId: TERMS_VERSION_ID,
        marketingConsent: true,
      },
    };

    const result = await saveLead(payload as unknown as Parameters<typeof saveLead>[0]);

    expect(result.success).toBe(false);
    expect((result as { code?: string }).code).toBe('VALIDATION_ERROR');
    expectZeroWrites();
  });

  // @REQ: B2C-CONSENT-RODO
  describe('AC5 — wersja SZKICU albo NIEOBOWIĄZUJĄCEJ (zastąpionej) jest odrzucana po stronie serwera, zero zapisów; serwer nie dokleja "najnowszej" wersji sam', () => {
    it('wersja polityki prywatności istnieje, ale jest SZKICEM (isCurrent: false, publishedAt: null)', async () => {
      legalDocumentVersionFindUniqueMock.mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === PRIVACY_VERSION_ID) {
          return { ...currentPrivacyVersionRow(), isCurrent: false, publishedAt: null };
        }
        if (where.id === TERMS_VERSION_ID) return currentTermsVersionRow();
        return null;
      });

      const result = await saveLead(basePayload() as unknown as Parameters<typeof saveLead>[0]);

      expect(result.success).toBe(false);
      expectZeroWrites();
    });

    it('wersja regulaminu istnieje, ale została ZASTĄPIONA (isCurrent: false, publishedAt ustawiony w przeszłości)', async () => {
      legalDocumentVersionFindUniqueMock.mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === PRIVACY_VERSION_ID) return currentPrivacyVersionRow();
        if (where.id === TERMS_VERSION_ID) {
          return { ...currentTermsVersionRow(), isCurrent: false };
        }
        return null;
      });

      const result = await saveLead(basePayload() as unknown as Parameters<typeof saveLead>[0]);

      expect(result.success).toBe(false);
      expectZeroWrites();
    });

    // Przypadek brzegowy z WO ("Współbieżność z publikacją"): z perspektywy serwera to
    // DOKŁADNIE ten sam mechanizm co powyżej — wersja, która była `isCurrent: true` w
    // chwili renderu formularza (klient ją wtedy widział i wysłał), przestaje być
    // obowiązująca ZANIM żądanie dotarło do serwera (ktoś opublikował nową wersję w
    // międzyczasie). Serwer nie ma pojęcia "co było w chwili renderu" — sprawdza WYŁĄCZNIE
    // stan bieżący w bazie w chwili żądania, więc odrzucenie jest identyczne z przypadkiem
    // "wersja zastąpiona" powyżej. Osobny test — dla identyfikowalności wymagania z WO.
    it('współbieżność z publikacją: wersja była obowiązująca w chwili renderu formularza, przestała być obowiązująca zanim żądanie dotarło do serwera', async () => {
      legalDocumentVersionFindUniqueMock.mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === PRIVACY_VERSION_ID) {
          // Wersja, na którą wskazuje żądanie klienta, ISTNIEJE, ale między renderem a
          // wysyłką administrator opublikował kolejną — ta konkretna id przestała być
          // `isCurrent`.
          return { ...currentPrivacyVersionRow(), isCurrent: false };
        }
        if (where.id === TERMS_VERSION_ID) return currentTermsVersionRow();
        return null;
      });

      const result = await saveLead(basePayload() as unknown as Parameters<typeof saveLead>[0]);

      expect(result.success).toBe(false);
      // Serwer NIE dokleja po cichu najnowszej wersji zamiast tej przysłanej — zero
      // zapisów, żadna cicha zgoda na treść, której klient nie widział.
      expectZeroWrites();
    });

    it('wersja polityki prywatności wskazuje na wiersz właściwego rodzaju regulaminu (B2C_TERMS) zamiast polityki prywatności — odrzucone mimo isCurrent: true', async () => {
      legalDocumentVersionFindUniqueMock.mockImplementation(async ({ where }: { where: { id: string } }) => {
        // Pole `privacyPolicyConsentVersionId` wskazuje wiersz, który W BAZIE jest
        // aktualną wersją REGULAMINU, nie polityki prywatności — zgodność rodzaju nie
        // jest wymuszona przez FK (WO), musi ją sprawdzić serwer.
        if (where.id === PRIVACY_VERSION_ID) return { ...currentTermsVersionRow(), id: PRIVACY_VERSION_ID };
        if (where.id === TERMS_VERSION_ID) return currentTermsVersionRow();
        return null;
      });

      const result = await saveLead(basePayload() as unknown as Parameters<typeof saveLead>[0]);

      expect(result.success).toBe(false);
      expectZeroWrites();
    });

    it('wersja regulaminu wskazuje na wiersz właściwego rodzaju polityki prywatności (B2C_PRIVACY_POLICY) zamiast regulaminu — odrzucone mimo isCurrent: true', async () => {
      legalDocumentVersionFindUniqueMock.mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === PRIVACY_VERSION_ID) return currentPrivacyVersionRow();
        // Pole `termsConsentVersionId` wskazuje wiersz, który W BAZIE jest aktualną
        // wersją POLITYKI PRYWATNOŚCI, nie regulaminu — lustrzany przypadek do testu
        // powyżej (tam padał `documentKind` polityki, tu pada `documentKind` regulaminu).
        if (where.id === TERMS_VERSION_ID) return { ...currentPrivacyVersionRow(), id: TERMS_VERSION_ID };
        return null;
      });

      const result = await saveLead(basePayload() as unknown as Parameters<typeof saveLead>[0]);

      expect(result.success).toBe(false);
      expectZeroWrites();
    });
  });

  // @REQ: CRM-CLIENT-ANONYMIZE-RODO
  describe('brzeg: anonimizacja klienta (CRM-CLIENT-ANONYMIZE-RODO) nie usuwa ani nie zeruje dowodu zgody na leadzie', () => {
    it('anonymizeClientAction (apps/b2b-web) nie zawiera ŻADNEGO odwołania do modelu leady/tx.leady — dowód zgody na leadzie przeżywa anonimizację klienta bez świadomej decyzji o jego wymazaniu', () => {
      const actionsPath = path.join(
        process.cwd(),
        'apps/b2b-web/src/app/(dashboard)/customers/actions.ts',
      );
      const source = readFileSync(actionsPath, 'utf8');

      const startMarker = 'export async function anonymizeClientAction(';
      const startIdx = source.indexOf(startMarker);
      expect(startIdx).toBeGreaterThan(-1);

      const nextFnIdx = source.indexOf('\nexport async function ', startIdx + startMarker.length);
      const body = nextFnIdx === -1 ? source.slice(startIdx) : source.slice(startIdx, nextFnIdx);

      expect(body).not.toMatch(/\bleady\b/);
      expect(body).not.toMatch(/\btx\.leady\b/);
    });
  });
});
