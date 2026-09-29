import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regresja zgłoszona ręcznie (fix/actor-consents-document-kind-filter), NIE Work Order.
 *
 * `getActorConsentsStatus` (apps/b2b-web/src/lib/domain/consents.ts, linia ~49) woła
 * `prisma.legalDocumentVersion.findMany({ where: { isCurrent: true } })` — BEZ filtra
 * `documentKind`. Funkcja ma sens "czy PRACOWNIK zaakceptował SWOJE zgody"
 * (FLD-CONSENT-ENFORCE/FLD-CONSENT-ACCEPT), a "swoje" = `RODO_CONSENT`/`EMPLOYEE_TERMS`.
 *
 * Po scaleniu B2C-CONSENT-RODO (branch feat/b2c-consent-rodo, jeszcze nie na main w chwili
 * pisania tego testu) enum `LegalDocumentKind` zyskuje `B2C_PRIVACY_POLICY`/`B2C_TERMS`
 * (dokumenty KLIENTA, publikowane przez tego samego admina w tym samym rejestrze). Bez
 * filtra po rodzaju, opublikowanie pierwszej wersji dokumentu B2C:
 *   1) dolicza dokument kliencki do `documents` zwracanych pracownikowi (błędny widok),
 *   2) bo pracownik nigdy nie akceptuje dokumentu kliencki (nie ma powodu), `accepted: false`
 *      dla tego wiersza ściąga `allAccepted` z true na false — pracownik zostaje zablokowany
 *      zgodą, której nie musi (i nie powinien) zaakceptować.
 *
 * Ten plik NIE zakłada, że enum `LegalDocumentKind` już ma nowe wartości na tym branchu
 * (schema.prisma na `main` w chwili pisania ma tylko RODO_CONSENT/EMPLOYEE_TERMS) — `@repo/database`
 * jest w całości zamockowany, więc `documentKind` na zwracanych obiektach jest zwykłym
 * literałem string (typ `DocumentConsentStatus.documentKind` to `string`, nie enum importowany
 * z Prisma), dokładnie jak w `legal-document-versions.test.ts` dla `LegalDocumentKind`
 * sprzed migracji. `@klikklima/contracts` NIE jest mockowany — `can('monter', 'legal_document_versions', 'read')`
 * zwraca `'yes'` dziś (rbac.contract.mjs: read dla wszystkich czterech ról), więc prawdziwa
 * funkcja `can()` wystarcza i nie trzeba jej podrabiać.
 *
 * Mock `legalDocumentVersion.findMany` NIE ignoruje przekazanego `where` — odtwarza filtrowanie
 * Prisma na podstawie `where.isCurrent` i (jeśli obecny) `where.documentKind.in`, dokładnie tak,
 * jak zrobiłaby to prawdziwa baza. Dzięki temu ten sam test jest poprawnym RED dziś (produkcja
 * nie wysyła `documentKind` w ogóle → mock zwraca WSZYSTKIE cztery dokumenty) i stanie się
 * poprawnym GREEN, gdy implementer doda filtr — bez zmiany testu.
 */

const canSpy = vi.fn();

vi.mock('@klikklima/contracts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@klikklima/contracts')>();
  return {
    ...actual,
    can: (...args: Parameters<typeof actual.can>) => {
      canSpy(...args);
      return actual.can(...args);
    },
  };
});

interface FakeLegalDocumentVersion {
  id: string;
  documentKind: string;
  versionNo: number;
  content: string;
  isCurrent: boolean;
  createdAt: Date;
}

interface FakeEmployeeConsent {
  id: string;
  versionId: string;
  auditorId: string | null;
  crewId: string | null;
  acceptedAt: Date;
}

// Rejestr obowiązujących dokumentów obu „światów" — pracowniczego i klienckiego (po B2C-CONSENT-RODO).
const ALL_CURRENT_VERSIONS: FakeLegalDocumentVersion[] = [
  {
    id: 'ver-rodo-1',
    documentKind: 'RODO_CONSENT',
    versionNo: 3,
    content: 'Klauzula RODO pracownicza v3...',
    isCurrent: true,
    createdAt: new Date('2026-01-10T08:00:00Z'),
  },
  {
    id: 'ver-terms-1',
    documentKind: 'EMPLOYEE_TERMS',
    versionNo: 2,
    content: 'Regulamin pracowniczy v2...',
    isCurrent: true,
    createdAt: new Date('2026-02-15T08:00:00Z'),
  },
  {
    id: 'ver-b2c-privacy-1',
    documentKind: 'B2C_PRIVACY_POLICY',
    versionNo: 1,
    content: 'Polityka prywatności dla klienta v1...',
    isCurrent: true,
    createdAt: new Date('2026-09-25T08:00:00Z'),
  },
  {
    id: 'ver-b2c-terms-1',
    documentKind: 'B2C_TERMS',
    versionNo: 1,
    content: 'Regulamin dla klienta v1...',
    isCurrent: true,
    createdAt: new Date('2026-09-25T08:05:00Z'),
  },
];

// Pracownik (monter, crew-1) zaakceptował OBA swoje dokumenty — nigdy nie akceptował (i nie musi) dokumentów B2C.
const EMPLOYEE_CONSENTS: FakeEmployeeConsent[] = [
  {
    id: 'consent-1',
    versionId: 'ver-rodo-1',
    auditorId: null,
    crewId: 'crew-1',
    acceptedAt: new Date('2026-01-11T09:00:00Z'),
  },
  {
    id: 'consent-2',
    versionId: 'ver-terms-1',
    auditorId: null,
    crewId: 'crew-1',
    acceptedAt: new Date('2026-02-16T09:00:00Z'),
  },
];

const findManyLegalDocumentVersionMock = vi.fn(
  async (args: { where?: { isCurrent?: boolean; documentKind?: { in?: string[] } } }) => {
    const where = args?.where ?? {};
    const kinds = where.documentKind?.in;
    return ALL_CURRENT_VERSIONS.filter(
      (doc) => doc.isCurrent === where.isCurrent && (!kinds || kinds.includes(doc.documentKind))
    );
  }
);

const findManyEmployeeConsentMock = vi.fn(
  async (args: { where?: { auditorId?: string; crewId?: string } }) => {
    const where = args?.where ?? {};
    return EMPLOYEE_CONSENTS.filter((c) => {
      if (where.crewId !== undefined) return c.crewId === where.crewId;
      if (where.auditorId !== undefined) return c.auditorId === where.auditorId;
      return false;
    });
  }
);

vi.mock('@repo/database', () => ({
  prisma: {
    legalDocumentVersion: {
      findMany: (...args: unknown[]) => findManyLegalDocumentVersionMock(...(args as [never])),
    },
    employeeConsent: {
      findMany: (...args: unknown[]) => findManyEmployeeConsentMock(...(args as [never])),
    },
  },
  Prisma: {},
}));

import { getActorConsentsStatus } from '../src/lib/domain/consents';

// @REQ: FIX-CONSENTS-DOCUMENT-KIND-FILTER
describe('Regresja: getActorConsentsStatus musi filtrować po documentKind (świat pracownika vs klienta)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zwraca WYŁĄCZNIE dokumenty pracownicze (RODO_CONSENT, EMPLOYEE_TERMS), pomijając obowiązujące dokumenty B2C', async () => {
    const actor = {
      email: 'monter@klikklima.pl',
      role: 'monter' as const,
      entityId: 'crew-1',
      isActive: true,
    };

    const result = await getActorConsentsStatus(actor);

    expect(result.success).toBe(true);
    expect(canSpy).toHaveBeenCalledWith('monter', 'legal_document_versions', 'read');

    // Sedno regresji: dziś funkcja nie filtruje po documentKind, więc zwróci 4 dokumenty
    // (w tym dwa dokumenty B2C, których pracownik nigdy nie akceptuje i nie powinien akceptować).
    expect(result.documents).toHaveLength(2);

    const kinds = (result.documents ?? []).map((d) => d.documentKind).sort();
    expect(kinds).toEqual(['EMPLOYEE_TERMS', 'RODO_CONSENT']);

    // Konsekwencja bezpośrednia braku filtra: dokument kliencki B2C_PRIVACY_POLICY jest
    // policzony jako "niezaakceptowany" przez pracownika, mimo że nigdy nie powinien być
    // od niego wymagany — ściąga to allAccepted z true na false (błędna blokada startu zlecenia).
    expect(result.allAccepted).toBe(true);
  });
});
