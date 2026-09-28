import { timingSafeEqual } from "node:crypto"

/**
 * Constant-time string comparison to prevent timing attacks.
 * Requirement: SEC-WEBHOOK-SECRET-REQUIRED (AC4).
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false
  }

  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)

  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA)
    return false
  }

  return timingSafeEqual(bufA, bufB)
}

/**
 * Fail-closed verification of a webhook secret header against the configured environment secret.
 * If expectedSecret is unset, undefined, or empty, access is ALWAYS denied.
 * Requirement: SEC-WEBHOOK-SECRET-REQUIRED (AC1, AC2, AC3, AC4).
 */
export function verifyWebhookSecret(
  received: string | null | undefined,
  expectedSecret: string | undefined
): boolean {
  if (
    !expectedSecret ||
    typeof expectedSecret !== "string" ||
    expectedSecret.trim().length === 0
  ) {
    return false
  }

  if (
    !received ||
    typeof received !== "string" ||
    received.trim().length === 0
  ) {
    return false
  }

  return timingSafeEqualString(received.trim(), expectedSecret.trim())
}

/**
 * Fail-closed verification of an Authorization Bearer token header against expected secret.
 * Requirement: SEC-WEBHOOK-SECRET-REQUIRED (AC1, AC2, AC3, AC4).
 */
export function verifyBearerToken(
  authHeader: string | null | undefined,
  expectedSecret: string | undefined
): boolean {
  if (
    !expectedSecret ||
    typeof expectedSecret !== "string" ||
    expectedSecret.trim().length === 0
  ) {
    return false
  }

  if (!authHeader || typeof authHeader !== "string") {
    return false
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match || !match[1]) {
    return false
  }

  return timingSafeEqualString(match[1].trim(), expectedSecret.trim())
}
