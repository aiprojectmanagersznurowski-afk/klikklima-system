import { QUEUE_POLICY } from "@klikklima/contracts";

interface LocalTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getLocalParts(date: Date, timezone: string): LocalTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const parsedHour = parseInt(map.hour, 10);
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour: parsedHour === 24 ? 0 : parsedHour,
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
  };
}

function makeDateInTimezone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timezone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const p = getLocalParts(utcGuess, timezone);
  const diffMinutes =
    (Date.UTC(year, month - 1, day, hour, minute, second) -
      Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)) /
    (60 * 1000);
  return new Date(utcGuess.getTime() + diffMinutes * 60 * 1000);
}

function parseWindowString(windowStr: string): { hour: number; minute: number } {
  const [hStr, mStr] = windowStr.split(":");
  return {
    hour: parseInt(hStr, 10),
    minute: parseInt(mStr, 10),
  };
}

export function isWithinSendWindow(channel: string, date: Date = new Date()): boolean {
  const sendWindow = (QUEUE_POLICY.sendWindow as Record<string, { from: string; to: string }>)[channel];
  if (!sendWindow) {
    return true;
  }

  const parts = getLocalParts(date, QUEUE_POLICY.timezone);
  const currentTotalMinutes = parts.hour * 60 + parts.minute;

  const from = parseWindowString(sendWindow.from);
  const to = parseWindowString(sendWindow.to);

  const fromMinutes = from.hour * 60 + from.minute;
  const toMinutes = to.hour * 60 + to.minute;

  return currentTotalMinutes >= fromMinutes && currentTotalMinutes < toMinutes;
}

export function getNextWindowStart(channel: string, date: Date = new Date()): Date {
  const sendWindow = (QUEUE_POLICY.sendWindow as Record<string, { from: string; to: string }>)[channel];
  if (!sendWindow) {
    return date;
  }

  const parts = getLocalParts(date, QUEUE_POLICY.timezone);
  const currentTotalMinutes = parts.hour * 60 + parts.minute;

  const from = parseWindowString(sendWindow.from);
  const fromMinutes = from.hour * 60 + from.minute;

  let targetYear = parts.year;
  let targetMonth = parts.month;
  let targetDay = parts.day;

  if (currentTotalMinutes >= fromMinutes) {
    // Okno na dziś już minęło lub trwa — następne okno jest jutro o godzinie sendWindow.from
    const tomorrowUtc = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay + 1));
    targetYear = tomorrowUtc.getUTCFullYear();
    targetMonth = tomorrowUtc.getUTCMonth() + 1;
    targetDay = tomorrowUtc.getUTCDate();
  }

  return makeDateInTimezone(
    targetYear,
    targetMonth,
    targetDay,
    from.hour,
    from.minute,
    0,
    QUEUE_POLICY.timezone
  );
}

export function calculateInitialAttemptTime(channel: string, date: Date = new Date()): Date | null {
  if (isWithinSendWindow(channel, date)) {
    return null;
  }
  return getNextWindowStart(channel, date);
}
