import { describe, it, expect, vi } from "vitest"
import {
  computeDocumentHash,
  verifyDocumentHash,
  validateSignatureCapture,
  buildSignatureCard,
  verifyAuditChain,
  requestTsaTimestamp,
  verifyTsaPair,
} from "../src/lib/domain/signature"

describe("FLD-SIGN-DOC-FREEZE: Document Hash & Freeze Rules", () => {
  it("generates deterministic SHA-256 hash for document content", () => {
    const content = Buffer.from("KlikKlima Handover Protocol v1.0 Technical Spec", "utf-8")
    const hash1 = computeDocumentHash(content)
    const hash2 = computeDocumentHash(content)

    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
    expect(/^[a-f0-9]{64}$/.test(hash1)).toBe(true)
  })

  it("verifies matching document hash and rejects altered document content", () => {
    const original = Buffer.from("Valid contract text", "utf-8")
    const tampered = Buffer.from("Tampered contract text", "utf-8")
    const originalHash = computeDocumentHash(original)

    expect(verifyDocumentHash(original, originalHash)).toBe(true)
    expect(verifyDocumentHash(tampered, originalHash)).toBe(false)
  })

  it("throws error when trying to compute hash of empty content", () => {
    expect(() => computeDocumentHash(Buffer.alloc(0))).toThrow(
      "Document content cannot be empty"
    )
  })
})

describe("FLD-SIGN-CAPTURE: On-site Signature Capture Rules", () => {
  it("accepts valid on-site signature without SMS OTP", () => {
    const result = validateSignatureCapture({
      mode: "ON_SITE",
      documentType: "HANDOVER_PROTOCOL",
      documentHash: "a".repeat(64),
      signatureImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      captureMetadata: {
        deviceModel: "Pixel 8",
        signedAtClient: "2026-09-26T10:00:00Z",
        clientIp: "192.168.1.1",
      },
    })

    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.data?.mode).toBe("ON_SITE")
    expect(result.data?.otpRequired).toBe(false)
  })

  it("rejects empty or whitespace signature data", () => {
    const emptyResult = validateSignatureCapture({
      mode: "ON_SITE",
      documentType: "HANDOVER_PROTOCOL",
      documentHash: "a".repeat(64),
      signatureImage: "",
    })

    expect(emptyResult.isValid).toBe(false)
    expect(emptyResult.errors).toContain("Signature image cannot be empty")

    const whitespaceResult = validateSignatureCapture({
      mode: "ON_SITE",
      documentType: "HANDOVER_PROTOCOL",
      documentHash: "a".repeat(64),
      signatureImage: "   ",
    })

    expect(whitespaceResult.isValid).toBe(false)
    expect(whitespaceResult.errors).toContain("Signature image cannot be empty")
  })

  it("rejects signature when mode is invalid", () => {
    const result = validateSignatureCapture({
      mode: "INVALID_MODE" as unknown as "ON_SITE",
      documentType: "HANDOVER_PROTOCOL",
      documentHash: "a".repeat(64),
      signatureImage: "data:image/png;base64,abc",
    })

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain("Invalid signature mode: must be ON_SITE or REMOTE")
  })

  it("requires SMS OTP when mode is REMOTE", () => {
    const remoteWithoutOtp = validateSignatureCapture({
      mode: "REMOTE",
      documentType: "HANDOVER_PROTOCOL",
      documentHash: "a".repeat(64),
      signatureImage: "data:image/png;base64,abc",
    })

    expect(remoteWithoutOtp.isValid).toBe(false)
    expect(remoteWithoutOtp.errors).toContain("Remote signature requires verified SMS OTP")

    const remoteWithOtp = validateSignatureCapture({
      mode: "REMOTE",
      documentType: "HANDOVER_PROTOCOL",
      documentHash: "a".repeat(64),
      signatureImage: "data:image/png;base64,abc",
      otpPhone: "+48600100200",
      otpVerifiedAt: new Date("2026-09-26T10:00:00Z"),
    })

    expect(remoteWithOtp.isValid).toBe(true)
    expect(remoteWithOtp.errors).toHaveLength(0)
  })
})

describe("FLD-SIGN-AUDIT-TRAIL: Signature Audit Trail & Chain Verification", () => {
  it("builds a signature card with required legal and cryptographic fields", () => {
    const card = buildSignatureCard({
      signatureId: "sig-12345",
      documentType: "HANDOVER_PROTOCOL",
      documentId: "doc-999",
      documentHash: "d".repeat(64),
      mode: "ON_SITE",
      signedAt: new Date("2026-09-26T10:00:00.000Z"),
      signerName: "Jan Kowalski",
      templateVersion: "v1.0",
    })

    expect(card.signatureId).toBe("sig-12345")
    expect(card.documentHash).toBe("d".repeat(64))
    expect(card.mode).toBe("ON_SITE")
    expect(card.signerName).toBe("Jan Kowalski")
    expect(card.templateVersion).toBe("v1.0")
    expect(card.cardHash).toHaveLength(64)
  })

  it("verifies hash chain integrity across sequential signature records", () => {
    const records = [
      { id: "1", documentHash: "hash1", prevRecordHash: null },
      { id: "2", documentHash: "hash2", prevRecordHash: "hash1" },
      { id: "3", documentHash: "hash3", prevRecordHash: "hash2" },
    ]

    expect(verifyAuditChain(records)).toBe(true)

    const brokenRecords = [
      { id: "1", documentHash: "hash1", prevRecordHash: null },
      { id: "2", documentHash: "hash2", prevRecordHash: "hash_broken" },
      { id: "3", documentHash: "hash3", prevRecordHash: "hash2" },
    ]

    expect(verifyAuditChain(brokenRecords)).toBe(false)
  })
})

describe("FLD-SIGN-TSA: EuroCert RFC 3161 Qualified Timestamp", () => {
  it("enforces TSA pair constraint (both non-null or both null)", () => {
    expect(verifyTsaPair(null, null)).toBe(true)
    expect(verifyTsaPair(new Date(), "valid-token-string")).toBe(true)
    expect(verifyTsaPair(new Date(), null)).toBe(false)
    expect(verifyTsaPair(null, "token-without-date")).toBe(false)
  })

  it("requests TSA timestamp from provider and handles offline fallback gracefully", async () => {
    const mockProvider = {
      timestamp: vi.fn().mockResolvedValue({
        timestampAt: new Date("2026-09-26T10:00:00Z"),
        token: "MIIBogYJKoZIhvcNAQcCoIIBkzCCAZcCAQMxDTALBglghkgBZQMEAgEwggEPBgsqhkiG9w0BCRAB",
      }),
    }

    const docHash = "e".repeat(64)
    const successResult = await requestTsaTimestamp(docHash, mockProvider)
    expect(successResult.success).toBe(true)
    expect(successResult.timestampAt).toBeDefined()
    expect(successResult.token).toBeDefined()

    // Offline / provider failure fallback
    const failingProvider = {
      timestamp: vi.fn().mockRejectedValue(new Error("EuroCert TSA service timeout")),
    }

    const fallbackResult = await requestTsaTimestamp(docHash, failingProvider)
    expect(fallbackResult.success).toBe(false)
    expect(fallbackResult.pending).toBe(true)
    expect(fallbackResult.timestampAt).toBeNull()
    expect(fallbackResult.token).toBeNull()
  })
})
