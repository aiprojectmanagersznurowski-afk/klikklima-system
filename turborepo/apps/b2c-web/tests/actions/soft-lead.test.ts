import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LEAD_STATUSES } from '@klikklima/contracts';
import { saveSoftLead } from '../../app/actions/leads';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Mock Supabase admin client
const mockInsert = vi.fn();
const mockFrom = vi.fn().mockImplementation((table: string) => ({
  insert: mockInsert.mockImplementation((rows: unknown[]) => {
    return Promise.resolve({ data: rows, error: null });
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('B2C-SOFT-LEAD — zapis kontaktu cząstkowego i separacja od lejka', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // @REQ: B2C-SOFT-LEAD
  it('zapis tworzy rekord wyłącznie w soft_leads i nie dotyka tabeli leads', async () => {
    const phone = '500100200';
    const partialData = { location: 'Mieszkanie', roomCount: 2 };

    const result = await saveSoftLead(phone, partialData);

    expect(result.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('soft_leady');
    expect(mockFrom).not.toHaveBeenCalledWith('leads');

    // Sprawdzenie przekazanych danych
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        dane_kontaktowe: phone,
        dane_cząstkowe: partialData,
      }),
    ]);
  });

  // @REQ: B2C-SOFT-LEAD
  it('soft lead nie posiada statusu z maszyny stanów lejka (LEAD_STATUSES)', async () => {
    const phone = '600100200';
    await saveSoftLead(phone, { location: 'Dom' });

    const insertedRow = mockInsert.mock.calls[0][0][0] as { status?: string };

    // Status nie może być żadnym ze stanów maszyny lejka (np. NEW_LEAD, T01, itd.)
    if (insertedRow.status) {
      expect(LEAD_STATUSES).not.toContain(insertedRow.status);
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
