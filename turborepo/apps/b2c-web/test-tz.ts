import { parse } from 'date-fns';

const dateStr = "2026-06-19";
const startStr = "08:00";
const endStr = "12:00";

const slotStart = parse(`${dateStr} ${startStr}`, 'yyyy-MM-dd HH:mm', new Date());
const slotEnd = parse(`${dateStr} ${endStr}`, 'yyyy-MM-dd HH:mm', new Date());

console.log('slotStart:', slotStart.toISOString());
console.log('slotEnd:', slotEnd.toISOString());

const busyStart = new Date("2026-06-19T08:00:00+02:00");
const busyEnd = new Date("2026-06-19T12:00:00+02:00");

console.log('busyStart:', busyStart.toISOString());
console.log('busyEnd:', busyEnd.toISOString());

console.log('isConflict?', slotStart < busyEnd && slotEnd > busyStart);

