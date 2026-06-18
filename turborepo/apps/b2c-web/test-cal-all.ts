import { getAvailableSlots } from './app/actions/calendar';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

async function run() {
  const slots = await getAvailableSlots();
  console.log('All slots returned:');
  for (const s of slots.slice(0, 5)) {
    console.log(s.dateStr, s.slots);
  }
}
run();
