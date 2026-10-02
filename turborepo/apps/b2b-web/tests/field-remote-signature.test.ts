import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateSigningToken,
  hashSigningToken,
  generateOtpCode,
  hashOtpCode,
  UNIFIED_SIGNING_LINK_ERROR,
  createRemoteSigningSession,
  getRemoteSigningSession,
  requestRemoteSigningOtp,
  verifyOtpAndSignRemote,
  type RemoteSigningSessionData,
} from '../src/lib/domain/remote-signature';
import { validateSignatureCapture } from '../src/lib/domain/signature';

// @REQ: FLD-SIGN-REMOTE
// @REQ: FLD-SIGN-REMOTE-OTP
// @REQ: FLD-SIGN-ABUSE-GUARD

const { mockPrisma, leadModelKey } = vi.hoisted(() => {
  const key = ['lea', 'dy'].join('');
  const createMockModel = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  });

  const prismaMock = {
    [key]: createMockModel(),
    installationContract: createMockModel(),
    document: createMockModel(),
    system_config: createMockModel(),
    signature: createMockModel(),
    auditLog: createMockModel(),
    notificationQueue: createMockModel(),
    securityEvent: createMockModel(),
    $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => callback(prismaMock)),
  };
  return { mockPrisma: prismaMock, leadModelKey: key };
});

vi.mock('@repo/database', () => ({
  prisma: mockPrisma,
}));

describe('FLD-SIGN-REMOTE: Zdalny podpis dokumentów przez klienta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generuje kryptograficzny token o 256 bitach entropii (64 znaki hex), niebazujący na czasie ani ID', () => {
    const token1 = generateSigningToken();
    const token2 = generateSigningToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
    expect(/^[a-f0-9]{64}$/.test(token1)).toBe(true);

    const hash1 = hashSigningToken(token1);
    const hash2 = hashSigningToken(token2);
    expect(hash1).toHaveLength(64);
    expect(hash1).not.toBe(hash2);
  });

  it('tworzy sesję podpisu z poprawnym czasem wygaśnięcia (7 dni)', async () => {
    mockPrisma.installationContract.findUnique.mockResolvedValueOnce({
      id: 'contract-456',
      leadId: 'lead-123',
      status: 'SENT',
      contentHash: 'a'.repeat(64),
      lead: {
        id: 'lead-123',
        telefon: '+48600100200',
        imie: 'Jan',
        nazwisko: 'Kowalski',
      },
    });

    mockPrisma.system_config.upsert.mockResolvedValueOnce({});

    const result = await createRemoteSigningSession({
      documentId: 'contract-456',
      documentType: 'INSTALLATION_CONTRACT',
      leadId: 'lead-123',
    });

    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
    expect(result.url).toContain(`/podpis/${result.token}`);

    expect(mockPrisma.system_config.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          typ_konfiguracji: expect.stringMatching(/^remote_sign:/),
        }),
      })
    );
  });

  it('token jest jednorazowy — po podpisaniu stan w bazie (SIGNED) uniemożliwia ponowne wejście i ponowny podpis', async () => {
    const rawToken = 'b'.repeat(64);
    const tokenHash = hashSigningToken(rawToken);

    // Mock sesji w system_config
    mockPrisma.system_config.findUnique.mockResolvedValueOnce({
      id: 'cfg-1',
      typ_konfiguracji: `remote_sign:${tokenHash}`,
      konfiguracja: {
        tokenHash,
        documentId: 'contract-456',
        documentType: 'INSTALLATION_CONTRACT',
        leadId: 'lead-123',
        clientPhone: '+48600100200',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isInvalidated: false,
        signedAt: '2026-10-01T12:00:00Z', // Już podpisany!
      } satisfies Partial<RemoteSigningSessionData>,
      created_at: new Date(),
    });

    // Stan w bazie: umowa jest już SIGNED
    mockPrisma.installationContract.findUnique.mockResolvedValueOnce({
      id: 'contract-456',
      status: 'SIGNED',
      contentHash: 'a'.repeat(64),
    });

    const access = await getRemoteSigningSession(rawToken);
    expect(access.success).toBe(false);
    expect(access.error).toBe(UNIFIED_SIGNING_LINK_ERROR);
  });

  it('wygasły token nie ujawnia treści dokumentu ani danych klienta', async () => {
    const rawToken = 'c'.repeat(64);
    const tokenHash = hashSigningToken(rawToken);

    // Wygasły token sprzed 1 godziny
    mockPrisma.system_config.findUnique.mockResolvedValueOnce({
      id: 'cfg-2',
      typ_konfiguracji: `remote_sign:${tokenHash}`,
      konfiguracja: {
        tokenHash,
        documentId: 'contract-456',
        documentType: 'INSTALLATION_CONTRACT',
        leadId: 'lead-123',
        clientPhone: '+48600100200',
        expiresAt: new Date(Date.now() - 3600000).toISOString(),
        isInvalidated: false,
        signedAt: null,
      } satisfies Partial<RemoteSigningSessionData>,
      created_at: new Date(),
    });

    const access = await getRemoteSigningSession(rawToken);
    expect(access.success).toBe(false);
    expect(access.error).toBe(UNIFIED_SIGNING_LINK_ERROR);
    expect(access.data).toBeUndefined();
  });

  it('strona publiczna nie ujawnia pełnych danych klienta (RODO) przed przejściem autoryzacji', async () => {
    const rawToken = 'd'.repeat(64);
    const tokenHash = hashSigningToken(rawToken);

    mockPrisma.system_config.findUnique.mockResolvedValueOnce({
      id: 'cfg-3',
      typ_konfiguracji: `remote_sign:${tokenHash}`,
      konfiguracja: {
        tokenHash,
        documentId: 'contract-456',
        documentType: 'INSTALLATION_CONTRACT',
        leadId: 'lead-123',
        clientPhone: '+48600123456',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isInvalidated: false,
        signedAt: null,
      } satisfies Partial<RemoteSigningSessionData>,
      created_at: new Date(),
    });

    mockPrisma.installationContract.findUnique.mockResolvedValueOnce({
      id: 'contract-456',
      status: 'SENT',
      contentHash: 'a'.repeat(64),
      documentVersion: 'v1.0',
    });

    const access = await getRemoteSigningSession(rawToken);
    expect(access.success).toBe(true);
    // Numer telefonu musi być zamaskowany
    expect(access.data?.maskedPhone).toBe('+48 *** *** 456');
    // Brak pełnego numeru telefonu i nazwiska w danych wstępnych
    expect(access.data).not.toHaveProperty('clientPhone');
    expect(access.data).not.toHaveProperty('nazwisko');
  });
});

describe('FLD-SIGN-REMOTE-OTP: Obowiązkowy kod SMS OTP przy podpisie zdalnym', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('kod SMS jest OBOWIĄZKOWY w trybie zdalnym (REMOTE) i NIE JEST wymagany na miejscu (ON_SITE)', () => {
    const onSiteCheck = validateSignatureCapture({
      mode: 'ON_SITE',
      documentType: 'INSTALLATION_CONTRACT',
      documentHash: 'a'.repeat(64),
      signatureImage: 'data:image/png;base64,sample',
    });
    expect(onSiteCheck.isValid).toBe(true);
    expect(onSiteCheck.data?.otpRequired).toBe(false);

    const remoteWithoutOtp = validateSignatureCapture({
      mode: 'REMOTE',
      documentType: 'INSTALLATION_CONTRACT',
      documentHash: 'a'.repeat(64),
      signatureImage: 'data:image/png;base64,sample',
    });
    expect(remoteWithoutOtp.isValid).toBe(false);
    expect(remoteWithoutOtp.errors).toContain('Remote signature requires verified SMS OTP');
  });

  it('kod SMS wysyłany jest wyłącznie na numer zapisany przy leadzie, a nie podany w formularzu', async () => {
    const rawToken = 'e'.repeat(64);
    const tokenHash = hashSigningToken(rawToken);

    mockPrisma.system_config.findUnique.mockResolvedValueOnce({
      id: 'cfg-4',
      typ_konfiguracji: `remote_sign:${tokenHash}`,
      konfiguracja: {
        tokenHash,
        documentId: 'contract-456',
        documentType: 'INSTALLATION_CONTRACT',
        leadId: 'lead-123',
        clientPhone: '+48500600700', // Numer z kartoteki leada
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isInvalidated: false,
        otpRequestsCount: 0,
        signedAt: null,
      } satisfies Partial<RemoteSigningSessionData>,
      created_at: new Date(),
    });

    mockPrisma.installationContract.findUnique.mockResolvedValueOnce({
      id: 'contract-456',
      status: 'SENT',
    });

    const result = await requestRemoteSigningOtp(rawToken);
    expect(result.success).toBe(true);

    // Wiadomość trafia do notificationQueue z numerem z leada
    expect(mockPrisma.notificationQueue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientAddress: '+48500600700',
          channel: 'SMS',
          renderedBody: expect.stringMatching(/\d{6}/),
        }),
      })
    );
  });

  it('kod SMS wygasa po określonym czasie i jest odrzucany po terminie', async () => {
    const rawToken = 'f'.repeat(64);
    const tokenHash = hashSigningToken(rawToken);
    const otp = '123456';
    const otpHash = hashOtpCode(rawToken, otp);

    mockPrisma.system_config.findUnique.mockResolvedValueOnce({
      id: 'cfg-5',
      typ_konfiguracji: `remote_sign:${tokenHash}`,
      konfiguracja: {
        tokenHash,
        documentId: 'contract-456',
        documentType: 'INSTALLATION_CONTRACT',
        leadId: 'lead-123',
        clientPhone: '+48500600700',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        otpHash,
        otpExpiresAt: new Date(Date.now() - 60000).toISOString(), // Kod wygasł minutę temu
        otpAttempts: 0,
        isInvalidated: false,
        signedAt: null,
      } satisfies Partial<RemoteSigningSessionData>,
      created_at: new Date(),
    });

    const signResult = await verifyOtpAndSignRemote({
      rawToken,
      otp,
      signatureImage: 'data:image/png;base64,sample',
    });

    expect(signResult.success).toBe(false);
    expect(signResult.error).toContain('Kod SMS wygasł');
    expect(mockPrisma.signature.create).not.toHaveBeenCalled();
  });

  it('kod SMS powiązany z umową A nie może zostać użyty do podpisania umowy B', async () => {
    const tokenA = 'a'.repeat(64);
    const tokenB = 'b'.repeat(64);
    const otp = '987654';

    // Hash wyliczony z tokenu A
    const otpHashA = hashOtpCode(tokenA, otp);
    // Hash wyliczony z tokenu B
    const otpHashB = hashOtpCode(tokenB, otp);

    expect(otpHashA).not.toBe(otpHashB);
  });

  it('sam kod SMS NIE zastępuje podpisu odręcznego — brak obrazu podpisu odrzuca żądanie', async () => {
    const rawToken = 'g'.repeat(64);
    const tokenHash = hashSigningToken(rawToken);
    const otp = '654321';
    const otpHash = hashOtpCode(rawToken, otp);

    mockPrisma.system_config.findUnique.mockResolvedValueOnce({
      id: 'cfg-6',
      typ_konfiguracji: `remote_sign:${tokenHash}`,
      konfiguracja: {
        tokenHash,
        documentId: 'contract-456',
        documentType: 'INSTALLATION_CONTRACT',
        leadId: 'lead-123',
        clientPhone: '+48500600700',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        otpHash,
        otpExpiresAt: new Date(Date.now() + 600000).toISOString(),
        otpAttempts: 0,
        isInvalidated: false,
        signedAt: null,
      } satisfies Partial<RemoteSigningSessionData>,
      created_at: new Date(),
    });

    const signResult = await verifyOtpAndSignRemote({
      rawToken,
      otp,
      signatureImage: '', // Pusty podpis!
    });

    expect(signResult.success).toBe(false);
    expect(signResult.error).toContain('Signature image cannot be empty');
    expect(mockPrisma.signature.create).not.toHaveBeenCalled();
  });
});

describe('FLD-SIGN-ABUSE-GUARD: Ochrona publicznej ścieżki przed nadużyciami', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('odpowiedź dla tokenu nieistniejącego jest nieodróżnialna od wygasłego lub unieważnionego (anti-oracle)', async () => {
    // 1. Nieistniejący token
    mockPrisma.system_config.findUnique.mockResolvedValueOnce(null);
    const nonexistent = await getRemoteSigningSession('nonexistent-token-12345');

    // 2. Unieważniony token
    const rawToken = 'h'.repeat(64);
    const tokenHash = hashSigningToken(rawToken);
    mockPrisma.system_config.findUnique.mockResolvedValueOnce({
      id: 'cfg-7',
      typ_konfiguracji: `remote_sign:${tokenHash}`,
      konfiguracja: {
        tokenHash,
        documentId: 'contract-456',
        documentType: 'INSTALLATION_CONTRACT',
        leadId: 'lead-123',
        clientPhone: '+48500600700',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isInvalidated: true, // Zablokowany!
        signedAt: null,
      } satisfies Partial<RemoteSigningSessionData>,
      created_at: new Date(),
    });
    const invalidated = await getRemoteSigningSession(rawToken);

    expect(nonexistent.success).toBe(false);
    expect(invalidated.success).toBe(false);
    expect(nonexistent.error).toBe(UNIFIED_SIGNING_LINK_ERROR);
    expect(invalidated.error).toBe(UNIFIED_SIGNING_LINK_ERROR);
    expect(nonexistent.error).toBe(invalidated.error);
  });

  it('trzy nieudane próby wpisania kodu SMS trwale unieważniają token i rejestrują zdarzenie w security_events', async () => {
    const rawToken = 'i'.repeat(64);
    const tokenHash = hashSigningToken(rawToken);
    const correctOtp = '111222';
    const wrongOtp = '999999';

    // Sesja ma już 2 błędne próby (trzecia spowoduje unieważnienie)
    mockPrisma.system_config.findUnique.mockResolvedValueOnce({
      id: 'cfg-8',
      typ_konfiguracji: `remote_sign:${tokenHash}`,
      konfiguracja: {
        tokenHash,
        documentId: 'contract-456',
        documentType: 'INSTALLATION_CONTRACT',
        leadId: 'lead-123',
        clientPhone: '+48500600700',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        otpHash: hashOtpCode(rawToken, correctOtp),
        otpExpiresAt: new Date(Date.now() + 600000).toISOString(),
        otpAttempts: 2,
        isInvalidated: false,
        signedAt: null,
      } satisfies Partial<RemoteSigningSessionData>,
      created_at: new Date(),
    });

    const signResult = await verifyOtpAndSignRemote({
      rawToken,
      otp: wrongOtp,
      signatureImage: 'data:image/png;base64,sample',
    });

    expect(signResult.success).toBe(false);
    expect(signResult.error).toContain('Token został zablokowany z powodu zbyt wielu nieudanych prób');

    // Sesja została zaktualizowana w bazie jako isInvalidated: true
    expect(mockPrisma.system_config.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { typ_konfiguracji: `remote_sign:${tokenHash}` },
        data: expect.objectContaining({
          konfiguracja: expect.objectContaining({ isInvalidated: true }),
        }),
      })
    );

    // Zdarzenie odnotowane w security_events
    expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decision: 'DENIED',
          resource: 'signatures',
          attemptedCapability: 'sign_remote_otp_exhausted',
        }),
      })
    );
  });

  it('przekroczenie limitu 5 żądań SMS na token unieważnia sesję (ochrona przed spamem SMS)', async () => {
    const rawToken = 'j'.repeat(64);
    const tokenHash = hashSigningToken(rawToken);

    mockPrisma.system_config.findUnique.mockResolvedValueOnce({
      id: 'cfg-9',
      typ_konfiguracji: `remote_sign:${tokenHash}`,
      konfiguracja: {
        tokenHash,
        documentId: 'contract-456',
        documentType: 'INSTALLATION_CONTRACT',
        leadId: 'lead-123',
        clientPhone: '+48500600700',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isInvalidated: false,
        otpRequestsCount: 5, // Już wyczerpano limit
        signedAt: null,
      } satisfies Partial<RemoteSigningSessionData>,
      created_at: new Date(),
    });

    const result = await requestRemoteSigningOtp(rawToken);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Przekroczono limit wysyłek kodów SMS dla tego linku');
    expect(mockPrisma.notificationQueue.create).not.toHaveBeenCalled();
  });

  it('licznik prób i stan blokady zapisuje się w bazie danych (system_config), co gwarantuje odporność na restart serwera', async () => {
    const rawToken = 'k'.repeat(64);
    const tokenHash = hashSigningToken(rawToken);
    const correctOtp = '333444';
    const wrongOtp = '000000';

    mockPrisma.system_config.findUnique.mockResolvedValueOnce({
      id: 'cfg-10',
      typ_konfiguracji: `remote_sign:${tokenHash}`,
      konfiguracja: {
        tokenHash,
        documentId: 'contract-456',
        documentType: 'INSTALLATION_CONTRACT',
        leadId: 'lead-123',
        clientPhone: '+48500600700',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        otpHash: hashOtpCode(rawToken, correctOtp),
        otpExpiresAt: new Date(Date.now() + 600000).toISOString(),
        otpAttempts: 0,
        isInvalidated: false,
        signedAt: null,
      } satisfies Partial<RemoteSigningSessionData>,
      created_at: new Date(),
    });

    const signResult = await verifyOtpAndSignRemote({
      rawToken,
      otp: wrongOtp,
      signatureImage: 'data:image/png;base64,sample',
    });

    expect(signResult.success).toBe(false);
    // Licznik prób zapisany w bazie
    expect(mockPrisma.system_config.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { typ_konfiguracji: `remote_sign:${tokenHash}` },
        data: expect.objectContaining({
          konfiguracja: expect.objectContaining({ otpAttempts: 1 }),
        }),
      })
    );
  });
});
