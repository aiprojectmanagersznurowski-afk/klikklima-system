import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeWithIdempotency, hashRequestBody } from '../src/lib/field-api/idempotency';

// @REQ: FLD-API-IDEMPOTENCY-REGISTRY
// Testy centralnego rejestru idempotencji Field App

const mockFindUniqueIdempotency = vi.fn();
const mockCreateIdempotency = vi.fn();
const mockUpdateIdempotency = vi.fn();

type MockTx = {
  fieldRequestIdempotency: {
    findUnique: typeof mockFindUniqueIdempotency;
    create: typeof mockCreateIdempotency;
    update: typeof mockUpdateIdempotency;
  };
};

const mockTransaction = vi.fn((callback: (tx: MockTx) => Promise<unknown>) =>
  callback({
    fieldRequestIdempotency: {
      findUnique: mockFindUniqueIdempotency,
      create: mockCreateIdempotency,
      update: mockUpdateIdempotency,
    },
  })
);

vi.mock('@repo/database', () => ({
  prisma: {
    fieldRequestIdempotency: {
      findUnique: (...args: unknown[]) => mockFindUniqueIdempotency(...args),
      create: (...args: unknown[]) => mockCreateIdempotency(...args),
      update: (...args: unknown[]) => mockUpdateIdempotency(...args),
    },
    $transaction: (fn: (tx: MockTx) => Promise<unknown>) => mockTransaction(fn),
  },
}));

describe('FLD-API-IDEMPOTENCY-REGISTRY', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hashRequestBody zwraca deterministyczny hash SHA-256 dla obiektu payloadu', () => {
    const payloadA = { isAvailable: true, comment: 'test' };
    const payloadB = { comment: 'test', isAvailable: true }; // różne kolejności kluczy
    const hashA = hashRequestBody(payloadA);
    const hashB = hashRequestBody(payloadB);

    expect(hashA).toBeDefined();
    expect(hashA).toHaveLength(64);
    expect(hashA).toBe(hashB); // znormalizowany hash dla tej samej treści
  });

  it('brak klucza idempotencji skutkuje błędem 400 Bad Request bez dotykania transakcji domenowej', async () => {
    const mockWorker = vi.fn();
    const result = await executeWithIdempotency({
      idempotencyKey: null,
      actorEmail: 'auditor@klikklima.pl',
      endpoint: '/api/field/availability/self',
      body: { isAvailable: true },
      operation: mockWorker,
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      success: false,
      error: 'Wymagany jest nagłówek Idempotency-Key dla operacji zapisu',
    });
    expect(mockWorker).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('pierwsze żądanie rejestruje klucz, wykonuje operację i zapisuje responseBody w transakcji', async () => {
    mockFindUniqueIdempotency.mockResolvedValueOnce(null);
    const mockWorker = vi.fn().mockResolvedValueOnce({
      status: 200,
      body: { success: true, isAvailable: true },
    });

    const result = await executeWithIdempotency({
      idempotencyKey: 'idemp-uuid-1',
      actorEmail: 'auditor@klikklima.pl',
      endpoint: '/api/field/availability/self',
      body: { isAvailable: true },
      operation: mockWorker,
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, isAvailable: true });
    expect(mockWorker).toHaveBeenCalledTimes(1);
    expect(mockCreateIdempotency).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idempotencyKey: 'idemp-uuid-1',
        actorEmail: 'auditor@klikklima.pl',
        endpoint: '/api/field/availability/self',
      }),
    });
    expect(mockUpdateIdempotency).toHaveBeenCalledWith({
      where: { idempotencyKey: 'idemp-uuid-1' },
      data: {
        responseBody: { success: true, isAvailable: true },
      },
    });
  });

  it('powtórzenie żądania z tym samym kluczem i tym samym hashem zwraca zapisaną odpowiedź bez ponownego wykonania operacji', async () => {
    const payload = { isAvailable: true };
    const hash = hashRequestBody(payload);

    mockFindUniqueIdempotency.mockResolvedValueOnce({
      idempotencyKey: 'idemp-uuid-1',
      requestHash: hash,
      responseBody: { success: true, isAvailable: true, cachedAt: '2026-09-25T12:00:00Z' },
    });
    const mockWorker = vi.fn();

    const result = await executeWithIdempotency({
      idempotencyKey: 'idemp-uuid-1',
      actorEmail: 'auditor@klikklima.pl',
      endpoint: '/api/field/availability/self',
      body: payload,
      operation: mockWorker,
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, isAvailable: true, cachedAt: '2026-09-25T12:00:00Z' });
    expect(mockWorker).not.toHaveBeenCalled();
    expect(mockCreateIdempotency).not.toHaveBeenCalled();
  });

  it('ten sam klucz z inną treścią żądania (inny requestHash) zwraca 409 Conflict', async () => {
    mockFindUniqueIdempotency.mockResolvedValueOnce({
      idempotencyKey: 'idemp-uuid-1',
      requestHash: 'different-sha256-hash',
      responseBody: { success: true },
    });
    const mockWorker = vi.fn();

    const result = await executeWithIdempotency({
      idempotencyKey: 'idemp-uuid-1',
      actorEmail: 'auditor@klikklima.pl',
      endpoint: '/api/field/availability/self',
      body: { isAvailable: false },
      operation: mockWorker,
    });

    expect(result.status).toBe(409);
    expect(result.body).toEqual({
      success: false,
      error: 'Konflikt klucza idempotencji: podano inną treść żądania dla użytego wcześniej klucza',
    });
    expect(mockWorker).not.toHaveBeenCalled();
  });

  it('awaria wewnątrz operacji wycofuje transakcję (rollback klucza idempotencji)', async () => {
    mockFindUniqueIdempotency.mockResolvedValueOnce(null);
    const mockWorker = vi.fn().mockRejectedValueOnce(new Error('Błąd bazy danych w transakcji'));

    await expect(
      executeWithIdempotency({
        idempotencyKey: 'idemp-uuid-fail',
        actorEmail: 'auditor@klikklima.pl',
        endpoint: '/api/field/availability/self',
        body: { isAvailable: true },
        operation: mockWorker,
      })
    ).rejects.toThrow('Błąd bazy danych w transakcji');
  });
});
