// @REQ: FLD-SIGN-REMOTE
// @REQ: FLD-SIGN-REMOTE-OTP
// @REQ: FLD-SIGN-ABUSE-GUARD

import * as crypto from 'node:crypto';

export const UNIFIED_SIGNING_LINK_ERROR = 'Link do podpisu jest nieaktywny, wygasł lub został już wykorzystany.';

export const REMOTE_SIGN_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dni
export const REMOTE_SIGN_OTP_TTL_MS = 15 * 60 * 1000; // 15 minut
export const REMOTE_SIGN_MAX_OTP_ATTEMPTS = 3;
export const REMOTE_SIGN_MAX_OTP_REQUESTS = 5;

/**
 * Generuje kryptograficzny token podpisu zdalnego o wysokiej entropii (256 bitów = 64 znaki hex).
 * Nigdy nie bazuje na czasie ani identyfikatorze rekordu.
 */
export function generateSigningToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Zwraca skrót SHA-256 tokenu.
 * W bazie danych zapisujemy wyłącznie skrót tokenu, aby wyciek bazy nie umożliwiał fałszowania podpisu.
 */
export function hashSigningToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Generuje 6-cyfrowy kryptograficzny kod SMS OTP.
 */
export function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Wylicza HMAC-SHA256 z kodu OTP z użyciem surowego tokenu jako klucza.
 * Zapewnia to, że kod OTP jest związany z konkretnym tokenem i dokumentem.
 */
export function hashOtpCode(token: string, otp: string): string {
  return crypto.createHmac('sha256', token.trim()).update(otp.trim()).digest('hex');
}

/**
 * Maskuje numer telefonu klienta na potrzeby prezentacji przed przejściem autoryzacji (RODO).
 * np. "+48600123456" -> "+48 *** *** 456"
 */
export function maskPhoneNumber(phone: string): string {
  const cleaned = phone.trim();
  if (cleaned.length < 6) {
    return '***';
  }
  const last3 = cleaned.slice(-3);
  const prefix = cleaned.startsWith('+') ? cleaned.slice(0, 3) : '';
  return `${prefix} *** *** ${last3}`.trim();
}
