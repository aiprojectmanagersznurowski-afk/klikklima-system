import { parse } from 'date-fns';

const dateStr = '2026-06-19';
const busyStart = new Date("2026-06-19T08:00:00+02:00");
const busyEnd = new Date("2026-06-19T12:00:00+02:00");

for (const slotStr of ["08:00 - 10:00", "10:00 - 12:00", "12:00 - 14:00", "13:00 - 15:00"]) {
  const [startStr, endStr] = slotStr.split(' - ');
  const slotStart = parse(`${dateStr} ${startStr}`, 'yyyy-MM-dd HH:mm', new Date());
  const slotEnd = parse(`${dateStr} ${endStr}`, 'yyyy-MM-dd HH:mm', new Date());

  const isConflict = (slotStart < busyEnd && slotEnd > busyStart);
  console.log(`Slot ${slotStr} | start: ${slotStart.toISOString()} | end: ${slotEnd.toISOString()}`);
  console.log(`Busy: ${busyStart.toISOString()} to ${busyEnd.toISOString()} | Conflict: ${isConflict}`);
}
