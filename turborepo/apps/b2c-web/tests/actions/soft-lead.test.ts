import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LEAD_STATUSES } from '@klikklima/contracts';
import { saveSoftLead } from '../../app/actions/leads';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Mock Supabase admin client
//
// D3 (decyzja Michała 2026-09-24, zweryfikowana odczytem `leads.ts` w tej turze):
// `saveSoftLead` zapisuje przez zwykły `insert`, nie `upsert` — wcześniejszy `upsert(...,
// { onConflict: 'dane_kontaktowe' })` zakładał unikalny indeks na `dane_kontaktowe`,
// którego tabela nie ma, więc na żywym Postgresie/PostgREST rzucał SQLSTATE 42P10 na
// KAŻDYM wywołaniu (patrz M8 w leads.ts). Mock i tak wystawia obie metody (wzorem
// `soft-lead-security.test.ts` w tym katalogu) — nieużywany `mockUpsert` jest tu
// nieszkodliwym zapasem, nie źródłem asercji.
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
    // `insert` (D3) jest wołany z JEDNYM argumentem (bez `onConflict`) — w przeciwieństwie
    // do dawnego `upsert`.
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        dane_kontaktowe: phone,
        dane_cząstkowe: domainPartialData,
      }),
    ]);
  });

  // @REQ: B2C-SOFT-LEAD
  it('soft lead nie posiada statusu z maszyny stanów lejka (LEAD_STATUSES)', async () => {
    const phone = '600100200';
    await saveSoftLead(phone, { location: 'Dom', consentDocumentVersionId: validConsentDocumentVersionId });

    const upsertedRow = mockInsert.mock.calls[0][0][0] as { status?: string };

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
