import { describe, it, expect, vi, beforeEach } from "vitest";
import { NOTIFICATIONS } from "@klikklima/contracts";
import { enqueueNotificationEx } from "../src/lib/notifications/enqueue";

const { txCreateMock } = vi.hoisted(() => ({
  txCreateMock: vi.fn(),
}));

function makeTx() {
  return {
    notificationQueue: {
      create: txCreateMock,
    },
  };
}

const findId = (templateKey: string) => {
  const def = NOTIFICATIONS.find((n) => n.templateKey === templateKey);
  if (!def) throw new Error("Nie znaleziono definicji dla: " + templateKey);
  return def.id;
};

const FUNNEL_ID = findId("funnel.auditor_assigned");

const SERVICE_TEMPLATES = [
  "service.reminder",
  "service.technician_assigned",
  "service.reminder_24h",
  "service.technician_en_route",
  "service.completed",
];

const INCIDENT_TEMPLATES = [
  "incident.received",
  "incident.technician_assigned",
  "incident.technician_en_route",
  "incident.repaired",
];

beforeEach(() => {
  txCreateMock.mockReset();
});

describe("NTF-POLY — Powiadomienia polimorficzne (lead, instalacja, serwis, usterka)", () => {
  // @REQ: NTF-POLY
  it("dokładnie jedno z leadId/installationId/serviceId/incidentId jest wymagane", async () => {
    const tx = makeTx();

    // 0 powiązań -> odrzucenie
    await expect(
      enqueueNotificationEx(tx as never, {
        notificationId: FUNNEL_ID,
        idempotencyKey: "test:zero:owner",
      })
    ).rejects.toThrow("dokładnie jedno z leadId/installationId/serviceId/incidentId");

    // 2 powiązania -> odrzucenie
    await expect(
      enqueueNotificationEx(tx as never, {
        notificationId: FUNNEL_ID,
        idempotencyKey: "test:two:owners",
        leadId: "11111111-1111-1111-1111-111111111111",
        serviceId: "22222222-2222-2222-2222-222222222222",
      })
    ).rejects.toThrow("dokładnie jedno z leadId/installationId/serviceId/incidentId");

    expect(txCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: NTF-POLY
  it("powiadomienia domenowe serwisów kolejkują się z serviceId i odrzucają leadId", async () => {
    const tx = makeTx();
    txCreateMock.mockResolvedValue({ id: "queue-row-srv", status: "PENDING", attempts: 0 });

    for (const tplKey of SERVICE_TEMPLATES) {
      const notifId = findId(tplKey);

      // Błędne powiązanie: leadId zamiast serviceId
      await expect(
        enqueueNotificationEx(tx as never, {
          notificationId: notifId,
          idempotencyKey: `test:${notifId}:lead`,
          leadId: "11111111-1111-1111-1111-111111111111",
        })
      ).rejects.toThrow(/musi być powiązane z serviceId/);

      // Poprawne powiązanie: serviceId
      const res = await enqueueNotificationEx(tx as never, {
        notificationId: notifId,
        idempotencyKey: `test:${notifId}:service`,
        serviceId: "22222222-2222-2222-2222-222222222222",
      });
      expect(res.length).toBeGreaterThan(0);
    }
  });

  // @REQ: NTF-POLY
  it("powiadomienia domenowe usterek kolejkują się z incidentId i odrzucają leadId", async () => {
    const tx = makeTx();
    txCreateMock.mockResolvedValue({ id: "queue-row-inc", status: "PENDING", attempts: 0 });

    for (const tplKey of INCIDENT_TEMPLATES) {
      const notifId = findId(tplKey);

      // Błędne powiązanie: leadId zamiast incidentId
      await expect(
        enqueueNotificationEx(tx as never, {
          notificationId: notifId,
          idempotencyKey: `test:${notifId}:lead`,
          leadId: "11111111-1111-1111-1111-111111111111",
        })
      ).rejects.toThrow(/musi być powiązane z incidentId/);

      // Poprawne powiązanie: incidentId
      const res = await enqueueNotificationEx(tx as never, {
        notificationId: notifId,
        idempotencyKey: `test:${notifId}:incident`,
        incidentId: "33333333-3333-3333-3333-333333333333",
      });
      expect(res.length).toBeGreaterThan(0);
    }
  });
});
