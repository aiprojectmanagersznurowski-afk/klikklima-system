import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { LeadStatus } from "@repo/database"

const {
  logistykaFindFirstMock,
  logistykaUpdateMock,
  leadyUpdateMock,
  transactionMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  logistykaFindFirstMock: vi.fn(),
  logistykaUpdateMock: vi.fn(),
  leadyUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock("@repo/database", () => ({
  LeadStatus: {
    NEW: "NEW",
    CONTACT_ATTEMPTED: "CONTACT_ATTEMPTED",
    QUALIFIED: "QUALIFIED",
    OFFER_PREPARED: "OFFER_PREPARED",
    CONTRACT_SIGNED: "CONTRACT_SIGNED",
    PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
    HARDWARE_IN_TRANSIT: "HARDWARE_IN_TRANSIT",
    AWAITING_INSTALLATION: "AWAITING_INSTALLATION",
    INSTALLED: "INSTALLED",
    CANCELLED: "CANCELLED",
  },
  ShippingStatus: {
    PENDING: "PENDING",
    SHIPPED: "SHIPPED",
    DELIVERED: "DELIVERED",
  },
  prisma: {
    logistyka_zamowienia: {
      findFirst: logistykaFindFirstMock,
      update: logistykaUpdateMock,
    },
    leady: {
      update: leadyUpdateMock,
    },
    $transaction: transactionMock,
  },
}))

describe("FNL-E6-E7 / T08: Courier Shipping Webhook (/api/webhooks/shipping)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionMock.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
      return cb({
        leady: { update: leadyUpdateMock },
        logistyka_zamowienia: { update: logistykaUpdateMock },
      })
    })
  })

  function createRequest(body: any, headers: Record<string, string> = {}) {
    const jsonString = typeof body === "string" ? body : JSON.stringify(body)
    return new NextRequest("http://localhost:3000/api/webhooks/shipping", {
      method: "POST",
      body: jsonString,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
    })
  }

  it("zwraca 400 dla nieprawidłowego formatu JSON", async () => {
    const { POST } = await import("../src/app/api/webhooks/shipping/route")
    const req = new NextRequest("http://localhost:3000/api/webhooks/shipping", {
      method: "POST",
      body: "{ invalid json",
      headers: { "content-type": "application/json" },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Nieprawidłowy format JSON")
  })

  it("zwraca 422 dla brakującego numeru listu przewozowego lub błędnego statusu", async () => {
    const { POST } = await import("../src/app/api/webhooks/shipping/route")
    const req = createRequest({ status: "DELIVERED" }) // brak tracking_id

    const res = await POST(req)
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error).toBe("Błąd walidacji danych")
  })

  it("zwraca 404 gdy nie znaleziono zlecenia logistycznego dla danego numeru przesyłki", async () => {
    logistykaFindFirstMock.mockResolvedValue(null)

    const { POST } = await import("../src/app/api/webhooks/shipping/route")
    const req = createRequest({
      tracking_id: "TRACK-999999",
      status: "DELIVERED",
    })

    const res = await POST(req)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toContain("TRACK-999999")
  })

  it("T08: przesuwa lead z HARDWARE_IN_TRANSIT do AWAITING_INSTALLATION po doręczeniu DELIVERED", async () => {
    logistykaFindFirstMock.mockResolvedValue({
      id: "shipment-uuid-1",
      lead_id: "lead-uuid-1",
      tracking_id: "DPD-12345678",
      status_wysylki: "IN_TRANSIT",
      lead: {
        id: "lead-uuid-1",
        status: LeadStatus.HARDWARE_IN_TRANSIT,
      },
    })

    const { POST } = await import("../src/app/api/webhooks/shipping/route")
    const req = createRequest({
      tracking_id: "DPD-12345678",
      status: "DELIVERED",
      courier: "DPD",
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.transition).toBe("T08")
    expect(json.new_status).toBe("AWAITING_INSTALLATION")

    // Sprawdzenie transakcji
    expect(leadyUpdateMock).toHaveBeenCalledWith({
      where: { id: "lead-uuid-1" },
      data: { status: LeadStatus.AWAITING_INSTALLATION },
    })
    expect(logistykaUpdateMock).toHaveBeenCalledWith({
      where: { id: "shipment-uuid-1" },
      data: { status_wysylki: "DELIVERED" },
    })

    expect(revalidatePathMock).toHaveBeenCalledWith("/logistics")
    expect(revalidatePathMock).toHaveBeenCalledWith("/leads")
  })

  it("idempotentność: nie zmienia statusu leada jeśli lead jest już w AWAITING_INSTALLATION", async () => {
    logistykaFindFirstMock.mockResolvedValue({
      id: "shipment-uuid-1",
      lead_id: "lead-uuid-1",
      tracking_id: "DPD-12345678",
      status_wysylki: "DELIVERED",
      lead: {
        id: "lead-uuid-1",
        status: LeadStatus.AWAITING_INSTALLATION,
      },
    })

    const { POST } = await import("../src/app/api/webhooks/shipping/route")
    const req = createRequest({
      tracking_id: "DPD-12345678",
      status: "DELIVERED",
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.already_advanced).toBe(true)
    expect(leadyUpdateMock).not.toHaveBeenCalled()
  })

  it("aktualizuje status wysyłki dla statusów pośrednich (np. IN_TRANSIT)", async () => {
    logistykaFindFirstMock.mockResolvedValue({
      id: "shipment-uuid-1",
      lead_id: "lead-uuid-1",
      tracking_id: "DPD-12345678",
      status_wysylki: "OUT_FOR_DELIVERY",
      lead: {
        id: "lead-uuid-1",
        status: LeadStatus.HARDWARE_IN_TRANSIT,
      },
    })

    const { POST } = await import("../src/app/api/webhooks/shipping/route")
    const req = createRequest({
      tracking_id: "DPD-12345678",
      status: "IN_TRANSIT",
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.updated_shipment_status).toBe("IN_TRANSIT")
    expect(logistykaUpdateMock).toHaveBeenCalledWith({
      where: { id: "shipment-uuid-1" },
      data: { status_wysylki: "SHIPPED" },
    })
    expect(leadyUpdateMock).not.toHaveBeenCalled()
  })
})
