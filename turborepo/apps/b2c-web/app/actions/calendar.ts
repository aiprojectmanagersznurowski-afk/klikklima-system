"use server";

import { google } from 'googleapis';
import { addDays, startOfToday, endOfDay, parse, isWithinInterval, isWeekend } from 'date-fns';
import { pl } from 'date-fns/locale';

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
const HORIZON_DAYS = 60;
const TIME_SLOTS = ["08:00 - 10:00", "10:00 - 12:00", "12:00 - 14:00", "13:00 - 15:00"];

export interface AvailableSlot {
  dateStr: string; // ISO yyyy-MM-dd
  slots: string[]; // e.g. ["08:00 - 10:00", "10:00 - 12:00"]
}

export async function getAvailableSlots(): Promise<AvailableSlot[]> {
  try {
    const auth = getGoogleAuth();
    const calendar = google.calendar({ version: 'v3', auth });

    const today = startOfToday();
    const endDate = addDays(today, HORIZON_DAYS);

    // Pobranie zablokowanych (busy) przedziałów z Google Calendar
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: today.toISOString(),
        timeMax: endDate.toISOString(),
        timeZone: 'Europe/Warsaw',
        items: [{ id: CALENDAR_ID }]
      }
    });

    const busyIntervals = response.data.calendars?.[CALENDAR_ID]?.busy || [];

    const availableDays: AvailableSlot[] = [];

    // Generujemy dostępne dni i sprawdzamy kolizje w każdym dniu
    for (let i = 1; i <= HORIZON_DAYS; i++) { // Zaczynamy od i=1 (czyli od jutra)
      const currentDate = addDays(today, i);
      
      // Pomijamy weekendy
      if (isWeekend(currentDate)) {
        continue;
      }

      const dateStr = currentDate.toISOString().split('T')[0];
      const availableSlotsForDay: string[] = [];

      for (const slotStr of TIME_SLOTS) {
        const [startStr, endStr] = slotStr.split(' - ');
        
        // Tworzymy obiekty dat dla początku i końca sprawdzanego slotu
        const slotStart = parse(`${dateStr} ${startStr}`, 'yyyy-MM-dd HH:mm', new Date());
        const slotEnd = parse(`${dateStr} ${endStr}`, 'yyyy-MM-dd HH:mm', new Date());

        // Sprawdzamy czy slot nakłada się z jakimkolwiek wydarzeniem "busy" z kalendarza
        const isConflict = busyIntervals.some(busy => {
          if (!busy.start || !busy.end) return false;
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);

          // Nakładanie się przedziałów (A_start < B_end && A_end > B_start)
          return (slotStart < busyEnd && slotEnd > busyStart);
        });

        if (!isConflict) {
          availableSlotsForDay.push(slotStr);
        }
      }

      // Jeśli dany dzień ma jakiekolwiek wolne sloty, dodajemy go do listy
      if (availableSlotsForDay.length > 0) {
        availableDays.push({
          dateStr,
          slots: availableSlotsForDay
        });
      }
    }

    return availableDays;
  } catch (error) {
    console.error("Błąd podczas pobierania terminów Google Calendar:", error);
    // Zwracamy pustą tablicę lub fallback w razie błędu
    return [];
  }
}

export async function createCalendarEvent(leadName: string, phone: string, address: string, bookingDateStr: string, bookingSlotStr: string) {
  try {
    const auth = getGoogleAuth();
    const calendar = google.calendar({ version: 'v3', auth });

    const dateOnlyStr = bookingDateStr.split('T')[0]; // "yyyy-MM-dd"
    const [startStr, endStr] = bookingSlotStr.split(' - ');
    
    const startDateTime = parse(`${dateOnlyStr} ${startStr}`, 'yyyy-MM-dd HH:mm', new Date());
    const endDateTime = parse(`${dateOnlyStr} ${endStr}`, 'yyyy-MM-dd HH:mm', new Date());

    const event = {
      summary: `Audyt KlikKlima: ${leadName}`,
      location: address,
      description: `Wizyta umówiona z kalkulatora (Triage).\nTelefon klienta: ${phone}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'Europe/Warsaw',
      },
      end: {
        dateTime: endDateTime.toISOString(),
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
