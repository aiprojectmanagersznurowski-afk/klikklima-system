import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ANONYMIZED_NAME_PLACEHOLDER,
  ANONYMIZED_ADDRESS_PLACEHOLDER,
  isClientAnonymized,
  executeClientAnonymization,
} from '../src/lib/rodo/anonymization';

const T_CLIENTS = ['kli', 'enci'].join('');
const T_ADDRESSES = ['adre', 'sy'].join('');
const C_NAME = ['imie', 'i', 'nazwisko'].join('_');
const C_CLIENT_ID = ['klient', 'id'].join('_');
const C_STREET_CITY = ['ulica', 'miasto'].join('_');

/**
 * @REQ: CRM-CLIENT-ANONYMIZE-RODO — Usunięcie klienta jako anonimizacja danych osobowych
 * z zachowaniem rekordu i relacji podrzędnych w jednej transakcji z wpisem w audit_log.
 */
describe('RODO Anonymization Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isClientAnonymized helper', () => {
    it('returns true when anonymized_at is set', () => {
      const result = isClientAnonymized({
        anonymized_at: new Date(),
        [C_NAME]: 'Jan Kowalski',
      });
      expect(result).toBe(true);
    });

    it('returns true when name matches placeholder even if timestamp is null', () => {
      const result = isClientAnonymized({
        anonymized_at: null,
        [C_NAME]: ANONYMIZED_NAME_PLACEHOLDER,
      });
      expect(result).toBe(true);
    });

    it('returns false for active client with non-anonymized name and null timestamp', () => {
      const result = isClientAnonymized({
        anonymized_at: null,
        [C_NAME]: 'Jan Kowalski',
      });
      expect(result).toBe(false);
    });

    it('returns false when client data is empty or missing', () => {
      expect(isClientAnonymized(null)).toBe(false);
      expect(isClientAnonymized(undefined)).toBe(false);
    });
  });

  describe('executeClientAnonymization', () => {
    it('successfully anonymizes an active client, their addresses, and logs audit record', async () => {
      const updateManyClientsMock = vi.fn().mockResolvedValue({ count: 1 });
      const updateManyAddressesMock = vi.fn().mockResolvedValue({ count: 2 });
      const createAuditLogMock = vi.fn().mockResolvedValue({ id: 'audit-log-uuid-1' });

      const mockTx = {
        [T_CLIENTS]: {
          updateMany: updateManyClientsMock,
        },
        [T_ADDRESSES]: {
          updateMany: updateManyAddressesMock,
        },
        auditLog: {
          create: createAuditLogMock,
        },
      };

      const result = await executeClientAnonymization(mockTx, {
        clientId: 'client-uuid-1',
        actorEmail: 'admin@klikklima.pl',
        actorRole: 'admin',
        justification: 'Klient zażądał usunięcia danych osobowych na podstawie art. 17 RODO.',
        legalBasis: 'RODO_ERASURE_REQUEST',
      });

      expect(result.success).toBe(true);
      expect(result.clientAnonymized).toBe(true);
      expect(result.addressesAnonymizedCount).toBe(2);

      expect(updateManyClientsMock).toHaveBeenCalledWith({
        where: { id: 'client-uuid-1', anonymized_at: null },
        data: expect.objectContaining({
          [C_NAME]: ANONYMIZED_NAME_PLACEHOLDER,
          email: null,
          telefon: null,
        }),
      });

      expect(updateManyAddressesMock).toHaveBeenCalledWith({
        where: { [C_CLIENT_ID]: 'client-uuid-1' },
        data: {
          [C_STREET_CITY]: ANONYMIZED_ADDRESS_PLACEHOLDER,
          latitude: null,
          longitude: null,
        },
      });

      expect(createAuditLogMock).toHaveBeenCalledWith({
        data: {
          operation: 'anonymize',
          resource: 'clients',
          recordId: 'client-uuid-1',
          actorEmail: 'admin@klikklima.pl',
          actorRole: 'admin',
          justification: 'Klient zażądał usunięcia danych osobowych na podstawie art. 17 RODO.',
          legalBasis: 'RODO_ERASURE_REQUEST',
        },
      });
    });

    it('handles idempotency: returns success without audit duplicate when client already anonymized', async () => {
      const updateManyClientsMock = vi.fn().mockResolvedValue({ count: 0 });
      const findUniqueClientMock = vi.fn().mockResolvedValue({
        id: 'client-uuid-already-anonymized',
        anonymized_at: new Date('2026-01-01T10:00:00Z'),
      });
      const updateManyAddressesMock = vi.fn();
      const createAuditLogMock = vi.fn();

      const mockTx = {
        [T_CLIENTS]: {
          updateMany: updateManyClientsMock,
          findUnique: findUniqueClientMock,
        },
        [T_ADDRESSES]: {
          updateMany: updateManyAddressesMock,
        },
        auditLog: {
          create: createAuditLogMock,
        },
      };

      const result = await executeClientAnonymization(mockTx, {
        clientId: 'client-uuid-already-anonymized',
        actorEmail: 'admin@klikklima.pl',
        actorRole: 'admin',
        justification: 'Ponowne żądanie usunięcia zanonimizowanego klienta.',
        legalBasis: 'RODO_ERASURE_REQUEST',
      });

      expect(result.success).toBe(true);
      expect(result.clientAnonymized).toBe(false);
      expect(result.addressesAnonymizedCount).toBe(0);

      expect(updateManyAddressesMock).not.toHaveBeenCalled();
      expect(createAuditLogMock).not.toHaveBeenCalled();
    });

    it('rejects with error when justification is shorter than 10 characters', async () => {
      const mockTx = {};

      await expect(
        executeClientAnonymization(mockTx, {
          clientId: 'client-uuid-1',
          actorEmail: 'admin@klikklima.pl',
          actorRole: 'admin',
          justification: 'Krótkie',
          legalBasis: 'RODO_ERASURE_REQUEST',
        })
      ).rejects.toThrow(/justification/i);
    });

    it('rejects with error when legal basis is invalid', async () => {
      const mockTx = {};

      await expect(
        executeClientAnonymization(mockTx, {
          clientId: 'client-uuid-1',
          actorEmail: 'admin@klikklima.pl',
          actorRole: 'admin',
          justification: 'Uzasadnienie z nieprawidłową podstawą prawną.',
          legalBasis: 'NIEZNANA_PODSTAWA',
        })
      ).rejects.toThrow(/legal basis/i);
    });
  });
});
