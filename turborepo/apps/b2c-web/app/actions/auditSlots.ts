"use server";

import { prisma } from "@repo/database";
import { findPoolSlots } from "@repo/scheduling";
import { formatInTimeZone } from "date-fns-tz";

/**
 * WO: docs/workorders/B2C-BOOKING-SLOT.md — "Architektura docelowa → Odczyt terminów".
 * Zastępuje `getAvailableSlots` (Google Calendar) jako źródło terminów audytu dla
 * `Step8Booking.tsx`. Bez cache, bez parametrów od klienta (D-3) — zakres dat i koszyk
 * są ustalane wyłącznie po stronie serwera.
 */

const TIME_ZONE = "Europe/Warsaw";
const HORIZON_DAYS = 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type AuditSlot = { startAtIso: string; endAtIso: string; label: string };
export type AuditDay = { dateStr: string; slots: AuditSlot[] };
export type AuditSlotsResult = { days: AuditDay[]; error: string | null };

function emptyResult(error: string): AuditSlotsResult {
  return { days: [], error };
}

export async function getAuditSlots(): Promise<AuditSlotsResult> {
  const basket = await prisma.visitDurationBasket.findFirst({
    where: { code: "AUDIT", isActive: true },
  });

  if (!basket) {
    return emptyResult("Brak dostępnych terminów — koszyk audytu jest chwilowo niedostępny.");
  }

  const now = new Date();
  const to = new Date(now.getTime() + HORIZON_DAYS * MS_PER_DAY);

  const poolResult = await findPoolSlots(basket.id, { from: now, to });

  if (poolResult.error) {
    return { days: [], error: poolResult.error };
  }

  const daysByDate = new Map<string, AuditDay>();

  for (const slot of poolResult.slots) {
    const dateStr = formatInTimeZone(slot.start_at, TIME_ZONE, "yyyy-MM-dd");
    const label = `${formatInTimeZone(slot.start_at, TIME_ZONE, "HH:mm")} - ${formatInTimeZone(slot.end_at, TIME_ZONE, "HH:mm")}`;

    let day = daysByDate.get(dateStr);
    if (!day) {
      day = { dateStr, slots: [] };
      daysByDate.set(dateStr, day);
    }

    day.slots.push({
      startAtIso: slot.start_at.toISOString(),
      endAtIso: slot.end_at.toISOString(),
      label,
    });
  }

  const days = Array.from(daysByDate.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  return { days, error: null };
}
