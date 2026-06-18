import { getAvailableSlots } from './app/actions/calendar';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log('Testing Google Calendar...');
  try {
    const slots = await getAvailableSlots();
    console.log('Slots:', JSON.stringify(slots, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}
run();
