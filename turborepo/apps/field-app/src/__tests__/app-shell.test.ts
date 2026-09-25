import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCurrentSession, setCurrentSession, signOut } from '../auth/supabase';
import { FieldApiClient } from '../api/client';
import type { FieldJob, MinimizedClientContact } from '../types';

// @REQ: FLD-APP-SHELL
// @REQ: FLD-JOBS-OWN
// @REQ: FLD-CONSENT-ENFORCE
// @REQ: FLD-MOBILE-TEST-HARNESS

describe('FLD-APP-SHELL & FLD-MOBILE-TEST-HARNESS: Testy jednostkowe aplikacji mobilnej', () => {
  beforeEach(async () => {
    await signOut();
  });

  it('sesja pracownika terenowego: zapis, odczyt oraz wylogowanie', async () => {
    expect(getCurrentSession()).toBeNull();

    setCurrentSession({
      token: 'jwt-token-auditor-1',
      email: 'audytor@klikklima.pl',
      role: 'audytor',
      entityId: 'auditor-uuid-1',
    });

    const session = getCurrentSession();
    expect(session).not.toBeNull();
    expect(session?.role).toBe('audytor');
    expect(session?.entityId).toBe('auditor-uuid-1');

    await signOut();
    expect(getCurrentSession()).toBeNull();
  });

  it('FieldApiClient: dołącza nagłówek autoryzacji oraz Idempotency-Key dla akceptacji zgód', async () => {
    let capturedHeaders: Record<string, string> = {};
    let capturedUrl = '';

    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init?.headers || {}) as Record<string, string>;
      return Promise.resolve({
        json: () => Promise.resolve({ success: true }),
      });
    });

    global.fetch = mockFetch;

    const client = new FieldApiClient({
      baseUrl: 'http://localhost:3000',
      getToken: () => 'token-12345',
    });

    const idempotencyKey = 'key-uuid-999';
    await client.acceptConsent('version-1', idempotencyKey);

    expect(capturedUrl).toBe('http://localhost:3000/api/field/consents/accept');
    expect(capturedHeaders['Authorization']).toBe('Bearer token-12345');
    expect(capturedHeaders['Idempotency-Key']).toBe(idempotencyKey);
  });

  it('CRM-KLI-AC2: model danych zlecenia w aplikacji terenowej zawiera wyłącznie zminimalizowane dane klienta', () => {
    const contact: MinimizedClientContact = {
      imieINazwisko: 'Jan Kowalski',
      telefon: '+48 600 000 000',
      adres: 'ul. Marszałkowska 10, Warszawa',
    };

    const job: FieldJob = {
      id: 'job-1',
      projectNumber: 'PROJ-001',
      status: 'SCHEDULED',
      scheduledAt: '2026-10-01T10:00:00.000Z',
      address: {
        ulicaMiasto: 'ul. Marszałkowska 10, Warszawa',
        latitude: 52.2297,
        longitude: 21.0122,
      },
      client: contact,
    };

    expect(job.client.imieINazwisko).toBe('Jan Kowalski');
    expect(job.client.telefon).toBe('+48 600 000 000');
    expect(job.client.adres).toBe('ul. Marszałkowska 10, Warszawa');

    // Weryfikacja braku pól nadmiarowych
    const clientKeys = Object.keys(job.client);
    expect(clientKeys.sort()).toEqual(['adres', 'imieINazwisko', 'telefon']);
  });

  it('FLD-CONSENT-ENFORCE: blokada rozpoczęcia zlecenia gdy zgody nie są zaakceptowane', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/start')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              success: false,
              error: 'Brak akceptacji aktualnych regulaminów i oświadczeń',
              missingDocuments: ['BHP_REGULATIONS_V2'],
            }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: true }),
      });
    });

    global.fetch = mockFetch;

    const client = new FieldApiClient({
      baseUrl: 'http://localhost:3000',
      getToken: () => 'token-test',
    });

    const res = await client.startJob('job-1');
    expect(res.success).toBe(false);
    expect(res.missingDocuments).toEqual(['BHP_REGULATIONS_V2']);
  });
});
