"use server";

import { createClient } from '@supabase/supabase-js';
import { startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { prisma } from '@repo/database';
import { findPoolSlots } from '@repo/scheduling';

export interface FomoData {
  slots: number;
  period: string; // np. "w tym tygodniu" lub "w przyszłym tygodniu"
}

export async function getFomoSlots(): Promise<FomoData> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Używamy Service Role Key, żeby móc odpytywać leady i omijać RLS w bezpiecznym środowisku serwera
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Pobieramy limit z konfiguracji
    const { data: configData } = await supabaseAdmin
      .from('system_config')
      .select('konfiguracja')
      .eq('typ_konfiguracji', 'fomo_config')
      .single();

    const limit = configData?.konfiguracja?.weekly_audit_limit || 10;

    // 2. Ustalamy daty na "ten tydzień"
    const now = new Date();
    const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 }); // Poniedziałek
    const endOfThisWeek = endOfWeek(now, { weekStartsOn: 1 });

    // 3. Zliczamy zajęte w tym tygodniu
    const { count: countThisWeek, error: errThisWeek } = await supabaseAdmin
      .from('leady')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Umówiony Audyt')
      .gte('data_rezerwacji', startOfThisWeek.toISOString())
      .lte('data_rezerwacji', endOfThisWeek.toISOString());

    if (errThisWeek) throw errThisWeek;

    const bookedThisWeek = countThisWeek || 0;
    let availableThisWeek = limit - bookedThisWeek;

    // B2C-BOOKING-SLOT: liczba realnie dostępnych terminów pochodzi z `findPoolSlots`
    // (koszyk AUDIT, bookings + absences), nie z Google Calendar.
    const auditBasket = await prisma.visitDurationBasket.findFirst({
      where: { code: 'AUDIT', isActive: true },
    });

    const realSlotsThisWeek = auditBasket
      ? (await findPoolSlots(auditBasket.id, { from: startOfThisWeek, to: endOfThisWeek })).slots.length
      : 0;

    availableThisWeek = Math.min(availableThisWeek, realSlotsThisWeek);

    if (availableThisWeek > 0) {
      return { slots: availableThisWeek, period: "w tym tygodniu" };
    }

    // 4. Jeśli ten tydzień jest zajęty, sprawdzamy "następny tydzień"
    const startOfNextWeek = addWeeks(startOfThisWeek, 1);
    const endOfNextWeek = addWeeks(endOfThisWeek, 1);

    const { count: countNextWeek, error: errNextWeek } = await supabaseAdmin
      .from('leady')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Umówiony Audyt')
      .gte('data_rezerwacji', startOfNextWeek.toISOString())
      .lte('data_rezerwacji', endOfNextWeek.toISOString());

    if (errNextWeek) throw errNextWeek;

    const bookedNextWeek = countNextWeek || 0;
    let availableNextWeek = limit - bookedNextWeek;

    const realSlotsNextWeek = auditBasket
      ? (await findPoolSlots(auditBasket.id, { from: startOfNextWeek, to: endOfNextWeek })).slots.length
      : 0;

    availableNextWeek = Math.min(availableNextWeek, realSlotsNextWeek);

    // Nawet jeśli kolejny też by był full, zwracamy minimum 1 żeby podtrzymać FOMO
    // lub możemy po prostu zwrócić availableNextWeek i jeśli znowu 0 to "w najbliższym czasie"
    if (availableNextWeek > 0) {
      return { slots: availableNextWeek, period: "w przyszłym tygodniu" };
    }

    return { slots: 1, period: "w najbliższych dniach" };

  } catch (err) {
    console.error("Unexpected error fetching FOMO slots:", err);
    return { slots: 3, period: "w tym tygodniu" }; // Fallback
  }
}
