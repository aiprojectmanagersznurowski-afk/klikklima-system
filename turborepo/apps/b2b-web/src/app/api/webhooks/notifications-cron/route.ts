import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { processNotificationQueue } from "../../../../lib/notifications/dispatcher";
import { verifyBearerToken } from "../../../../lib/security/webhook-auth";

export const dynamic = "force-dynamic";

/**
 * NTF-DISPATCH-CRON: Zamiatacz czasowy kolejki powiadomień wywoływany przez pg_cron / harmonogram zewnętrzny.
 * SEC-WEBHOOK-SECRET-REQUIRED: fail-closed ochrona sekretu CRON_SECRET.
 *
 * AUTHZ-EXEMPT: Zadanie crona zamiatania kolejki powiadomień wywoływane w tle przez webhook, chronione sekretem CRON_SECRET
 */
export async function POST(request: NextRequest) {
  const isAuthorized = verifyBearerToken(
    request.headers.get("authorization"),
    process.env.CRON_SECRET
  );

  if (!isAuthorized) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  try {
    const summary = await processNotificationQueue(prisma);
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
    });
  } catch (error) {
    console.error("Notifications cron webhook error:", error);
    return NextResponse.json(
      { success: false, error: "Błąd wykonania zadania cron powiadomień" },
      { status: 500 }
    );
  }
}
