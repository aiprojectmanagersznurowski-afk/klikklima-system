"use server";

import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabaseClient";
import { createCalendarEvent } from "./calendar";

export interface SaveLeadData {
  name: string;
  email: string;
  phone: string;
  address: string;
  bookingDate: string;
  bookingSlot: string;
  triageData: any;
  lat?: number;
  lng?: number;
}

// FLD-GEO-COORDS: normalizuje współrzędne do number|null przed insertem na `adresy`.
// `??` (nie `||`), żeby 0 (poprawna wartość) nie stał się `null`; `Number(...)`, żeby
// wejście typu string (np. z ręcznie sklejonego żądania) trafiło do kolumny
// `double precision` jako liczba, nie jako tekst.
function toNullableCoordinate(value: number | string | undefined): number | null {
  return value === undefined ? null : Number(value);
}

export async function saveLead(data: SaveLeadData) {
  try {
    // 1. Zapisz klienta
    // SEC-RLS-BASELINE: `id` generowane tu, nie odczytywane przez `.select().single()`
    // (INSERT ... RETURNING) — `anon` ma na `klienci` wyłącznie politykę INSERT, nie SELECT,
    // żeby REST API nie ujawniało danych kontaktowych wszystkich klientów.
    const klientId = randomUUID();
    const { error: klientError } = await supabase
      .from('klienci')
      .insert({
        id: klientId,
        imie_i_nazwisko: data.name,
        email: data.email,
        telefon: data.phone
      });

    if (klientError) throw new Error(`Błąd tworzenia klienta: ${klientError.message}`);

    // 2. Zapisz adres powiązany z klientem (FLD-GEO-COORDS: latitude/longitude w
    // TYM SAMYM insercie co reszta adresu — B2C-LEAD-ATOMIC).
    // SEC-RLS-BASELINE: analogicznie do klienci — `id` generowane tu, brak `.select()`.
    const adresId = randomUUID();
    const { error: adresError } = await supabase
      .from('adresy')
      .insert({
        id: adresId,
        klient_id: klientId,
        ulica_miasto: data.address,
        latitude: toNullableCoordinate(data.lat),
        longitude: toNullableCoordinate(data.lng)
      });

    if (adresError) throw new Error(`Błąd tworzenia adresu: ${adresError.message}`);

    // 3. Połącz w pełną datę rezerwacji (Data + Godzina z wybranego slotu)
    const startTimeStr = data.bookingSlot.split(' - ')[0];
    const dateObj = new Date(data.bookingDate);
    const [hours, minutes] = startTimeStr.split(':');
    dateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

    // 4. Utwórz Lead
    let estimatedQuote = null;
    if (data.triageData?.priceDevices || data.triageData?.priceInstallation) {
      const total = (data.triageData.priceDevices || 0) + (data.triageData.priceInstallation || 0);
      if (total > 0) {
        estimatedQuote = `${total} PLN netto`;
      }
    }

    const { error: leadError } = await supabase
      .from('leady')
      .insert({
        klient_id: klientId,
        adres_id: adresId,
        odpowiedzi_triage: data.triageData,
        estymowana_wycena: estimatedQuote,
        status: 'NEW_LEAD',
        data_rezerwacji: dateObj.toISOString()
      });

    if (leadError) throw new Error(`Błąd tworzenia leada: ${leadError.message}`);

    // 5. Utwórz wydarzenie w kalendarzu Google
    const calendarResult = await createCalendarEvent(
      data.name,
      data.phone,
      data.address,
      data.bookingDate,
      data.bookingSlot
    );

    if (!calendarResult.success) {
      console.warn("Rezerwacja zapisana w Supabase, ale wystąpił błąd z Google Calendar:", calendarResult.error);
      // Opcjonalnie: Nie przerywamy flow klienta z powodu awarii API Google
    }

    return { success: true };
  } catch (err: any) {
    console.error("saveLead Error:", err);
    return { success: false, error: err.message };
  }
}
