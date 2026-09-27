// @REQ: FLD-SIGN-CAPTURE

export type SignatureMode = "ON_SITE" | "REMOTE"
export type DocumentType = "HANDOVER_PROTOCOL" | "INSTALLATION_CONTRACT"

export interface CaptureMetadata {
  deviceModel?: string
  osVersion?: string
  signedAtClient?: string
  clientIp?: string
  screenWidth?: number
  screenHeight?: number
  userAgent?: string
  [key: string]: unknown
}

export interface SignatureCaptureInput {
  mode: SignatureMode
  documentType: DocumentType
  documentHash: string
  signatureImage: string
  captureMetadata?: CaptureMetadata
  otpPhone?: string | null
  otpVerifiedAt?: Date | string | null
}

export interface SignatureCaptureValidationResult {
  isValid: boolean
  errors: string[]
  data?: {
    mode: SignatureMode
    documentType: DocumentType
    documentHash: string
    signatureImage: string
    captureMetadata?: CaptureMetadata
    otpRequired: boolean
    otpPhone?: string | null
    otpVerifiedAt?: Date | null
  }
}

export function validateSignatureCapture(input: SignatureCaptureInput): SignatureCaptureValidationResult {
  const errors: string[] = []

  if (input.mode !== "ON_SITE" && input.mode !== "REMOTE") {
    errors.push("Invalid signature mode: must be ON_SITE or REMOTE")
  }

  if (input.documentType !== "HANDOVER_PROTOCOL" && input.documentType !== "INSTALLATION_CONTRACT") {
    errors.push("Invalid document type: must be HANDOVER_PROTOCOL or INSTALLATION_CONTRACT")
  }

  if (!input.documentHash || typeof input.documentHash !== "string" || !/^[a-f0-9]{64}$/i.test(input.documentHash.trim())) {
    errors.push("Document hash must be a valid 64-character SHA-256 hex string")
  }

  if (!input.signatureImage || typeof input.signatureImage !== "string" || input.signatureImage.trim().length === 0) {
    errors.push("Signature image cannot be empty")
  }

  let parsedOtpVerifiedAt: Date | null = null
  const otpRequired = input.mode === "REMOTE"

  if (otpRequired) {
    if (!input.otpPhone || typeof input.otpPhone !== "string" || input.otpPhone.trim().length === 0) {
      errors.push("Remote signature requires verified SMS OTP")
    }
    if (!input.otpVerifiedAt) {
      if (!errors.includes("Remote signature requires verified SMS OTP")) {
        errors.push("Remote signature requires verified SMS OTP")
      }
    } else {
      parsedOtpVerifiedAt = input.otpVerifiedAt instanceof Date ? input.otpVerifiedAt : new Date(input.otpVerifiedAt)
      if (isNaN(parsedOtpVerifiedAt.getTime())) {
        errors.push("Invalid OTP verification date")
      }
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    }
  }

  return {
    isValid: true,
    errors: [],
    data: {
      mode: input.mode,
      documentType: input.documentType,
      documentHash: input.documentHash.trim().toLowerCase(),
      signatureImage: input.signatureImage.trim(),
      captureMetadata: input.captureMetadata,
      otpRequired,
      otpPhone: input.otpPhone ?? null,
      otpVerifiedAt: parsedOtpVerifiedAt,
    },
  }
}
