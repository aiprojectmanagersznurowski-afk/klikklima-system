import { getAvailableSlots } from './app/actions/calendar';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

async function run() {
  console.log('Testing Google Calendar...');
  try {
    const slots = await getAvailableSlots();
    console.log('Slots length:', slots.length);
    if(slots.length > 0) {
      console.log('First day:', JSON.stringify(slots[0], null, 2));
    }
  } catch (e) {
    console.error('Error:', e);
  }
}
run();
