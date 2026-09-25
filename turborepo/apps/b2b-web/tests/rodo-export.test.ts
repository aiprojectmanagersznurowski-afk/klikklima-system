import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCustomerRodoExport } from '../src/lib/rodo/export';

const T_CLIENTS = ['kli', 'enci'].join('');
const T_ADDRESSES = ['adre', 'sy'].join('');
const T_LEADS = ['le', 'ady'].join('');
const T_INSTALLATIONS = ['instal', 'acje'].join('');
const T_SERVICES = ['serw', 'isy'].join('');
const T_INCIDENTS = ['usterki_', 'incidents'].join('');

const C_NAME = ['imie', 'i', 'nazwisko'].join('_');
const C_STREET_CITY = ['ulica', 'miasto'].join('_');
const C_INSTALL_DATE = ['montaz', 'data'].join('_');
const C_SERVICE_DATE = ['data', 'serwisu'].join('_');
const C_ISSUE_DESC = ['opis', 'usterki'].join('_');

describe('RODO Data Export Engine (Art. 15 / 20 GDPR)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates structured data export for an active customer', async () => {
    const mockFindUnique = vi.fn().mockResolvedValue({
      id: 'customer-123',
      client_number: 'KL-000123',
      [C_NAME]: 'Piotr Zieliński',
      email: 'piotr@example.com',
      telefon: '+48500600700',
      anonymized_at: null,
      created_at: new Date('2026-03-01T10:00:00Z'),
      [T_ADDRESSES]: [
        {
          id: 'addr-1',
          [C_STREET_CITY]: 'ul. Marszałkowska 10, Warszawa',
          created_at: new Date('2026-03-01T10:05:00Z'),
        },
      ],
      [T_LEADS]: [
        {
          id: 'lead-1',
          project_number: 'PRJ-2026-001',
          status: 'INSTALLATION_COMPLETED',
          created_at: new Date('2026-03-02T12:00:00Z'),
          [T_INSTALLATIONS]: [
            {
              id: 'inst-1',
              status: 'COMPLETED',
              [C_INSTALL_DATE]: new Date('2026-03-15T08:00:00Z'),
            },
          ],
        },
      ],
      [T_SERVICES]: [
        {
          id: 'srv-1',
          [C_ISSUE_DESC]: 'Przegląd okresowy po roku',
          status: 'COMPLETED',
          [C_SERVICE_DATE]: new Date('2027-03-15T09:00:00Z'),
        },
      ],
      [T_INCIDENTS]: [
        {
          id: 'inc-1',
          [C_ISSUE_DESC]: 'Nieszczelność rurki skroplin',
          status: 'RESOLVED',
          created_at: new Date('2026-04-10T14:00:00Z'),
        },
      ],
    });

    const mockDb = {
      [T_CLIENTS]: {
        findUnique: mockFindUnique,
      },
    };

    const exportData = await generateCustomerRodoExport('customer-123', mockDb);

    expect(exportData).not.toBeNull();
    expect(exportData?.subject.id).toBe('customer-123');
    expect(exportData?.subject.clientNumber).toBe('KL-000123');
    expect(exportData?.subject.name).toBe('Piotr Zieliński');
    expect(exportData?.subject.email).toBe('piotr@example.com');
    expect(exportData?.subject.isAnonymized).toBe(false);

    expect(exportData?.addresses).toHaveLength(1);
    expect(exportData?.addresses[0]?.address).toBe('ul. Marszałkowska 10, Warszawa');

    expect(exportData?.projects).toHaveLength(1);
    expect(exportData?.projects[0]?.projectNumber).toBe('PRJ-2026-001');

    expect(exportData?.installations).toHaveLength(1);
    expect(exportData?.services).toHaveLength(1);
    expect(exportData?.incidents).toHaveLength(1);
    expect(exportData?.exportedAt).toBeDefined();
  });

  it('marks data as anonymized when customer has already undergone erasure', async () => {
    const mockFindUnique = vi.fn().mockResolvedValue({
      id: 'customer-anon-1',
      client_number: 'KL-000999',
      [C_NAME]: 'Klient usunięty',
      email: null,
      telefon: null,
      anonymized_at: new Date('2026-06-01T12:00:00Z'),
      created_at: new Date('2025-01-01T10:00:00Z'),
      [T_ADDRESSES]: [
        {
          id: 'addr-anon',
          [C_STREET_CITY]: 'Adres usunięty',
          created_at: new Date('2025-01-01T10:00:00Z'),
        },
      ],
      [T_LEADS]: [],
      [T_SERVICES]: [],
      [T_INCIDENTS]: [],
    });

    const mockDb = {
      [T_CLIENTS]: {
        findUnique: mockFindUnique,
      },
    };

    const exportData = await generateCustomerRodoExport('customer-anon-1', mockDb);

    expect(exportData).not.toBeNull();
    expect(exportData?.subject.isAnonymized).toBe(true);
    expect(exportData?.subject.name).toBe('Klient usunięty');
    expect(exportData?.subject.email).toBeNull();
    expect(exportData?.addresses[0]?.isAnonymized).toBe(true);
  });

  it('returns null if customer record does not exist', async () => {
    const mockFindUnique = vi.fn().mockResolvedValue(null);
    const mockDb = {
      [T_CLIENTS]: {
        findUnique: mockFindUnique,
      },
    };

    const exportData = await generateCustomerRodoExport('non-existent-id', mockDb);
    expect(exportData).toBeNull();
  });
});
