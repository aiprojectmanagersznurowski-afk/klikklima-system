import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

async function run() {
  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'],
    });
    
    const calendar = google.calendar({ version: 'v3', auth });
    
    // List all calendars the service account has access to
    const res = await calendar.calendarList.list();
    console.log('Calendars:', res.data.items?.map(c => ({ id: c.id, summary: c.summary })));
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}
run();
