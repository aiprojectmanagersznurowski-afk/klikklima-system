"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@repo/database"
import { can, NOTIFICATIONS, SLA } from "@klikklima/contracts"
import { enqueueNotification } from "../logistics/rollback-effects"
import { getCurrentActorRole, getCurrentUser } from "../../../utils/supabase/server"
import { deleteJustificationSchema, type DeleteJustificationInput, type DeleteActionResult } from "../../../lib/audit/delete-justification-schema"
import { shortId } from "../../../lib/format-id"

export type IncidentSlaStatus = {
  hoursElapsed: number;
  slaLimitHours: number;
  isBreached: boolean;
  isPaused: boolean;
  isResolved: boolean;
  label: string;
  uiBadgeClass: string;
};

export function calculateIncidentSla(
  createdAt: Date,
  status: string | null,
  priority: string | null,
  referenceDate = new Date()
): IncidentSlaStatus {
  const slaLimitHours = SLA.INCIDENT_RESPONSE.bands[0]?.afterHours ?? 48;
  const isResolved = status === "ZAKONCZONE" || status === "ANULOWANE";
  const isPaused = status === "OCZEKUJE_NA_CZESCI";

  const diffMs = Math.max(0, referenceDate.getTime() - new Date(createdAt).getTime());
  const hoursElapsed = Math.floor(diffMs / (1000 * 60 * 60));

  const isApplicablePriority =
    priority === "KRYTYCZNY" ||
    priority === "WYSOKI" ||
    priority === "ŚREDNI" ||
    priority === "CRITICAL" ||
    priority === "MEDIUM";

  const isBreached = !isResolved && !isPaused && isApplicablePriority && hoursElapsed >= slaLimitHours;

  let label = `${hoursElapsed}h / ${slaLimitHours}h`;
  let uiBadgeClass = "bg-secondary text-secondary-foreground border-border";

  if (isResolved) {
    label = "Rozwiązano";
    uiBadgeClass = "bg-secondary/60 text-muted-foreground border-border/50";
  } else if (isPaused) {
    label = "Wstrzymano (części)";
    uiBadgeClass = "bg-amber-500/15 text-amber-600 dark:text-amber-500 border-amber-500/30";
  } else if (isBreached) {
    label = `Przekroczono SLA (${hoursElapsed}h)`;
    uiBadgeClass = "bg-destructive/15 text-destructive border-destructive/30";
  } else if (hoursElapsed >= slaLimitHours / 2) {
    label = `${hoursElapsed}h / ${slaLimitHours}h (Pilne)`;
    uiBadgeClass = "bg-amber-500/15 text-amber-600 dark:text-amber-500 border-amber-500/30";
  }

  return {
    hoursElapsed,
    slaLimitHours,
    isBreached,
    isPaused,
    isResolved,
    label,
    uiBadgeClass,
  };
}

export type IncidentSummary = {
  id: string;
  numer_zgloszenia: string | null;
  klient_id?: string | null;
  klient_name: string;
  klient_telefon?: string | null;
  instalacja_id?: string | null;
  instalacja_model?: string | null;
  opis_usterki: string;
  priorytet: string;
  status: string;
  created_at: Date;
  zespol_id?: string | null;
  zespol_name: string | null;
  zdjecia_url?: string[];
  sla?: IncidentSlaStatus;
}

export async function getIncidents(): Promise<IncidentSummary[]> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return [];
  }

  const access = actorRole ? can(actorRole, "incidents", "read") : "no";
  if (access !== "yes" && access !== "own") {
    return [];
  }

  let scopeWhere: object | undefined;
  if (access === "own") {
    let user;
    try {
      ({ data: { user } } = await getCurrentUser());
    } catch (error) {
      console.error("Failed to resolve current user:", error);
      return [];
    }
    if (!user?.email) {
      return [];
    }

    const matches = await prisma.zespoly_monterskie.findMany({
      where: { email: user.email },
      take: 2,
    });
    if (matches.length !== 1 || matches[0].aktywny === false) {
      return [];
    }
    const ownId = matches[0].id;
    scopeWhere = {
      OR: [
        { zespol_id: ownId },
        { AND: [{ zespol_id: null }, { instalacja: { zespol_id: ownId } }] },
      ],
    };
  }

  const incidents = await prisma.usterki_incidents.findMany({
    where: scopeWhere,
    include: {
      klient: true,
      zespol: true,
      instalacja: {
        include: {
          lead: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  return incidents.map(inc => {
    const instalacjaLabel = inc.instalacja?.lead?.project_number
      ? `Projekt ${inc.instalacja.lead.project_number}`
      : (inc.instalacja?.id ? `Instalacja ${shortId(inc.instalacja.id)}` : null);

    return {
      id: inc.id,
      numer_zgloszenia: inc.numer_zgloszenia,
      klient_id: inc.klient_id,
      klient_name: inc.klient?.imie_i_nazwisko || "Nieznany Klient",
      klient_telefon: inc.klient?.telefon || null,
      instalacja_id: inc.instalacja_id,
      instalacja_model: instalacjaLabel,
      opis_usterki: inc.opis_usterki ?? "Brak opisu",
      priorytet: inc.priorytet ?? "NISKI",
      status: inc.status ?? "NOWE",
      created_at: inc.created_at,
      zespol_id: inc.zespol_id,
      zespol_name: inc.zespol?.nazwa ?? null,
      zdjecia_url: Array.isArray(inc.zdjecia_url) ? (inc.zdjecia_url as string[]) : [],
      sla: calculateIncidentSla(inc.created_at, inc.status, inc.priorytet),
    };
  });
}

export const createIncidentSchema = z.object({
  client_id: z.string().uuid("Wybierz klienta"),
  installation_id: z.string().uuid().nullable().optional(),
  priority: z.enum(["NISKI", "ŚREDNI", "WYSOKI", "KRYTYCZNY"]).default("NISKI"),
  description: z.string().min(5, "Opis usterki musi mieć minimum 5 znaków"),
  photo_urls: z.array(z.string()).optional().default([]),
});

export type CreateIncidentInput = z.input<typeof createIncidentSchema>;

export async function createIncidentAction(
  input: CreateIncidentInput
): Promise<{ success: boolean; incidentId?: string; numer_zgloszenia?: string | null; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do zgłaszania usterek." };
  }
  if (!actorRole || can(actorRole, "incidents", "create") !== "yes") {
    return { success: false, error: "Brak uprawnień do zgłaszania usterek." };
  }

  const parsed = createIncidentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Nieprawidłowe dane zgłoszenia.",
    };
  }

  const { client_id, installation_id, priority, description, photo_urls } = parsed.data;

  const client = await prisma.klienci.findUnique({
    where: { id: client_id },
    include: {
      adresy: true,
    },
  });
  if (!client) {
    return { success: false, error: "Klient nie istnieje." };
  }

  const year = new Date().getFullYear();
  const count = await prisma.usterki_incidents.count({
    where: {
      numer_zgloszenia: {
        startsWith: `INC-${year}-`,
      },
    },
  });
  const numer_zgloszenia = `INC-${year}-${String(count + 1).padStart(4, "0")}`;

  let createdId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const inc = await tx.usterki_incidents.create({
        data: {
          numer_zgloszenia,
          klient_id: client_id,
          instalacja_id: installation_id || null,
          priorytet: priority,
          status: "NOWE",
          opis_usterki: description,
          zdjecia_url: photo_urls.length > 0 ? photo_urls : undefined,
        },
      });
      createdId = inc.id;

      // NTF-I7-SLA: KRYTYCZNY priorytet wyzwala natychmiastowe powiadomienie PUSH do dyspozytora
      if (priority === "KRYTYCZNY") {
        const i7Def = NOTIFICATIONS.find((n) => n.templateKey === "internal.incident_critical");
        if (i7Def) {
          const address = client.adresy?.[0]?.ulica_miasto || "";
          await enqueueNotification(tx, {
            notificationId: i7Def.id,
            idempotencyKey: `incident_critical:${inc.id}`,
            incidentId: inc.id,
            payload: {
              order_number: numer_zgloszenia,
              first_name: client.imie_i_nazwisko || "",
              address,
            },
          });
        }
      }

      // Potwierdzenie dla klienta (N15: incident.received)
      const n15Def = NOTIFICATIONS.find((n) => n.templateKey === "incident.received");
      if (n15Def && (client.email || client.telefon)) {
        await enqueueNotification(tx, {
          notificationId: n15Def.id,
          idempotencyKey: `incident_received:${inc.id}`,
          incidentId: inc.id,
          recipientOverride: (client.email || client.telefon) ?? undefined,
          payload: {
            first_name: client.imie_i_nazwisko || "",
            order_number: numer_zgloszenia,
            link: "/incidents",
          },
        });
      }
    });

    revalidatePath("/incidents");
    return { success: true, incidentId: createdId, numer_zgloszenia };
  } catch (error) {
    console.error("Failed to create incident:", error);
    return { success: false, error: "Nie udało się utworzyć zgłoszenia usterki." };
  }
}

export async function updateIncidentStatusAction(
  id: string,
  newStatus: "NOWE" | "W_TRAKCIE" | "OCZEKUJE_NA_CZESCI" | "ZAKONCZONE" | "ANULOWANE"
): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do zmiany statusu usterki." };
  }
  const access = actorRole ? can(actorRole, "incidents", "update") : "no";
  if (access !== "yes" && access !== "own") {
    return { success: false, error: "Brak uprawnień do zmiany statusu usterki." };
  }

  const incident = await prisma.usterki_incidents.findUnique({
    where: { id },
    include: { klient: true, instalacja: true },
  });
  if (!incident) {
    return { success: false, error: "Zgłoszenie nie istnieje." };
  }

  if (access === "own") {
    let user;
    try {
      ({ data: { user } } = await getCurrentUser());
    } catch (error) {
      console.error("Failed to resolve current user:", error);
      return { success: false, error: "Brak uprawnień do zmiany statusu usterki." };
    }
    if (!user?.email) {
      return { success: false, error: "Brak tożsamości użytkownika." };
    }
    const matches = await prisma.zespoly_monterskie.findMany({
      where: { email: user.email },
      take: 2,
    });
    if (matches.length !== 1 || matches[0].aktywny === false) {
      return { success: false, error: "Brak aktywnego przypisania montera." };
    }
    const ownId = matches[0].id;
    const isAssigned =
      incident.zespol_id === ownId ||
      (incident.zespol_id === null && incident.instalacja?.zespol_id === ownId);
    if (!isAssigned) {
      return { success: false, error: "Brak uprawnień do modyfikacji tego zgłoszenia." };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.usterki_incidents.update({
        where: { id },
        data: { status: newStatus },
      });

      // Powiadomienie klienta o naprawie (N18: incident.repaired)
      if (newStatus === "ZAKONCZONE") {
        const n18Def = NOTIFICATIONS.find((n) => n.templateKey === "incident.repaired");
        if (n18Def && incident.klient?.email) {
          await enqueueNotification(tx, {
            notificationId: n18Def.id,
            idempotencyKey: `incident_repaired:${id}`,
            incidentId: id,
            recipientOverride: incident.klient.email,
            payload: {
              first_name: incident.klient.imie_i_nazwisko || "",
              order_number: incident.numer_zgloszenia || id,
            },
          });
        }
      }
    });

    revalidatePath("/incidents");
    return { success: true };
  } catch (error) {
    console.error("Failed to update incident status:", error);
    return { success: false, error: "Nie udało się zaktualizować statusu." };
  }
}

export async function assignIncidentCrewAction(
  id: string,
  crewId: string | null
): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do przypisania serwisu." };
  }
  if (!actorRole || can(actorRole, "incidents", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do przypisania brygady do usterki." };
  }

  const incident = await prisma.usterki_incidents.findUnique({
    where: { id },
    include: { klient: true },
  });
  if (!incident) {
    return { success: false, error: "Zgłoszenie nie istnieje." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.usterki_incidents.update({
        where: { id },
        data: { zespol_id: crewId },
      });

      if (crewId) {
        const n16Def = NOTIFICATIONS.find((n) => n.templateKey === "incident.technician_assigned");
        if (n16Def && (incident.klient?.email || incident.klient?.telefon)) {
          await enqueueNotification(tx, {
            notificationId: n16Def.id,
            idempotencyKey: `incident_technician_assigned:${id}:${crewId}`,
            incidentId: id,
            recipientOverride: (incident.klient?.email || incident.klient?.telefon) ?? undefined,
            payload: {
              first_name: incident.klient?.imie_i_nazwisko || "",
              order_number: incident.numer_zgloszenia || id,
            },
          });
        }
      }
    });

    revalidatePath("/incidents");
    return { success: true };
  } catch (error) {
    console.error("Failed to assign crew:", error);
    return { success: false, error: "Nie udało się przypisać serwisu." };
  }
}

export type IncidentClientOption = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  installations: {
    id: string;
    label: string;
  }[];
};

export type IncidentCrewOption = {
  id: string;
  name: string;
};

export async function getIncidentFormDataAction(): Promise<{
  clients: IncidentClientOption[];
  crews: IncidentCrewOption[];
}> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { clients: [], crews: [] };
  }
  const clientAccess = actorRole ? can(actorRole, "clients", "read") : "no";
  const crewAccess = actorRole ? can(actorRole, "crews", "read") : "no";

  const [clients, crews] = await Promise.all([
    clientAccess === "yes"
      ? prisma.klienci.findMany({
          where: { anonymized_at: null },
          select: {
            id: true,
            imie_i_nazwisko: true,
            telefon: true,
            email: true,
            leady: {
              select: {
                id: true,
                project_number: true,
                instalacje: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
          orderBy: { imie_i_nazwisko: "asc" },
          take: 100,
        })
      : [],
    crewAccess === "yes"
      ? prisma.zespoly_monterskie.findMany({
          where: { aktywny: true },
          select: { id: true, nazwa: true },
          orderBy: { nazwa: "asc" },
        })
      : [],
  ]);

  return {
    clients: clients.map((c) => ({
      id: c.id,
      name: c.imie_i_nazwisko || "Bez nazwy",
      phone: c.telefon,
      email: c.email,
      installations: c.leady.flatMap((l) =>
        l.instalacje.map((inst) => ({
          id: inst.id,
          label: l.project_number ? `Projekt ${l.project_number}` : `Instalacja ${shortId(inst.id)}`,
        }))
      ),
    })),
    crews: crews.map((cr) => ({ id: cr.id, name: cr.nazwa })),
  };
}

export async function deleteIncidentAction(
  id: string,
  input: DeleteJustificationInput
): Promise<DeleteActionResult> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do usunięcia usterki." };
  }
  if (!actorRole || can(actorRole, "incidents", "delete") !== "yes") {
    return { success: false, error: "Brak uprawnień do usunięcia usterki." };
  }

  let actorEmail: string | undefined;
  try {
    const {
      data: { user },
    } = await getCurrentUser();
    actorEmail = user?.email;
  } catch (error) {
    console.error("Failed to resolve actor email:", error);
    return { success: false, error: "Brak uprawnień do usunięcia usterki." };
  }
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do usunięcia usterki." };
  }

  const parsed = deleteJustificationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane uzasadnienia lub podstawy prawnej." };
  }
  const { justification, legalBasis } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.usterki_incidents.delete({
        where: { id }
      });
      await tx.auditLog.create({
        data: {
          operation: 'delete',
          resource: 'incidents',
          recordId: id,
          actorEmail,
          actorRole,
          justification,
          legalBasis,
        },
      });
    });
    revalidatePath('/incidents');
    return { success: true };
  } catch (error) {
    console.error("Failed to delete incident:", error);
    return { success: false, error: "Nie udało się usunąć usterki." };
  }
}
