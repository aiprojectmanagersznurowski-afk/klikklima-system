import { addDays, startOfToday, isWeekend } from 'date-fns';

const today = startOfToday();
for(let i=0; i<7; i++) {
  const d = addDays(today, i);
  console.log(`Day +${i}: ${d.toISOString()} | isWeekend: ${isWeekend(d)} | DayOfWeek: ${d.getDay()}`);
}
