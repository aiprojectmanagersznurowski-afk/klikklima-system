"use server";

import { unstable_noStore as noStore } from 'next/cache';
import { supabase } from "@/lib/supabaseClient";
import { isExpertScreen } from "@klikklima/contracts";

interface RoomConfig {
  id: string;
  size: "S" | "M" | "L" | "XL";
}

/**
 * Wynik dyskwalifikacji — MUSI być odróżnialny od `null` ("brak dopasowania"),
 * bo `DeviceModal.tsx` czyta `null` i spada na fallback cenowy `basePrice`,
 * czyli i tak pokazuje cenę "od" mimo dyskwalifikacji (WO B2C-TRIAGE-DISQUALIFY, AC15).
 * Kształt: `{ disqualified: true, outcome: 'EXPERT_SCREEN' }`, bez `priceNetto`,
 * `installPrice`, `totalPrice`.
 */
export interface DisqualifiedSetResult {
  disqualified: true;
  outcome: 'EXPERT_SCREEN';
}

// Convert room size to cooling capacity code
function sizeToCode(size: "S" | "M" | "L" | "XL"): string {
  switch (size) {
    case "S": return "07"; // Do 25m2 -> ~2.0kW
    case "M": return "09"; // 26-35m2 -> ~2.5kW
    case "L": return "12"; // 36-50m2 -> ~3.5kW
    case "XL": return "18"; // >50m2 -> ~5.0kW
    default: return "09";
  }
}

export async function getSetForConfig(
  seriesName: string,
  rooms: RoomConfig[]
): Promise<Awaited<ReturnType<typeof buildSet>> | DisqualifiedSetResult | null> {
  noStore();

  // Odrzucenie wyłącznie na podstawie DŁUGOŚCI listy — nie jej kompletności
  // (WO B2C-TRIAGE-DISQUALIFY, AC15). Reguła COMMERCIAL_PROPERTY nie ma tu
  // zastosowania: modal nie zna typu budynku. Sprawdzane PRZED zapytaniem do bazy.
  if (isExpertScreen({ ROOM_COUNT: rooms.length })) {
    return { disqualified: true, outcome: 'EXPERT_SCREEN' };
  }

  return buildSet(seriesName, rooms);
}

async function buildSet(seriesName: string, rooms: RoomConfig[]) {
  try {
    const requiredCodes = rooms.map((r) => sizeToCode(r.size)).sort();
    const hash = requiredCodes.join('-');

    // Odpytujemy zmaterializowany widok, co omija CAŁĄ skomplikowaną logikę
    const { data: set, error } = await supabase
      .from('available_combinations')
      .select('*')
      .eq('series_name', seriesName)
      .eq('room_count', rooms.length)
      .eq('sizes_hash', hash)
      .limit(1)
      .single();

    if (error || !set) {
        return null;
    }

    // Get install price
    const { data: cennik } = await supabase
      .from('cennik_uslug')
      .select('koszt_b2c_netto')
      .eq('nazwa_uslugi', 'Montaż wzorcowy')
      .single();
    
    const baseInstall = cennik ? Number(cennik.koszt_b2c_netto) : 1200;
    const installNetto = baseInstall * rooms.length;

    // Get outdoor unit image
    const { data: outdoor } = await supabase
      .from('outdoor_units')
      .select('image_url')
      .eq('model_code', set.outdoor_model)
      .single();

    return {
      type: set.type, // 'SINGLE' or 'MULTI'
      outdoorModel: set.outdoor_model,
      outdoorImageUrl: outdoor?.image_url || null,
      capacity: set.outdoor_capacity ? Number(set.outdoor_capacity).toFixed(1) : "-",
      priceNetto: Number(set.total_devices_price),
      installPrice: installNetto,
      totalPrice: Number(set.total_devices_price) + installNetto
    };

  } catch (err) {
    console.error("Error in getSetForConfig:", err);
    return null;
  }
}
