import { fromZonedTime } from 'date-fns-tz';

const d = fromZonedTime("2026-06-19 08:00", "Europe/Warsaw");
console.log(d.toISOString());
