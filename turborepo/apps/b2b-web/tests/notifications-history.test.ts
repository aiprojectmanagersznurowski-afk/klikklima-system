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

/**
 * applyWhereClause — interpreter MINIMALNEGO podzbioru składni `where` Prisma
 * (equality, `{ field: { in: [...] } }`, `OR: [...]`), używany WYŁĄCZNIE po
 * to, żeby atrapa `findMany` faktycznie filtrowała na podstawie argumentu,
 * który dostała od kodu produkcyjnego — a nie zwracała z góry przygotowaną
 * listę wierszy niezależnie od tego, co jej przekazano (dokładnie ten defekt,
 * który recenzja 2026-09-24 znalazła w tym pliku: `findMany` ignorowało
 * `where` i test i tak przechodził).
 *
 * Interpreter NIE wie nic o `clientId` — bo dzisiejszy `where` produkowany
 * przez `getCustomerCommunicationHistory` też nic o nim nie wie (parametr
 * jest przyjmowany i nieużywany). To jest właśnie premisa testu poniżej.
 */
function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") {
      const branches = condition as Record<string, unknown>[];
      return branches.some((branch) => matchesWhere(row, branch));
    }
    if (condition && typeof condition === "object" && "in" in (condition as object)) {
      const list = (condition as { in: unknown[] }).in;
      return list.includes(row[key]);
    }
    return row[key] === condition;
  });
}

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
        findMany: vi.fn().mockImplementation(async ({ where }) =>
          historicalRows.filter((r) => matchesWhere(r, where)),
        ),
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
        findMany: vi.fn().mockImplementation(async ({ where }) =>
          historicalRows.filter((r) => matchesWhere(r, where)),
        ),
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
        // Filtr jest zastosowany PRZEZ interpreter na podstawie `where`
        // przekazanego przez kod produkcyjny — nie zaszyty na twardo w atrapie
        // (implementacja bez filtra recipientType przejdzie tu identycznie
        // jak dawniej, jeżeli where faktycznie go nie zawiera).
        findMany: vi.fn().mockImplementation(async ({ where }) =>
          mixedRows.filter((r) => matchesWhere(r, where)),
        ),
      },
    };

    const history = await getCustomerCommunicationHistory(mockPrisma as never, {
      clientId: "client-1",
      leadIds: ["lead-1"],
    });

    expect(history).toHaveLength(1);
    expect(history[0].notificationId).toBe(N_AUDITOR_ASSIGNED);
  });

  // @REQ: NTF-HISTORY
  it("wywołanie z samym clientId (bez żadnej listy ID) NIE zwraca komunikacji innych klientów", async () => {
    // Dwa wiersze CLIENT, powiązane z DWOMA różnymi leadami — a więc (w
    // rzeczywistym systemie) z dwoma różnymi klientami. Wołający podaje
    // WYŁĄCZNIE `clientId`, bez `leadIds` — scenariusz z Karty 360, gdzie
    // wołający jeszcze nie zna ID leadów/instalacji tego klienta i oczekuje,
    // że funkcja sama je rozstrzygnie przez realną relację.
    //
    // Interpreter `matchesWhere` NIE MA żadnej wiedzy o `clientId` — bo
    // dzisiejszy `where` produkowany przez `getCustomerCommunicationHistory`
    // też jej nie ma (parametr jest przyjmowany i nieużywany, `where`
    // redukuje się do `{ recipientType: "CLIENT" }`). Jeżeli wynik zawiera
    // wiersz „innego klienta", dispatcher/historia wyciekła całą tabelę.
    const rowOwnedByOurClient = {
      id: "ntf-mine",
      notificationId: N_AUDITOR_ASSIGNED,
      channel: "SMS",
      recipientType: "CLIENT",
      recipientAddress: "+48500000001",
      leadId: "lead-client-1",
      installationId: null,
      serviceId: null,
      incidentId: null,
      createdAt: new Date("2026-06-01T10:00:00Z"),
    };
    const rowOwnedByOtherClient = {
      id: "ntf-not-mine",
      notificationId: N_INSTALL_COMPLETED,
      channel: "EMAIL",
      recipientType: "CLIENT",
      recipientAddress: "+48500000002",
      leadId: "lead-client-2",
      installationId: null,
      serviceId: null,
      incidentId: null,
      createdAt: new Date("2026-06-02T10:00:00Z"),
    };
    const allRows = [rowOwnedByOurClient, rowOwnedByOtherClient];

    // Rozwiązanie clientId -> leadIds musi przejść przez PRAWDZIWĄ relację
    // (`leady.klient_id`), nie przez domysł. Fikstura mapuje każdego klienta
    // na WŁASNY lead, żeby atrapa mogła odróżnić "client-1" od "client-2" —
    // dokładnie tak, jak zrobiłaby to prawdziwa tabela `leady`.
    const leadsByClient: Record<string, { id: string }[]> = {
      "client-1": [{ id: "lead-client-1" }],
      "client-2": [{ id: "lead-client-2" }],
    };

    const mockPrisma = {
      notificationQueue: {
        findMany: vi.fn().mockImplementation(async ({ where }) =>
          allRows.filter((r) => matchesWhere(r, where)),
        ),
      },
      leady: {
        findMany: vi.fn().mockImplementation(
          async ({ where }: { where: { klient_id?: string } }) =>
            leadsByClient[where.klient_id ?? ""] ?? [],
        ),
      },
      // Klient nie ma jeszcze instalacji/serwisów/usterek w tym scenariuszu —
      // relacje istnieją (kod stąpa przez nie), po prostu nic nie znajdują.
      instalacje: {
        findMany: vi.fn().mockImplementation(async () => []),
      },
      serwisy: {
        findMany: vi.fn().mockImplementation(async () => []),
      },
      usterki_incidents: {
        findMany: vi.fn().mockImplementation(async () => []),
      },
    };

    const history = await getCustomerCommunicationHistory(mockPrisma as never, {
      clientId: "client-1",
    });

    const returnedIds = history.map((h) => h.id);
    expect(returnedIds).not.toContain("ntf-not-mine");
    expect(returnedIds).toEqual(["ntf-mine"]);
  });
});
