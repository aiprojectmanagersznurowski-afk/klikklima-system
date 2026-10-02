import { prisma } from '@repo/database';
import {
  generateSigningToken,
  hashSigningToken,
  generateOtpCode,
  hashOtpCode,
  maskPhoneNumber,
  UNIFIED_SIGNING_LINK_ERROR,
  REMOTE_SIGN_TOKEN_TTL_MS,
  REMOTE_SIGN_OTP_TTL_MS,
  REMOTE_SIGN_MAX_OTP_ATTEMPTS,
  REMOTE_SIGN_MAX_OTP_REQUESTS,
  validateSignatureCapture,
  requestTsaTimestamp,
  type DocumentType,
  type TsaProvider,
  type CaptureMetadata,
} from '../../../../../packages/signature/src';

// Re-eksportujemy funkcje regułowe i stałe
export {
  generateSigningToken,
  hashSigningToken,
  generateOtpCode,
  hashOtpCode,
  maskPhoneNumber,
  UNIFIED_SIGNING_LINK_ERROR,
  REMOTE_SIGN_TOKEN_TTL_MS,
  REMOTE_SIGN_OTP_TTL_MS,
  REMOTE_SIGN_MAX_OTP_ATTEMPTS,
  REMOTE_SIGN_MAX_OTP_REQUESTS,
};

// @REQ: FLD-SIGN-REMOTE
// @REQ: FLD-SIGN-REMOTE-OTP
// @REQ: FLD-SIGN-ABUSE-GUARD

export interface RemoteSigningSessionData {
  tokenHash: string;
  documentId: string;
  documentType: DocumentType;
  leadId: string;
  clientPhone: string;
  createdAt: string;
  expiresAt: string;
  otpHash?: string | null;
  otpExpiresAt?: string | null;
  otpAttempts: number;
  otpRequestsCount: number;
  isInvalidated: boolean;
  invalidatedReason?: string | null;
  signedAt?: string | null;
}

export interface CreateRemoteSigningSessionInput {
  documentId: string;
  documentType: DocumentType;
  leadId: string;
  clientPhone?: string;
  appUrl?: string;
}

export interface CreateRemoteSigningSessionResult {
  success: boolean;
  token?: string;
  url?: string;
  error?: string;
}

export interface GetRemoteSigningSessionResult {
  success: boolean;
  error?: string;
  data?: {
    documentId: string;
    documentType: DocumentType;
    documentVersion?: string;
    contentHash?: string;
    maskedPhone: string;
    expiresAt: string;
  };
}

export interface RequestRemoteSigningOtpResult {
  success: boolean;
  error?: string;
}

export interface VerifyOtpAndSignRemoteInput {
  rawToken: string;
  otp: string;
  signatureImage: string;
  captureMetadata?: CaptureMetadata;
  tsaProvider?: TsaProvider;
}

export interface VerifyOtpAndSignRemoteResult {
  success: boolean;
  error?: string;
  signature?: {
    id: string;
    documentType: string;
    documentId: string;
    documentHash: string;
    mode: string;
    signedAt: string;
    tsaStatus: 'APPLIED' | 'PENDING';
    tsaTimestampAt: string | null;
  };
}

/**
 * Tworzy bezpieczną sesję zdalnego podpisu dla klienta (FLD-SIGN-REMOTE).
 */
export async function createRemoteSigningSession(
  input: CreateRemoteSigningSessionInput
): Promise<CreateRemoteSigningSessionResult> {
  const { documentId, documentType, leadId, appUrl = 'https://klikklima.pl' } = input;

  let clientPhone = input.clientPhone?.trim();

  // 1. Weryfikacja dokumentu i telefonu klienta z relacji
  if (documentType === 'INSTALLATION_CONTRACT') {
    const contract = await prisma.installationContract.findUnique({
      where: { id: documentId },
      include: {
        lead: {
          include: {
            klient: true,
          },
        },
      },
    });
    if (!contract) {
      return { success: false, error: 'Nie odnaleziono umowy montażu' };
    }
    if (contract.status === 'SIGNED') {
      return { success: false, error: 'Umowa została już wcześniej podpisana' };
    }
    const leadObj = contract.lead as { telefon?: string | null; klient?: { telefon?: string | null } | null } | null | undefined;
    const phone = leadObj?.klient?.telefon ?? leadObj?.telefon;
    if (!clientPhone && phone) {
      clientPhone = phone.trim();
    }
  }

  if (!clientPhone) {
    return {
      success: false,
      error: 'Nie odnaleziono rekordu klienta lub brak zdefiniowanego numeru telefonu',
    };
  }

  // 3. Generowanie tokenu o wysokiej entropii (FLD-SIGN-REMOTE)
  const token = generateSigningToken();
  const tokenHash = hashSigningToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REMOTE_SIGN_TOKEN_TTL_MS);

  const sessionData: RemoteSigningSessionData = {
    tokenHash,
    documentId,
    documentType,
    leadId,
    clientPhone,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    otpHash: null,
    otpExpiresAt: null,
    otpAttempts: 0,
    otpRequestsCount: 0,
    isInvalidated: false,
    invalidatedReason: null,
    signedAt: null,
  };

  // 4. Trwały zapis w bazie danych (system_config)
  await prisma.system_config.upsert({
    where: { typ_konfiguracji: `remote_sign:${tokenHash}` },
    create: {
      typ_konfiguracji: `remote_sign:${tokenHash}`,
      konfiguracja: JSON.parse(JSON.stringify(sessionData)),
    },
    update: {
      konfiguracja: JSON.parse(JSON.stringify(sessionData)),
    },
  });

  return {
    success: true,
    token,
    url: `${appUrl}/podpis/${token}`,
  };
}

/**
 * Pobiera dane sesji zdalnego podpisu chroniąc przed ujawnieniem danych i enumeracją (FLD-SIGN-ABUSE-GUARD).
 */
export async function getRemoteSigningSession(rawToken: string): Promise<GetRemoteSigningSessionResult> {
  const tokenHash = hashSigningToken(rawToken);

  const record = await prisma.system_config.findUnique({
    where: { typ_konfiguracji: `remote_sign:${tokenHash}` },
  });

  if (!record) {
    return { success: false, error: UNIFIED_SIGNING_LINK_ERROR };
  }

  let session: RemoteSigningSessionData;
  try {
    session = (typeof record.konfiguracja === 'string'
      ? JSON.parse(record.konfiguracja)
      : record.konfiguracja) as RemoteSigningSessionData;
  } catch {
    return { success: false, error: UNIFIED_SIGNING_LINK_ERROR };
  }

  // Sprawdzenie stanu unieważnienia i wygaśnięcia
  const now = new Date();
  const expiresAt = new Date(session.expiresAt);

  if (session.isInvalidated || now.getTime() > expiresAt.getTime()) {
    return { success: false, error: UNIFIED_SIGNING_LINK_ERROR };
  }

  // Weryfikacja stanu dokumentu w bazie
  let documentVersion: string | undefined;
  let contentHash: string | undefined;

  if (session.documentType === 'INSTALLATION_CONTRACT') {
    const contract = await prisma.installationContract.findUnique({
      where: { id: session.documentId },
    });
    if (!contract || contract.status === 'SIGNED' || session.signedAt) {
      return { success: false, error: UNIFIED_SIGNING_LINK_ERROR };
    }
    documentVersion = contract.documentVersion;
    contentHash = contract.contentHash ?? undefined;
  } else if (session.signedAt) {
    return { success: false, error: UNIFIED_SIGNING_LINK_ERROR };
  }

  return {
    success: true,
    data: {
      documentId: session.documentId,
      documentType: session.documentType,
      documentVersion,
      contentHash,
      maskedPhone: maskPhoneNumber(session.clientPhone),
      expiresAt: session.expiresAt,
    },
  };
}

/**
 * Wysyła kod SMS OTP na telefon klienta powiązany z sesją (FLD-SIGN-REMOTE-OTP, FLD-SIGN-ABUSE-GUARD).
 */
export async function requestRemoteSigningOtp(rawToken: string): Promise<RequestRemoteSigningOtpResult> {
  const tokenHash = hashSigningToken(rawToken);

  const record = await prisma.system_config.findUnique({
    where: { typ_konfiguracji: `remote_sign:${tokenHash}` },
  });

  if (!record) {
    return { success: false, error: UNIFIED_SIGNING_LINK_ERROR };
  }

  let session: RemoteSigningSessionData;
  try {
    session = (typeof record.konfiguracja === 'string'
      ? JSON.parse(record.konfiguracja)
      : record.konfiguracja) as RemoteSigningSessionData;
  } catch {
    return { success: false, error: UNIFIED_SIGNING_LINK_ERROR };
  }
  const now = new Date();
  const expiresAt = new Date(session.expiresAt);

  if (session.isInvalidated || session.signedAt || now.getTime() > expiresAt.getTime()) {
    return { success: false, error: UNIFIED_SIGNING_LINK_ERROR };
  }

  // Ochrona przed spamem SMS (FLD-SIGN-ABUSE-GUARD)
  if (session.otpRequestsCount >= REMOTE_SIGN_MAX_OTP_REQUESTS) {
    return {
      success: false,
      error: 'Przekroczono limit wysyłek kodów SMS dla tego linku. Skontaktuj się z biurem obsługi.',
    };
  }

  // Generowanie nowego kodu OTP
  const otpCode = generateOtpCode();
  const otpHash = hashOtpCode(rawToken, otpCode);
  const otpExpiresAt = new Date(now.getTime() + REMOTE_SIGN_OTP_TTL_MS);

  session.otpHash = otpHash;
  session.otpExpiresAt = otpExpiresAt.toISOString();
  session.otpRequestsCount += 1;

  // Trwały zapis w system_config
  await prisma.system_config.update({
    where: { typ_konfiguracji: `remote_sign:${tokenHash}` },
    data: { konfiguracja: JSON.parse(JSON.stringify(session)) },
  });

  // Kolejkowanie wiadomości SMS
  await prisma.notificationQueue.create({
    data: {
      notificationId: 'N_SIGN_REMOTE_OTP',
      templateKey: 'funnel.remote_signing_otp',
      channel: 'SMS',
      recipientType: 'CLIENT',
      recipientAddress: session.clientPhone,
      renderedBody: `Twój kod autoryzacyjny do zdalnego podpisu dokumentu KlikKlima: ${otpCode}. Kod jest ważny przez 15 minut.`,
      payload: { otpCode, tokenHash },
      idempotencyKey: `otp:${tokenHash}:${session.otpRequestsCount}`,
      status: 'PENDING',
    },
  });

  return { success: true };
}

/**
 * Weryfikuje kod SMS OTP i składa zdalny podpis klienta (FLD-SIGN-REMOTE-OTP, FLD-SIGN-ABUSE-GUARD, FLD-SIGN-DOC-FREEZE).
 */
export async function verifyOtpAndSignRemote(
  input: VerifyOtpAndSignRemoteInput
): Promise<VerifyOtpAndSignRemoteResult> {
  const { rawToken, otp, signatureImage, captureMetadata, tsaProvider } = input;
  const tokenHash = hashSigningToken(rawToken);

  const record = await prisma.system_config.findUnique({
    where: { typ_konfiguracji: `remote_sign:${tokenHash}` },
  });

  if (!record) {
    return { success: false, error: UNIFIED_SIGNING_LINK_ERROR };
  }

  let session: RemoteSigningSessionData;
  try {
    session = (typeof record.konfiguracja === 'string'
      ? JSON.parse(record.konfiguracja)
      : record.konfiguracja) as RemoteSigningSessionData;
  } catch {
    return { success: false, error: UNIFIED_SIGNING_LINK_ERROR };
  }

  const now = new Date();
  const expiresAt = new Date(session.expiresAt);

  if (session.isInvalidated || session.signedAt || now.getTime() > expiresAt.getTime()) {
    return { success: false, error: UNIFIED_SIGNING_LINK_ERROR };
  }

  // Weryfikacja wygaśnięcia kodu SMS
  if (!session.otpHash || !session.otpExpiresAt || now.getTime() > new Date(session.otpExpiresAt).getTime()) {
    return { success: false, error: 'Kod SMS wygasł. Pobierz nowy kod.' };
  }

  // Weryfikacja kodu OTP
  const expectedOtpHash = session.otpHash;
  const providedOtpHash = hashOtpCode(rawToken, otp);

  if (providedOtpHash !== expectedOtpHash) {
    session.otpAttempts += 1;

    // Przekroczenie limitu prób unieważnia token (FLD-SIGN-ABUSE-GUARD)
    if (session.otpAttempts >= REMOTE_SIGN_MAX_OTP_ATTEMPTS) {
      session.isInvalidated = true;
      session.invalidatedReason = 'EXCEEDED_OTP_ATTEMPTS';

      await prisma.system_config.update({
        where: { typ_konfiguracji: `remote_sign:${tokenHash}` },
        data: { konfiguracja: JSON.parse(JSON.stringify(session)) },
      });

      // Zdarzenie bezpieczeństwa (SEC-ACCESS-DENIED-LOG)
      await prisma.securityEvent.create({
        data: {
          actorEmail: session.clientPhone,
          actorRole: 'klient',
          resource: 'signatures',
          attemptedCapability: 'sign_remote_otp_exhausted',
          decision: 'DENIED',
          endpoint: '/api/public/signature/remote',
        },
      });

      return {
        success: false,
        error: 'Token został zablokowany z powodu zbyt wielu nieudanych prób wprowadzenia kodu SMS.',
      };
    }

    await prisma.system_config.update({
      where: { typ_konfiguracji: `remote_sign:${tokenHash}` },
      data: { konfiguracja: JSON.parse(JSON.stringify(session)) },
    });

    return {
      success: false,
      error: `Nieprawidłowy kod SMS. Pozostało prób: ${REMOTE_SIGN_MAX_OTP_ATTEMPTS - session.otpAttempts}.`,
    };
  }

  // Walidacja odręcznego podpisu (FLD-SIGN-CAPTURE, FLD-SIGN-REMOTE-OTP: sam kod SMS nie zastępuje podpisu)
  if (!signatureImage || !signatureImage.trim()) {
    return {
      success: false,
      error: 'Signature image cannot be empty',
    };
  }

  // Kod poprawny — pobieramy dokument i sprawdzamy skrót (FLD-SIGN-DOC-FREEZE)
  let documentHash = '';
  if (session.documentType === 'INSTALLATION_CONTRACT') {
    const contract = await prisma.installationContract.findUnique({
      where: { id: session.documentId },
    });
    if (!contract || contract.status === 'SIGNED' || !contract.contentHash) {
      return { success: false, error: UNIFIED_SIGNING_LINK_ERROR };
    }
    documentHash = contract.contentHash;
  }

  // Walidacja podpisu z flagą REMOTE i zweryfikowanym OTP (FLD-SIGN-CAPTURE)
  const validation = validateSignatureCapture({
    mode: 'REMOTE',
    documentType: session.documentType,
    documentHash,
    signatureImage,
    otpPhone: session.clientPhone,
    otpVerifiedAt: now,
    captureMetadata,
  });

  if (!validation.isValid) {
    return {
      success: false,
      error: validation.errors.join(', '),
    };
  }

  // Kwalifikowany znacznik czasu TSA (FLD-SIGN-TSA)
  const tsaResult = await requestTsaTimestamp(documentHash, tsaProvider);

  // Transakcyjny zapis podpisu i zmiana stanu dokumentu
  const savedSignature = await prisma.$transaction(async (tx) => {
    // 1. Zapis podpisu w signatures
    const sig = await tx.signature.create({
      data: {
        documentType: session.documentType,
        documentId: session.documentId,
        mode: 'REMOTE',
        documentHash,
        signatureImagePath: signatureImage.trim(),
        captureMetadata: captureMetadata ? JSON.parse(JSON.stringify(captureMetadata)) : undefined,
        otpPhone: session.clientPhone,
        otpVerifiedAt: now,
        tsaTimestampAt: tsaResult.timestampAt,
        tsaToken: tsaResult.token,
      },
    });

    // 2. Aktualizacja statusu umowy
    if (session.documentType === 'INSTALLATION_CONTRACT') {
      await tx.installationContract.update({
        where: { id: session.documentId },
        data: {
          status: 'SIGNED',
          signedAt: now,
        },
      });
    }

    // 3. Wpis do audit_log
    await tx.auditLog.create({
      data: {
        actorEmail: session.clientPhone,
        actorRole: 'klient',
        operation: 'field_update',
        resource: 'signatures',
        recordId: sig.id,
        justification: 'Zdalny podpis klienta autoryzowany kodem SMS OTP (FLD-SIGN-REMOTE)',
        legalBasis: 'CONTRACT_PERFORMANCE',
      },
    });

    // 4. Zużycie sesji w system_config
    session.signedAt = now.toISOString();
    session.isInvalidated = true;
    await tx.system_config.update({
      where: { typ_konfiguracji: `remote_sign:${tokenHash}` },
      data: { konfiguracja: JSON.parse(JSON.stringify(session)) },
    });

    return sig;
  });

  return {
    success: true,
    signature: {
      id: savedSignature.id,
      documentType: savedSignature.documentType,
      documentId: savedSignature.documentId,
      documentHash: savedSignature.documentHash,
      mode: savedSignature.mode,
      signedAt: savedSignature.signedAt.toISOString(),
      tsaStatus: tsaResult.success ? 'APPLIED' : 'PENDING',
      tsaTimestampAt: savedSignature.tsaTimestampAt ? savedSignature.tsaTimestampAt.toISOString() : null,
    },
  };
}
