import { describe, it, expect, vi } from "vitest"
import {
  renderDocumentPdf,
  saveDocumentRecord,
  getTemplateRequiredFields,
} from "@repo/documents"

describe("DOC-PDF-RENDER — Silnik szablonów i renderowania PDF po stronie serwera", () => {
  // @REQ: DOC-PDF-RENDER
  it("renderowanie odbywa się po stronie serwera i generuje poprawny bufor PDF", () => {
    const data = {
      numer_umowy: "U-2026/09/001",
      data_zawarcia: "2026-09-25",
      klient_imie_nazwisko: "Jan Kowalski",
      klient_adres: "ul. Kwiatowa 5, 00-001 Warszawa",
      adres_montazu: "ul. Kwiatowa 5, 00-001 Warszawa",
      zestaw_urzadzen: "Daikin Comfora 3.5 kW",
      cena_brutto: "5 400,00 zł",
      zaliczka_brutto: "2 500,00 zł",
      termin_montazu: "2026-10-15",
    }

    const result = renderDocumentPdf({
      templateName: "umowa-montazu-v0.1-lorem.pdf",
      data,
    })

    expect(result).toBeDefined()
    expect(result.buffer).toBeInstanceOf(Buffer)
    expect(result.buffer.length).toBeGreaterThan(0)
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/)
  })

  // @REQ: DOC-PDF-RENDER
  it("ten sam wzór i te same dane dają bajtowo ten sam dokument (determinizm)", () => {
    const data = {
      numer_umowy: "U-2026/09/001",
      data_zawarcia: "2026-09-25",
      klient_imie_nazwisko: "Jan Kowalski",
      klient_adres: "ul. Kwiatowa 5, 00-001 Warszawa",
      adres_montazu: "ul. Kwiatowa 5, 00-001 Warszawa",
      zestaw_urzadzen: "Daikin Comfora 3.5 kW",
      cena_brutto: "5 400,00 zł",
      zaliczka_brutto: "2 500,00 zł",
      termin_montazu: "2026-10-15",
    }

    const run1 = renderDocumentPdf({
      templateName: "umowa-montazu-v0.1-lorem.pdf",
      data,
    })
    const run2 = renderDocumentPdf({
      templateName: "umowa-montazu-v0.1-lorem.pdf",
      data,
    })

    expect(run1.contentHash).toBe(run2.contentHash)
    expect(run1.buffer.equals(run2.buffer)).toBe(true)
  })

  // @REQ: DOC-PDF-RENDER
  it("brakujące pole w danych wejściowych rzuca błąd renderowania, a nie puste miejsce", () => {
    const incompleteData = {
      numer_umowy: "U-2026/09/001",
      // brak data_zawarcia, klient_imie_nazwisko, etc.
    }

    expect(() => {
      renderDocumentPdf({
        templateName: "umowa-montazu-v0.1-lorem.pdf",
        data: incompleteData,
      })
    }).toThrow(/Brakujące pola w szablonie/)
  })

  // @REQ: DOC-PDF-RENDER
  it("zwraca listę wymaganych pól {{...}} dla danego szablonu", () => {
    const requiredFields = getTemplateRequiredFields("umowa-montazu-v0.1-lorem.pdf")
    expect(requiredFields).toContain("numer_umowy")
    expect(requiredFields).toContain("klient_imie_nazwisko")
    expect(requiredFields).toContain("cena_brutto")
    expect(requiredFields).toContain("zaliczka_brutto")
  })

  // @REQ: DOC-PDF-RENDER
  it("rozpoznaje wersję roboczą (-lorem) po zapisanej wersji szablonu", () => {
    const data = {
      numer_umowy: "U-2026/09/001",
      data_zawarcia: "2026-09-25",
      klient_imie_nazwisko: "Jan Kowalski",
      klient_adres: "ul. Kwiatowa 5, 00-001 Warszawa",
      adres_montazu: "ul. Kwiatowa 5, 00-001 Warszawa",
      zestaw_urzadzen: "Daikin Comfora 3.5 kW",
      cena_brutto: "5 400,00 zł",
      zaliczka_brutto: "2 500,00 zł",
      termin_montazu: "2026-10-15",
    }

    const result = renderDocumentPdf({
      templateName: "umowa-montazu-v0.1-lorem.pdf",
      data,
    })

    expect(result.templateVersion).toBe("v0.1-lorem")
    expect(result.isDraft).toBe(true)
  })

  // @REQ: DOC-PDF-RENDER
  it("zapisuje wygenerowany dokument jako wiersz w tabeli documents z odwołaniem do źródła", async () => {
    const mockTx = {
      document: {
        create: vi.fn().mockResolvedValue({ id: "doc-123" }),
      },
    } as unknown as import("@repo/database").Prisma.TransactionClient

    const docId = await saveDocumentRecord(mockTx, {
      kind: "INSTALLATION_CONTRACT",
      sourceType: "installation_contracts",
      sourceId: "contract-uuid-123",
      storagePath: "contracts/contract-uuid-123.pdf",
      contentHash: "abcdef1234567890",
      templateVersion: "v0.1-lorem",
    })

    expect(docId.id).toBe("doc-123")
    expect(mockTx.document.create).toHaveBeenCalledWith({
      data: {
        kind: "INSTALLATION_CONTRACT",
        sourceType: "installation_contracts",
        sourceId: "contract-uuid-123",
        storagePath: "contracts/contract-uuid-123.pdf",
        contentHash: "abcdef1234567890",
        templateVersion: "v0.1-lorem",
      },
    })
  })

  // @REQ: DOC-PDF-RENDER
  it("odrzuca zapis dokumentu bez wskazania źródła (sourceType / sourceId)", async () => {
    const mockTx = {
      document: {
        create: vi.fn(),
      },
    } as unknown as import("@repo/database").Prisma.TransactionClient

    await expect(
      saveDocumentRecord(mockTx, {
        kind: "INSTALLATION_CONTRACT",
        sourceType: "",
        sourceId: "",
        storagePath: "contracts/123.pdf",
        contentHash: "hash123",
        templateVersion: "v0.1-lorem",
      })
    ).rejects.toThrow(/Wskazanie źródła/)
    expect(mockTx.document.create).not.toHaveBeenCalled()
  })
})
