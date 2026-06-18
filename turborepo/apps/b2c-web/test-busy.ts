import { google } from 'googleapis';
import dotenv from 'dotenv';
import { startOfToday, addDays } from 'date-fns';
dotenv.config({ path: '../../.env' });

async function run() {
  console.log('Testing Google Calendar FreeBusy...');
  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
    });
    
    const calendar = google.calendar({ version: 'v3', auth });
    const calId = process.env.GOOGLE_CALENDAR_ID || '';
    
    console.log('Querying freebusy for:', calId);
    
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: startOfToday().toISOString(),
        timeMax: addDays(startOfToday(), 7).toISOString(),
        timeZone: 'Europe/Warsaw',
        items: [{ id: calId }]
      }
    });
    
    console.log('Errors:', response.data.calendars?.[calId]?.errors);
    console.log('Busy intervals (next 7 days):', JSON.stringify(response.data.calendars?.[calId]?.busy, null, 2));
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}
run();
