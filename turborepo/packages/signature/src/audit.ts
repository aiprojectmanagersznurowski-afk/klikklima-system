import { createHash } from "node:crypto"
import type { DocumentType, SignatureMode } from "./capture"

// @REQ: FLD-SIGN-AUDIT-TRAIL

export interface SignatureCardParams {
  signatureId: string
  documentType: DocumentType
  documentId: string
  documentHash: string
  mode: SignatureMode
  signedAt: Date | string
  signerName: string
  templateVersion: string
  tsaTimestampAt?: Date | string | null
}

export interface SignatureCard {
  signatureId: string
  documentType: DocumentType
  documentId: string
  documentHash: string
  mode: SignatureMode
  signedAt: string
  signerName: string
  templateVersion: string
  tsaTimestampAt: string | null
  cardHash: string
}

export function buildSignatureCard(params: SignatureCardParams): SignatureCard {
  const signedAtIso = params.signedAt instanceof Date ? params.signedAt.toISOString() : new Date(params.signedAt).toISOString()
  const tsaIso = params.tsaTimestampAt
    ? params.tsaTimestampAt instanceof Date
      ? params.tsaTimestampAt.toISOString()
      : new Date(params.tsaTimestampAt).toISOString()
    : null

  const canonicalPayload = JSON.stringify({
    signatureId: params.signatureId,
    documentType: params.documentType,
    documentId: params.documentId,
    documentHash: params.documentHash,
    mode: params.mode,
    signedAt: signedAtIso,
    signerName: params.signerName,
    templateVersion: params.templateVersion,
    tsaTimestampAt: tsaIso,
  })

  const cardHash = createHash("sha256").update(canonicalPayload).digest("hex")

  return {
    signatureId: params.signatureId,
    documentType: params.documentType,
    documentId: params.documentId,
    documentHash: params.documentHash,
    mode: params.mode,
    signedAt: signedAtIso,
    signerName: params.signerName,
    templateVersion: params.templateVersion,
    tsaTimestampAt: tsaIso,
    cardHash,
  }
}

export interface AuditChainRecord {
  id: string
  documentHash: string
  prevRecordHash: string | null
}

export function verifyAuditChain(records: AuditChainRecord[]): boolean {
  if (records.length === 0) return true

  for (let i = 1; i < records.length; i++) {
    const current = records[i]!
    const previous = records[i - 1]!

    if (current.prevRecordHash !== previous.documentHash) {
      return false
    }
  }

  return true
}
