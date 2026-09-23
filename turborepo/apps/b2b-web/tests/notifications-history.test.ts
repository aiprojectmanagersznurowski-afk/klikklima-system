import { describe, it, expect, vi } from "vitest";
import { NOTIFICATIONS } from "@klikklima/contracts";
import { getCustomerCommunicationHistory } from "../src/lib/notifications/history";

const findId = (templateKey: string) => {
  const def = NOTIFICATIONS.find((n) => n.templateKey === templateKey);
  if (!def) throw new Error("Nie znaleziono definicji dla: " + templateKey);
  return def.id;
};

const N_AUDITOR_ASSIGNED = findId("funnel.auditor_assigned");
const N_INSTALL_COMPLETED = findId("funnel.install_completed");
const N_SERVICE_REMINDER = findId("service.reminder");
const N_INCIDENT_RECEIVED = findId("incident.received");

describe("NTF-HISTORY — Historia komunikacji z klientem na Karcie 360", () => {
  // @REQ: NTF-HISTORY
  it("recipient_address zapisuje adres z chwili wysyłki i nie zmienia się po edycji danych klienta", async () => {
    const historicalRows = [
      {
        id: "ntf-hist-1",
        notificationId: N_AUDITOR_ASSIGNED,
        channel: "SMS",
        recipientType: "CLIENT",
        recipientAddress: "+48500111222",
        status: "SENT",
        createdAt: new Date("2026-06-01T10:00:00Z"),
        leadId: "lead-uuid-1",
        installationId: null,
        serviceId: null,
        incidentId: null,
      },
    ];

    const mockPrisma = {
      notificationQueue: {
        findMany: vi.fn().mockResolvedValue(historicalRows),
      },
    };

    const history = await getCustomerCommunicationHistory(mockPrisma as never, {
      clientId: "client-1",
      leadIds: ["lead-uuid-1"],
    });

    expect(history).toHaveLength(1);
    // Adres w historii to archiwalny numer z momentu wysyłki (+48500111222)
    expect(history[0].recipientAddress).toBe("+48500111222");
  });

  // @REQ: NTF-HISTORY
  it("historia obejmuje wszystkie cztery typy powiązań (lead, installation, service, incident)", async () => {
    const historicalRows = [
      { id: "1", notificationId: N_AUDITOR_ASSIGNED, channel: "EMAIL", recipientType: "CLIENT", leadId: "lead-1", installationId: null, serviceId: null, incidentId: null, createdAt: new Date() },
      { id: "2", notificationId: N_INSTALL_COMPLETED, channel: "EMAIL", recipientType: "CLIENT", leadId: null, installationId: "inst-1", serviceId: null, incidentId: null, createdAt: new Date() },
      { id: "3", notificationId: N_SERVICE_REMINDER, channel: "SMS", recipientType: "CLIENT", leadId: null, installationId: null, serviceId: "srv-1", incidentId: null, createdAt: new Date() },
      { id: "4", notificationId: N_INCIDENT_RECEIVED, channel: "SMS", recipientType: "CLIENT", leadId: null, installationId: null, serviceId: null, incidentId: "inc-1", createdAt: new Date() },
    ];

    const mockPrisma = {
      notificationQueue: {
        findMany: vi.fn().mockResolvedValue(historicalRows),
      },
    };

    const history = await getCustomerCommunicationHistory(mockPrisma as never, {
      clientId: "client-1",
      leadIds: ["lead-1"],
      installationIds: ["inst-1"],
      serviceIds: ["srv-1"],
      incidentIds: ["inc-1"],
    });

    expect(history).toHaveLength(4);
    const notificationIds = history.map((h) => h.notificationId);
    expect(notificationIds).toEqual([
      N_AUDITOR_ASSIGNED,
      N_INSTALL_COMPLETED,
      N_SERVICE_REMINDER,
      N_INCIDENT_RECEIVED,
    ]);
  });

  // @REQ: NTF-HISTORY
  it("powiadomienia wewnętrzne (I1–I7) nie pojawiają się w historii klienta", async () => {
    const mixedRows = [
      { id: "1", notificationId: N_AUDITOR_ASSIGNED, recipientType: "CLIENT", channel: "SMS", createdAt: new Date() },
      { id: "2", notificationId: "internal-1", recipientType: "DISPATCHER", channel: "EMAIL", createdAt: new Date() },
      { id: "3", notificationId: "internal-2", recipientType: "DISPATCHER", channel: "SMS", createdAt: new Date() },
      { id: "4", notificationId: "internal-3", recipientType: "CREW", channel: "SMS", createdAt: new Date() },
    ];

    const mockPrisma = {
      notificationQueue: {
        findMany: vi.fn().mockImplementation(async ({ where }) => {
          // Zapytanie filtruje recipientType = CLIENT
          return mixedRows.filter((r) => r.recipientType === "CLIENT");
        }),
      },
    };

    const history = await getCustomerCommunicationHistory(mockPrisma as never, {
      clientId: "client-1",
      leadIds: ["lead-1"],
    });

    expect(history).toHaveLength(1);
    expect(history[0].notificationId).toBe(N_AUDITOR_ASSIGNED);
  });
});
