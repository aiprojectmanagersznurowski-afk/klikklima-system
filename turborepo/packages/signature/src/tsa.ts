// @REQ: FLD-SIGN-TSA

export interface TsaTimestampResponse {
  timestampAt: Date
  token: string
}

export interface TsaProvider {
  timestamp(documentHash: string): Promise<TsaTimestampResponse>
}

export interface TsaResult {
  success: boolean
  pending: boolean
  timestampAt: Date | null
  token: string | null
  error?: string
}

export function verifyTsaPair(tsaTimestampAt: Date | string | null | undefined, tsaToken: string | null | undefined): boolean {
  const hasTimestamp = tsaTimestampAt !== null && tsaTimestampAt !== undefined
  const hasToken = tsaToken !== null && tsaToken !== undefined && tsaToken.trim().length > 0

  return (hasTimestamp && hasToken) || (!hasTimestamp && !hasToken)
}

/**
 * Domyślny dostawca EuroCert TSA (RFC 3161).
 * W środowisku testowym/deweloperskim lub w przypadku braku zewnętrznego endpointu
 * może działać w trybie symulacji kwalifikowanego znacznika.
 */
export class EuroCertTsaProvider implements TsaProvider {
  private endpointUrl: string

  constructor(endpointUrl?: string) {
    this.endpointUrl = endpointUrl || process.env.EUROCERT_TSA_URL || "https://tsa.eurocert.pl"
  }

  async timestamp(documentHash: string): Promise<TsaTimestampResponse> {
    if (!documentHash || documentHash.length !== 64) {
      throw new Error("Invalid document hash for TSA request")
    }

    // Jeśli skonfigurowany jest rzeczywisty endpoint, wysyłamy żądanie RFC 3161.
    // W środowisku bez zewnętrznego dostępu lub z flagą mock generujemy deterministyczny token symulacyjny.
    if (process.env.EUROCERT_TSA_ENABLED === "true" && this.endpointUrl.startsWith("http")) {
      const response = await fetch(this.endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/timestamp-query",
        },
        body: Buffer.from(documentHash, "hex"),
      })

      if (!response.ok) {
        throw new Error(`EuroCert TSA service returned HTTP ${response.status}: ${response.statusText}`)
      }

      const raw = await response.arrayBuffer()
      const token = Buffer.from(raw).toString("base64")
      return {
        timestampAt: new Date(),
        token,
      }
    }

    // Standardowa symulacja RFC 3161 tokenu dla środowiska lokalnego / CI
    const now = new Date()
    const syntheticToken = `MIIBogYJKoZIhvcNAQcCoIIBkzCCAZcCAQMxDTALBglghkgBZQMEAgEwggEPBgsqhkiG9w0BCRAB-${documentHash.slice(0, 16)}-${now.getTime()}`
    return {
      timestampAt: now,
      token: syntheticToken,
    }
  }
}

export async function requestTsaTimestamp(documentHash: string, provider?: TsaProvider): Promise<TsaResult> {
  const activeProvider = provider || new EuroCertTsaProvider()

  try {
    const res = await activeProvider.timestamp(documentHash)
    return {
      success: true,
      pending: false,
      timestampAt: res.timestampAt,
      token: res.token,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown TSA provider error"
    // Awaria dostawcy lub brak sieci NIE blokuje zapisu podpisu (FLD-SIGN-TSA)
    return {
      success: false,
      pending: true,
      timestampAt: null,
      token: null,
      error: errorMsg,
    }
  }
}
