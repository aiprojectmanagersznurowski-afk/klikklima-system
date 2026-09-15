import { describe, it, expect, vi, beforeEach } from "vitest"
import { SLA, NOTIFICATIONS } from "@klikklima/contracts"

const {
  incidentCreateMock,
  incidentUpdateMock,
  incidentFindUniqueMock,
  incidentCountMock,
  clientFindUniqueMock,
  notificationQueueCreateMock,
  transactionMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  incidentCreateMock: vi.fn(),
  incidentUpdateMock: vi.fn(),
  incidentFindUniqueMock: vi.fn(),
  incidentCountMock: vi.fn(),
  clientFindUniqueMock: vi.fn(),
  notificationQueueCreateMock: vi.fn(),
  transactionMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}))

vi.mock("@repo/database", () => ({
  prisma: {
    usterki_incidents: {
      create: incidentCreateMock,
      update: incidentUpdateMock,
      findUnique: incidentFindUniqueMock,
      count: incidentCountMock,
    },
    klienci: {
      findUnique: clientFindUniqueMock,
    },
    notificationQueue: {
      create: notificationQueueCreateMock,
    },
    $transaction: transactionMock,
  },
}))

vi.mock("../src/utils/supabase/server", () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

describe("CRM-UST-AC3 / SLA: calculateIncidentSla", () => {
  it("zwraca poprawne limity godzinowe z kontraktu SLA.INCIDENT_RESPONSE (48h)", async () => {
    const { calculateIncidentSla } = await import(
      "../src/app/(dashboard)/incidents/sla"
    )

    const expectedHours = SLA.INCIDENT_RESPONSE.bands[0]?.afterHours ?? 48
    const baseDate = new Date("2026-09-10T10:00:00Z")
    const now24hLater = new Date("2026-09-11T10:00:00Z")

    const slaStatus = calculateIncidentSla(baseDate, "NOWE", "KRYTYCZNY", now24hLater)

    expect(slaStatus.slaLimitHours).toBe(expectedHours)
    expect(slaStatus.hoursElapsed).toBe(24)
    expect(slaStatus.isBreached).toBe(false)
    expect(slaStatus.isPaused).toBe(false)
    expect(slaStatus.isResolved).toBe(false)
  })

  it("oznacza zgłoszenie jako przeterminowane (isBreached=true) po upływie progu SLA dla krytycznego zgłoszenia", async () => {
    const { calculateIncidentSla } = await import(
      "../src/app/(dashboard)/incidents/sla"
    )

    const baseDate = new Date("2026-09-08T10:00:00Z")
    const now50hLater = new Date("2026-09-10T12:00:00Z") // 50h

    const slaStatus = calculateIncidentSla(baseDate, "NOWE", "KRYTYCZNY", now50hLater)

    expect(slaStatus.hoursElapsed).toBe(50)
    expect(slaStatus.isBreached).toBe(true)
    expect(slaStatus.label).toContain("Przekroczono SLA")
    expect(slaStatus.uiBadgeClass).toContain("destructive")
  })

  it("wstrzymuje licznik SLA dla statusu OCZEKUJE_NA_CZESCI (CRM-UST-AC3)", async () => {
    const { calculateIncidentSla } = await import(
      "../src/app/(dashboard)/incidents/sla"
    )

    const baseDate = new Date("2026-09-08T10:00:00Z")
    const now72hLater = new Date("2026-09-11T10:00:00Z")

    const slaStatus = calculateIncidentSla(
      baseDate,
      "OCZEKUJE_NA_CZESCI",
      "KRYTYCZNY",
      now72hLater
    )

    expect(slaStatus.isPaused).toBe(true)
    expect(slaStatus.isBreached).toBe(false)
    expect(slaStatus.label).toBe("Wstrzymano (części)")
  })

  it("oznacza jako rozwiązane dla statusu ZAKONCZONE", async () => {
    const { calculateIncidentSla } = await import(
      "../src/app/(dashboard)/incidents/sla"
    )

    const baseDate = new Date("2026-09-08T10:00:00Z")
    const now = new Date("2026-09-12T10:00:00Z")

    const slaStatus = calculateIncidentSla(baseDate, "ZAKONCZONE", "WYSOKI", now)

    expect(slaStatus.isResolved).toBe(true)
    expect(slaStatus.isBreached).toBe(false)
    expect(slaStatus.label).toBe("Rozwiązano")
  })
})

describe("CRM-UST-AC1 & NTF-I7-SLA: createIncidentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionMock.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
      return cb({
        usterki_incidents: {
          create: incidentCreateMock,
        },
        notificationQueue: {
          create: notificationQueueCreateMock,
        },
      })
    })
  })

  it("odrzuca tworzenie usterki dla ról bez uprawnień create (np. audytor)", async () => {
    getCurrentActorRoleMock.mockResolvedValue("audytor")
    const { createIncidentAction } = await import(
      "../src/app/(dashboard)/incidents/actions"
    )

    const res = await createIncidentAction({
      client_id: "00000000-0000-0000-0000-000000000001",
      priority: "NISKI",
      description: "Klimatyzator cieknie",
    })

    expect(res.success).toBe(false)
    expect(res.error).toContain("Brak uprawnień")
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("tworzy usterkę i kolejkuje alert I7 przy priorytecie KRYTYCZNY", async () => {
    getCurrentActorRoleMock.mockResolvedValue("dyspozytor")
    clientFindUniqueMock.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000001",
      imie_i_nazwisko: "Jan Kowalski",
      telefon: "500100200",
      email: "jan@example.com",
      adresy: [{ ulica_miasto: "Polna 5, Warszawa" }],
    })
    incidentCountMock.mockResolvedValue(4)
    incidentCreateMock.mockResolvedValue({
      id: "inc-uuid-1",
      numer_zgloszenia: "INC-2026-0005",
      priorytet: "KRYTYCZNY",
    })
    notificationQueueCreateMock.mockResolvedValue({ id: "queue-1" })

    const { createIncidentAction } = await import(
      "../src/app/(dashboard)/incidents/actions"
    )

    const res = await createIncidentAction({
      client_id: "00000000-0000-0000-0000-000000000001",
      priority: "KRYTYCZNY",
      description: "Awaria sprężarki, silne iskrzenie",
    })

    expect(res.success).toBe(true)
    expect(res.incidentId).toBe("inc-uuid-1")
    expect(res.numer_zgloszenia).toBe("INC-2026-0005")

    // Sprawdzenie wywołania zapisu do usterki_incidents
    expect(incidentCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          numer_zgloszenia: "INC-2026-0005",
          priorytet: "KRYTYCZNY",
          status: "NOWE",
        }),
      })
    )

    // NTF-I7-SLA: Powiadomienie PUSH I7 dla dyspozytora
    const i7Def = NOTIFICATIONS.find((n) => n.templateKey === "internal.incident_critical")
    expect(i7Def).toBeDefined()
    expect(notificationQueueCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notificationId: i7Def!.id,
          recipientType: "DISPATCHER",
          incidentId: "inc-uuid-1",
        }),
      })
    )
  })
})
