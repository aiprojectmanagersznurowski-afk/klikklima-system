import { prisma } from "@repo/database"
import { NOTIFICATIONS, SLA } from "@klikklima/contracts"
import { enqueueNotification } from "../logistics/rollback-effects"

export type CronExecutionResult = {
  inspectedCount: number;
  servicesCreatedCount: number;
  notificationsQueuedCount: number;
  errors: string[];
};

/**
 * CRM-SRV-TRIGGER / SRV-REMINDER-ONCE / SRV-SOURCE-OF-TRUTH:
 * Nocny job sprawdzający instalacje, dla których zbliża się termin przeglądu
 * gwarancyjnego (SLA.SERVICE_REMINDER_LEAD.days — domyślnie 30 dni).
 * Tworzy rekord serwisu (PLANNED) i kolejkuje powiadomienie N10 dla klienta.
 * Idempotentny — wielokrotne uruchomienie nie duplikuje wierszy serwisu ani powiadomień.
 */
export async function runServiceInspectionCron(referenceDate = new Date()): Promise<CronExecutionResult> {
  const result: CronExecutionResult = {
    inspectedCount: 0,
    servicesCreatedCount: 0,
    notificationsQueuedCount: 0,
    errors: [],
  }

  // Wyliczamy próg daty za pomocą setDate bez mnożenia literałów (ADR-011)
  const thresholdDate = new Date(referenceDate)
  thresholdDate.setDate(thresholdDate.getDate() + SLA.SERVICE_REMINDER_LEAD.days)

  try {
    // Szukamy instalacji z wyznaczonym next_service_date w oknie przypomnienia
    const candidateInstallations = await prisma.instalacje.findMany({
      where: {
        status: "COMPLETED",
        next_service_date: {
          not: null,
          lte: thresholdDate,
        },
      },
      include: {
        lead: {
          include: {
            klient: true,
          },
        },
        serwisy: {
          where: {
            status: {
              in: ["PLANNED", "SCHEDULED"],
            },
          },
        },
      },
    })

    result.inspectedCount = candidateInstallations.length

    const n10Def = NOTIFICATIONS.find((n) => n.templateKey === "service.reminder")

    for (const inst of candidateInstallations) {
      if (!inst.next_service_date || !inst.lead?.klient) {
        continue
      }

      const client = inst.lead.klient
      const nextDate = new Date(inst.next_service_date)
      const yearMonthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`
      const idempotencyKey = `service_reminder:${inst.id}:${yearMonthKey}`

      try {
        await prisma.$transaction(async (tx) => {
          let serviceId: string | null = null

          // 1. Jeśli nie ma jeszcze aktywnego rekordu serwisu dla tego cyklu, utwórz go
          if (inst.serwisy.length === 0) {
            const nextDateStr = inst.next_service_date
              ? new Date(inst.next_service_date).toISOString().slice(0, 10)
              : ""
            const newService = await tx.serwisy.create({
              data: {
                klient_id: client.id,
                adres_id: inst.lead.adres_id,
                instalacja_id: inst.id,
                zespol_id: inst.zespol_id,
                status: "PLANNED",
                opis_usterki: `Cykliczny przegląd gwarancyjny (termin: ${nextDateStr})`,
              },
            })
            serviceId = newService.id
            result.servicesCreatedCount++
          } else {
            serviceId = inst.serwisy[0].id
          }

          // 2. Zakolejkuj N10 (service.reminder) z kluczem idempotencji per cykl roczny
          if (n10Def && (client.email || client.telefon)) {
            const dateFormatted = `${String(nextDate.getDate()).padStart(2, "0")}.${String(nextDate.getMonth() + 1).padStart(2, "0")}.${nextDate.getFullYear()}`
            const queued = await enqueueNotification(tx, {
              notificationId: n10Def.id,
              idempotencyKey,
              installationId: inst.id,
              recipientOverride: (client.email || client.telefon) ?? undefined,
              payload: {
                first_name: client.imie_i_nazwisko || "",
                date: dateFormatted,
                link: "/services",
              },
            })

            const newlyCreated = queued.some((q) => q.created)
            if (newlyCreated) {
              result.notificationsQueuedCount++
            }
          }
        })
      } catch (itemError) {
        const msg = `Błąd przetwarzania instalacji ${inst.id}: ${itemError instanceof Error ? itemError.message : String(itemError)}`
        console.error(msg)
        result.errors.push(msg)
      }
    }
  } catch (err) {
    const msg = `Błąd zapytania w cronie serwisów: ${err instanceof Error ? err.message : String(err)}`
    console.error(msg)
    result.errors.push(msg)
  }

  return result
}
