import { fromZonedTime } from 'date-fns-tz';
import { isWeekend, addDays } from 'date-fns';

const todayStr = '2026-06-18';
const todayWarsaw = fromZonedTime(`${todayStr} 00:00`, 'Europe/Warsaw');

for (let i = 0; i < 5; i++) {
  const d = addDays(todayWarsaw, i);
  console.log(`Day +${i}: ${d.toISOString()} isWeekend: ${isWeekend(d)} (UTC day: ${d.getUTCDay()})`);
}
