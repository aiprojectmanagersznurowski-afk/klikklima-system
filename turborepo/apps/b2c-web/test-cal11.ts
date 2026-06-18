import { getAvailableSlots } from './app/actions/calendar';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

async function run() {
  const slots = await getAvailableSlots();
}
run();
