import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

async function run() {
  const { getAvailableSlots } = await import('./app/actions/calendar');
  const slots = await getAvailableSlots();
}
run();
