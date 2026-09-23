import { describe, it, expect } from "vitest";
import { QUEUE_POLICY } from "@klikklima/contracts";
import {
  isWithinSendWindow,
  getNextWindowStart,
  calculateInitialAttemptTime,
} from "../src/lib/notifications/window";

describe("NTF-QUEUE-WINDOW — Okna czasowe wysyłki powiadomień", () => {
  // @REQ: NTF-QUEUE-WINDOW
  it("SMS wysyłany wyłącznie w oknie zdefiniowanym w QUEUE_POLICY (8:00–18:00 Europe/Warsaw)", () => {
    expect(QUEUE_POLICY.sendWindow.SMS.from).toBe("08:00");
    expect(QUEUE_POLICY.sendWindow.SMS.to).toBe("18:00");
    expect(QUEUE_POLICY.timezone).toBe("Europe/Warsaw");

    // Godzina 07:15 czasu warszawskiego (przed oknem)
    const beforeWindow = new Date("2026-06-15T07:15:00+02:00");
    expect(isWithinSendWindow("SMS", beforeWindow)).toBe(false);

    // Godzina 11:30 czasu warszawskiego (w oknie)
    const insideWindow = new Date("2026-06-15T11:30:00+02:00");
    expect(isWithinSendWindow("SMS", insideWindow)).toBe(true);

    // Godzina 18:05 czasu warszawskiego (po oknie)
    const afterWindow = new Date("2026-06-15T18:05:00+02:00");
    expect(isWithinSendWindow("SMS", afterWindow)).toBe(false);

    // Godzina 23:45 czasu warszawskiego (w nocy)
    const nightTime = new Date("2026-06-15T23:45:00+02:00");
    expect(isWithinSendWindow("SMS", nightTime)).toBe(false);
  });

  // @REQ: NTF-QUEUE-WINDOW
  it("kanały EMAIL i PUSH mają okno całodobowe 00:00–23:59", () => {
    const nightTime = new Date("2026-06-15T03:15:00+02:00");
    expect(isWithinSendWindow("EMAIL", nightTime)).toBe(true);
    expect(isWithinSendWindow("PUSH", nightTime)).toBe(true);
  });

  // @REQ: NTF-QUEUE-WINDOW
  it("przesunięcie poza oknem SMS wylicza najbliższy początek okna (08:00 Europe/Warsaw) bez gubienia wiadomości", () => {
    // SMS zakolejkowany o 06:30 rano -> powinien zostać zaplanowany na dziś o 08:00
    const morningEarly = new Date("2026-06-15T06:30:00+02:00");
    const nextStartMorning = getNextWindowStart("SMS", morningEarly);
    expect(nextStartMorning.toISOString()).toBe(new Date("2026-06-15T08:00:00+02:00").toISOString());

    // SMS zakolejkowany o 20:00 wieczorem -> powinien zostać zaplanowany na jutro o 08:00
    const eveningLate = new Date("2026-06-15T20:00:00+02:00");
    const nextStartEvening = getNextWindowStart("SMS", eveningLate);
    expect(nextStartEvening.toISOString()).toBe(new Date("2026-06-16T08:00:00+02:00").toISOString());
  });

  // @REQ: NTF-QUEUE-WINDOW
  it("calculateInitialAttemptTime zwraca null w oknie i datę startu okna poza oknem", () => {
    const inside = new Date("2026-06-15T12:00:00+02:00");
    expect(calculateInitialAttemptTime("SMS", inside)).toBeNull();

    const outside = new Date("2026-06-15T22:00:00+02:00");
    const planned = calculateInitialAttemptTime("SMS", outside);
    expect(planned).not.toBeNull();
    expect(planned?.toISOString()).toBe(new Date("2026-06-16T08:00:00+02:00").toISOString());
  });
});
