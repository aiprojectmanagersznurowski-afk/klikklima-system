import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "./format-date";

// Normalizacja do polnocy Europe/Warsaw jako czysta liczba dni (arytmetyka na
// UTC-milisekundach), zeby wynik byl niezalezny od strefy czasowej hosta i
// odporny na przejscia DST. Patrz WO "Przypadki brzegowe" - strefa czasowa.
export function zonedMidnightUtc(date: Date): Date {
  const ymd = formatInTimeZone(date, APP_TIMEZONE, "yyyy-MM-dd");
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function daysUntilService(targetDate: Date, referenceDate: Date = new Date()): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const target = zonedMidnightUtc(targetDate);
  const reference = zonedMidnightUtc(referenceDate);
  return Math.round((target.getTime() - reference.getTime()) / msPerDay);
}
