import { describe, it, expect, vi, beforeEach } from "vitest"
import { SLA, NOTIFICATIONS } from "@klikklima/contracts"

const {
  installationFindManyMock,
  serviceCreateMock,
  notificationQueueCreateMock,
  transactionMock,
} = vi.hoisted(() => ({
  installationFindManyMock: vi.fn(),
  serviceCreateMock: vi.fn(),
  notificationQueueCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}))

vi.mock("@repo/database", () => ({
  prisma: {
    instalacje: {
      findMany: installationFindManyMock,
    },
    serwisy: {
      create: serviceCreateMock,
    },
    notificationQueue: {
      create: notificationQueueCreateMock,
    },
    $transaction: transactionMock,
  },
}))

describe("CRM-SRV-TRIGGER & SRV-REMINDER-ONCE: runServiceInspectionCron", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionMock.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
      return cb({
        serwisy: {
          create: serviceCreateMock,
        },
        notificationQueue: {
          create: notificationQueueCreateMock,
        },
      })
    })
  })

  it("wyszukuje instalacje z terminem przeglądu w oknie 30 dni (SLA.SERVICE_REMINDER_LEAD)", async () => {
    installationFindManyMock.mockResolvedValue([])

    const { runServiceInspectionCron } = await import(
      "../src/app/(dashboard)/services/cron"
    )

    const testNow = new Date("2026-09-12T10:00:00Z")
    const summary = await runServiceInspectionCron(testNow)

    expect(summary.inspectedCount).toBe(0)
    expect(installationFindManyMock).toHaveBeenCalledTimes(1)

    const callArgs = installationFindManyMock.mock.calls[0][0]
    expect(callArgs.where.status).toBe("COMPLETED")
    expect(callArgs.where.next_service_date.lte).toBeInstanceOf(Date)

    // Sprawdzenie, że próg daty to dokładnie +30 dni z kontraktu SLA
    const expectedThreshold = new Date(testNow)
    expectedThreshold.setDate(expectedThreshold.getDate() + SLA.SERVICE_REMINDER_LEAD.days)
    expect(callArgs.where.next_service_date.lte.toISOString().slice(0, 10)).toBe(
      expectedThreshold.toISOString().slice(0, 10)
    )
  })

  it("tworzy rekord serwisu (PLANNED) i kolejkuje N10 dla instalacji bez wcześniejszego serwisu", async () => {
    const installDate = new Date("2026-09-25T10:00:00Z") // 13 dni od teraz (w oknie 30 dni)

    installationFindManyMock.mockResolvedValue([
      {
        id: "inst-uuid-1",
        zespol_id: "crew-uuid-1",
        ["next_service_date"]: installDate,
        lead: {
          id: "lead-uuid-1",
          adres_id: "addr-uuid-1",
          klient_id: "client-uuid-1",
          klient: {
            id: "client-uuid-1",
            imie_i_nazwisko: "Marek Nowak",
            email: "marek@example.com",
            telefon: "600200300",
          },
        },
        serwisy: [], // Brak istniejącego serwisu
      },
    ])

    serviceCreateMock.mockResolvedValue({ id: "srv-created-1" })
    notificationQueueCreateMock.mockResolvedValue({ id: "queue-1" })

    const { runServiceInspectionCron } = await import(
      "../src/app/(dashboard)/services/cron"
    )

    const summary = await runServiceInspectionCron(new Date("2026-09-12T10:00:00Z"))

    expect(summary.inspectedCount).toBe(1)
    expect(summary.servicesCreatedCount).toBe(1)
    expect(summary.notificationsQueuedCount).toBeGreaterThanOrEqual(1)

    // Weryfikacja utworzenia rekordu serwisu w statusie PLANNED
    expect(serviceCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          instalacja_id: "inst-uuid-1",
          klient_id: "client-uuid-1",
          status: "PLANNED",
          opis_usterki: expect.stringContaining("Cykliczny przegląd gwarancyjny"),
        }),
      })
    )

    // Weryfikacja powiadomienia N10 (service.reminder)
    const n10Def = NOTIFICATIONS.find((n) => n.templateKey === "service.reminder")
    expect(n10Def).toBeDefined()
    expect(notificationQueueCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notificationId: n10Def!.id,
          recipientType: "CLIENT",
          serviceId: "srv-created-1",
          installationId: null,
        }),
      })
    )
  })

  it("SRV-REMINDER-ONCE: nie tworzy kolejnego serwisu jeśli rekord PLANNED już istnieje", async () => {
    const installDate = new Date("2026-09-25T10:00:00Z")

    installationFindManyMock.mockResolvedValue([
      {
        id: "inst-uuid-1",
        zespol_id: "crew-uuid-1",
        ["next_service_date"]: installDate,
        lead: {
          id: "lead-uuid-1",
          adres_id: "addr-uuid-1",
          klient_id: "client-uuid-1",
          klient: {
            id: "client-uuid-1",
            imie_i_nazwisko: "Marek Nowak",
            email: "marek@example.com",
            telefon: "600200300",
          },
        },
        serwisy: [{ id: "existing-srv-1", status: "PLANNED" }], // Już istnieje!
      },
    ])

    const { runServiceInspectionCron } = await import(
      "../src/app/(dashboard)/services/cron"
    )

    const summary = await runServiceInspectionCron(new Date("2026-09-12T10:00:00Z"))

    // Serwis nie powinien być ponownie tworzony
    expect(summary.servicesCreatedCount).toBe(0)
    expect(serviceCreateMock).not.toHaveBeenCalled()
  })
})
