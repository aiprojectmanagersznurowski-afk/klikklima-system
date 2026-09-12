import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@repo/database"

export const dynamic = "force-dynamic"

type ShippingStatus = "PENDING" | "SHIPPED" | "DELIVERED"

const shippingWebhookSchema = z.object({
  tracking_id: z.string().min(1, "Numer śledzenia przesyłki jest wymagany"),
  status: z.enum(["DELIVERED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "EXCEPTION", "FAILED"]),
  delivered_at: z.string().optional(),
  courier: z.string().optional(),
})

/**
 * FNL-E6-E7 / T08: Webhook kurierski (np. DPD, InPost, DHL, Rohlig Suus).
 * Po odebraniu statusu DELIVERED przesuwa leada ze statusu HARDWARE_IN_TRANSIT
 * na AWAITING_INSTALLATION (E7) i aktualizuje status przesyłki w logistyce.
 */
export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get("x-webhook-secret")
  const expectedSecret = process.env.SHIPPING_WEBHOOK_SECRET

  if (expectedSecret && secretHeader !== expectedSecret) {
    return NextResponse.json({ error: "Brak autoryzacji webhooka" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy format JSON" }, { status: 400 })
  }

  const parsed = shippingWebhookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Błąd walidacji danych", details: parsed.error.format() },
      { status: 422 }
    )
  }

  const { tracking_id, status } = parsed.data

  try {
    const shipment = await prisma.logistyka_zamowienia.findFirst({
      where: { tracking_id },
      include: { lead: true },
      orderBy: { created_at: "desc" },
    })

    if (!shipment) {
      return NextResponse.json(
        { error: `Nie znaleziono zlecenia logistycznego dla numeru ${tracking_id}` },
        { status: 404 }
      )
    }

    if (status === "DELIVERED") {
      // FNL-E6-E7: Przejście T08 — doręczenie sprzętu przed instalacją
      if (shipment.lead.status === "HARDWARE_IN_TRANSIT") {
        await prisma.$transaction(async (tx) => {
          await tx.leady.update({
            where: { id: shipment.lead_id },
            data: { status: "AWAITING_INSTALLATION" },
          })

          await tx.logistyka_zamowienia.update({
            where: { id: shipment.id },
            data: { status_wysylki: "DELIVERED" },
          })
        })

        revalidatePath("/logistics")
        revalidatePath("/leads")

        return NextResponse.json({
          success: true,
          lead_id: shipment.lead_id,
          transition: "T08",
          new_status: "AWAITING_INSTALLATION",
        })
      }

      // Idempotency: jeśli lead już jest w AWAITING_INSTALLATION lub dalszym etapie
      if (shipment.status_wysylki !== "DELIVERED") {
        await prisma.logistyka_zamowienia.update({
          where: { id: shipment.id },
          data: { status_wysylki: "DELIVERED" },
        })
      }

      return NextResponse.json({
        success: true,
        already_advanced: true,
        lead_id: shipment.lead_id,
        current_status: shipment.lead.status,
      })
    }

    // Inne statusy (np. IN_TRANSIT, EXCEPTION)
    const dbStatus: ShippingStatus =
      status === "IN_TRANSIT" || status === "OUT_FOR_DELIVERY"
        ? "SHIPPED"
        : "PENDING"

    await prisma.logistyka_zamowienia.update({
      where: { id: shipment.id },
      data: { status_wysylki: dbStatus },
    })

    return NextResponse.json({
      success: true,
      updated_shipment_status: status,
      db_status: dbStatus,
      lead_id: shipment.lead_id,
    })
  } catch (error) {
    console.error("Shipping webhook processing error:", error)
    return NextResponse.json(
      { error: "Błąd serwera podczas przetwarzania webhooka" },
      { status: 500 }
    )
  }
}
