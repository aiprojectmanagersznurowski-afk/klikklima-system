import { createHash, timingSafeEqual } from "node:crypto"

// @REQ: FLD-SIGN-DOC-FREEZE

export function computeDocumentHash(content: Buffer | string): string {
  if (!content || (Buffer.isBuffer(content) ? content.length === 0 : content.trim().length === 0)) {
    throw new Error("Document content cannot be empty")
  }

  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf-8")
  return createHash("sha256").update(buf).digest("hex")
}

export function verifyDocumentHash(actualContent: Buffer | string, expectedHash: string): boolean {
  if (!expectedHash || typeof expectedHash !== "string" || expectedHash.length !== 64) {
    return false
  }

  try {
    const computed = computeDocumentHash(actualContent)
    const bufComputed = Buffer.from(computed, "hex")
    const bufExpected = Buffer.from(expectedHash, "hex")

    if (bufComputed.length !== bufExpected.length) {
      return false
    }

    return timingSafeEqual(bufComputed, bufExpected)
  } catch {
    return false
  }
}

export function isTemplateVersionDraft(templateVersion: string): boolean {
  return templateVersion.includes("-lorem")
}
