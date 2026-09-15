"use server";

import { google } from 'googleapis';

// Konfiguracja autoryzacji Google
const getGoogleAuth = () => {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Brak konfiguracji uwierzytelniania Google Calendar w zmiennych środowiskowych.');
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
  });
};

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

// B2C-BOOKING-SLOT: odczyt terminów (getAvailableSlots, TIME_SLOTS, HORIZON_DAYS,
// freebusy.query) ZNIKA z tego pliku — źródłem prawdy dla terminów audytu są `bookings`
// + `absences` przez `@repo/scheduling` (`getAuditSlots.ts`), nie Google Calendar.
// `createCalendarEvent` ZOSTAJE jako jednokierunkowa, best-effort kopia informacyjna
// wywoływana PO udanej rezerwacji (WO, "Architektura docelowa → Google Calendar").

export async function createCalendarEvent(leadName: string, phone: string, address: string, startAt: Date, endAt: Date) {
  try {
    const auth = getGoogleAuth();
    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
      summary: `Audyt KlikKlima: ${leadName}`,
      location: address,
      description: `Wizyta umówiona z kalkulatora (Triage).\nTelefon klienta: ${phone}`,
      start: {
        dateTime: startAt.toISOString(),
        timeZone: 'Europe/Warsaw',
      },
      end: {
        dateTime: endAt.toISOString(),
        timeZone: 'Europe/Warsaw',
      },
    };

    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: event,
    });

    console.log("Utworzono wydarzenie w kalendarzu:", response.data.htmlLink);
    return { success: true, eventLink: response.data.htmlLink };
  } catch (error) {
    console.error("Błąd podczas tworzenia wydarzenia w Google Calendar:", error);
    return { success: false, error };
  }
}
