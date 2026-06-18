import { getAvailableSlots } from './app/actions/calendar';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

async function run() {
  const slots = await getAvailableSlots();
  const day19 = slots.find(s => s.dateStr === '2026-06-19');
  console.log('June 19:', day19);
}
run();
