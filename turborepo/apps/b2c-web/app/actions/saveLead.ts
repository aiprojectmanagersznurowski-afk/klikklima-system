"use server";

import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabaseClient";
import { createCalendarEvent } from "./calendar";
import { prisma } from "@repo/database";
import { createBooking } from "@repo/scheduling";

export interface SaveLeadData {
  name: string;
  email: string;
  phone: string;
  address: string;
  startAtIso: string;
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

    // 3. Utwórz Lead. `leadId` generowany serwerowo (B2C-BOOKING-SLOT, AC7) — jest to
    // jedyny sposób zaadresowania `createBooking({ subject: { kind: 'LEAD', leadId } })`
    // bez `.select()` (SEC-RLS-BASELINE). `data_rezerwacji` NIE jest ustawiane tutaj —
    // zależy od wyniku `createBooking`, którego jeszcze nie znamy (D-6 wariant (a),
    // FK `Booking.lead` wymaga, żeby lead istniał PRZED próbą rezerwacji).
    let estimatedQuote = null;
    if (data.triageData?.priceDevices || data.triageData?.priceInstallation) {
      const total = (data.triageData.priceDevices || 0) + (data.triageData.priceInstallation || 0);
      if (total > 0) {
        estimatedQuote = `${total} PLN netto`;
      }
    }

    const leadId = randomUUID();
    const { error: leadError } = await supabase
      .from('leady')
      .insert({
        id: leadId,
        klient_id: klientId,
        adres_id: adresId,
        odpowiedzi_triage: data.triageData,
        estymowana_wycena: estimatedQuote,
        status: 'NEW_LEAD',
        data_rezerwacji: null
      });

    if (leadError) throw new Error(`Błąd tworzenia leada: ${leadError.message}`);

    // 4. Rozwiąż koszyk AUDIT (kod -> UUID) po stronie serwera — klient nie przysyła
    // ani koszyka, ani `bookedBy` (D-3, AC5).
    const auditBasket = await prisma.visitDurationBasket.findFirst({
      where: { code: 'AUDIT', isActive: true },
    });

    if (!auditBasket) {
      return {
        success: false,
        code: 'BASKET_NOT_FOUND',
        message: 'Koszyk audytu jest chwilowo niedostępny — spróbuj ponownie później.',
      };
    }

    // 5. Rezerwacja terminu — jedna implementacja domenowa (@repo/scheduling, AC6).
    // `visitBasketId` i `bookedBy` pochodzą WYŁĄCZNIE z serwera; jakiekolwiek dodatkowe
    // pola dołączone do żądania klienta (visitBasketId, bookedBy, resource_id, leadId,
    // status, ...) NIE są honorowane — nie istnieją w tym obiekcie.
    const bookingResult = await createBooking({
      visitBasketId: auditBasket.id,
      startAt: new Date(data.startAtIso),
      subject: { kind: 'LEAD', leadId },
      bookedBy: 'CLIENT',
    });

    if (!bookingResult.ok) {
      // D-6 wariant (a): klient/adres/lead ZOSTAJĄ zapisane — żaden nie jest kasowany
      // ani wycofywany. Kod błędu domenowy jest przekazywany dalej, bez surowego SQLSTATE
      // (createBooking już go opakował).
      return {
        success: false,
        code: bookingResult.error.code,
        message: bookingResult.error.message,
        alternatives: bookingResult.error.alternatives,
      };
    }

    // 6. `leady.data_rezerwacji` ustawiane WYŁĄCZNIE po udanej rezerwacji, osobnym
    // UPDATE (nie w INSERT z kroku 3).
    const { error: updateError } = await supabase
      .from('leady')
      .update({ data_rezerwacji: bookingResult.booking.scheduledStart.toISOString() })
      .eq('id', leadId);

    if (updateError) {
      console.warn("Rezerwacja utworzona, ale nie udało się zapisać daty rezerwacji na leadzie:", updateError.message);
    }

    // 7. Kopia informacyjna w Google Calendar — best-effort, wywoływana PO udanej
    // rezerwacji; awaria integracji nie przerywa flow klienta (WO, "Google Calendar").
    const calendarResult = await createCalendarEvent(
      data.name,
      data.phone,
      data.address,
      bookingResult.booking.scheduledStart,
      bookingResult.booking.scheduledEnd
    );

    if (!calendarResult.success) {
      console.warn("Rezerwacja zapisana w Supabase, ale wystąpił błąd z Google Calendar:", calendarResult.error);
    }

    return { success: true };
  } catch (err: any) {
    console.error("saveLead Error:", err);
    return { success: false, error: err.message };
  }
}
