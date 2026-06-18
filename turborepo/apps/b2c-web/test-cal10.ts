import { fromZonedTime } from 'date-fns-tz';

const busy = {
  "start": "2026-06-19T08:00:00+02:00",
  "end": "2026-06-19T12:00:00+02:00"
};

const busyStart = new Date(busy.start);
const busyEnd = new Date(busy.end);

const startStr = "08:00";
const endStr = "10:00";
const dateStr = "2026-06-19";

const slotStart = fromZonedTime(`${dateStr} ${startStr}`, 'Europe/Warsaw');
const slotEnd = fromZonedTime(`${dateStr} ${endStr}`, 'Europe/Warsaw');

console.log('busyStart:', busyStart.toISOString());
console.log('busyEnd:', busyEnd.toISOString());
console.log('slotStart:', slotStart.toISOString());
console.log('slotEnd:', slotEnd.toISOString());

const isConflict = (slotStart < busyEnd && slotEnd > busyStart);
console.log('isConflict?', isConflict);

