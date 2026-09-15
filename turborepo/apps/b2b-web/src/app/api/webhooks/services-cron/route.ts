import { NextRequest, NextResponse } from "next/server"
import { runServiceInspectionCron } from "../../../(dashboard)/services/cron"

export const dynamic = "force-dynamic"

/**
 * CRM-SRV-TRIGGER: Webhook / Cron trigger dla nocnego zadania sprawdzania
 * terminów serwisów gwarancyjnych i generowania powiadomień N10.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 })
  }

  try {
    const summary = await runServiceInspectionCron()
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
    })
  } catch (error) {
    console.error("Services cron webhook error:", error)
    return NextResponse.json(
      { success: false, error: "Błąd wykonania zadania cron" },
      { status: 500 }
    )
  }
}
