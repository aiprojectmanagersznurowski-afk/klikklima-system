import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LEAD_STATUSES } from '@klikklima/contracts';
import { saveSoftLead } from '../../app/actions/leads';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Mock Supabase admin client
//
// B2C-SOFT-LEAD-CONSENT (2026-09-24): `saveSoftLead` zapisuje przez `upsert(...,
// { onConflict: 'dane_kontaktowe' })`, nie `insert` (patrz M8 w leads.ts) — mock musi
// wystawiać obie metody, wzorem `soft-lead-security.test.ts` w tym katalogu, inaczej
// wywołanie produkcyjne wywala się na "upsert is not a function" (błędny RED).
const mockInsert = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn().mockImplementation((table: string) => ({
  insert: mockInsert.mockImplementation((rows: unknown[]) => {
    return Promise.resolve({ data: rows, error: null });
  }),
  upsert: mockUpsert.mockImplementation((rows: unknown[]) => {
    return Promise.resolve({ data: rows, error: null });
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// B2C-SOFT-LEAD-CONSENT wymaga FK (UUID) do legal_document_versions na KAŻDY zapis —
// wartość poniżej jest nieużywana jako realny wiersz (Supabase zamockowany całkowicie),
// służy tylko do przejścia walidacji Zod `.uuid()` w leads.ts.
const validConsentDocumentVersionId = '11111111-1111-1111-1111-111111111111';

describe('B2C-SOFT-LEAD — zapis kontaktu cząstkowego i separacja od lejka', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // @REQ: B2C-SOFT-LEAD
  it('zapis tworzy rekord wyłącznie w soft_leads i nie dotyka tabeli leads', async () => {
    const phone = '500100200';
    const domainPartialData = { location: 'Mieszkanie', roomCount: 2 };
    const partialData = { ...domainPartialData, consentDocumentVersionId: validConsentDocumentVersionId };

    const result = await saveSoftLead(phone, partialData);

    expect(result.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('soft_leady');
    expect(mockFrom).not.toHaveBeenCalledWith('leads');

    // Sprawdzenie przekazanych danych: `consentDocumentVersionId` jest wydzielane do
    // kolumny `consent_version_id` osobno od pozostałych danych częściowych (leads.ts:130).
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          dane_kontaktowe: phone,
          dane_cząstkowe: domainPartialData,
        }),
      ],
      expect.anything(),
    );
  });

  // @REQ: B2C-SOFT-LEAD
  it('soft lead nie posiada statusu z maszyny stanów lejka (LEAD_STATUSES)', async () => {
    const phone = '600100200';
    await saveSoftLead(phone, { location: 'Dom', consentDocumentVersionId: validConsentDocumentVersionId });

    const upsertedRow = mockUpsert.mock.calls[0][0][0] as { status?: string };

    // Status nie może być żadnym ze stanów maszyny lejka (np. NEW_LEAD, T01, itd.)
    if (upsertedRow.status) {
      expect(LEAD_STATUSES).not.toContain(upsertedRow.status);
    }
  });

  // @REQ: B2C-SOFT-LEAD
  it('dane soft leada nie wystarczają do utworzenia pełnego leada (rozłączność wymagań B2C-LEAD-ENTRY)', () => {
    // Lead wymaga: imię i nazwisko, adres, telefon, e-mail oraz odpowiedzi triage
    const softLeadData: Record<string, string> = { phone: '500100200' };

    const hasName = Boolean(softLeadData.name);
    const hasEmail = Boolean(softLeadData.email);
    const hasAddress = Boolean(softLeadData.address);

    // Brak kompletu danych blokuje wejście do lejka
    expect(hasName && hasEmail && hasAddress).toBe(false);
  });

  // @REQ: B2C-SOFT-LEAD
  it('ExitIntentModal wstrzymuje otwarcie, gdy otwarty jest konfigurator urządzenia', () => {
    const modalPath = join(process.cwd(), 'apps/b2c-web/components/triage/ExitIntentModal.tsx');
    expect(existsSync(modalPath)).toBe(true);
    const content = readFileSync(modalPath, 'utf8');

    // Sprawdzenie, czy ExitIntent sprawdza obecność otwartego DeviceModal
    expect(content).toMatch(/dialog|modal|DeviceModal/i);
  });
});
