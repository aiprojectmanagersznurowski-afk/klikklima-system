"use server";

import { unstable_noStore as noStore } from 'next/cache';
import { supabase } from "@/lib/supabaseClient";

interface RoomConfig {
  id: string;
  size: "S" | "M" | "L" | "XL";
}

// Convert room size to cooling capacity code
export function sizeToCode(size: "S" | "M" | "L" | "XL"): string {
  switch (size) {
    case "S": return "07"; // Do 25m2 -> ~2.0kW
    case "M": return "09"; // 26-35m2 -> ~2.5kW
    case "L": return "12"; // 36-50m2 -> ~3.5kW
    case "XL": return "18"; // >50m2 -> ~5.0kW
    default: return "09";
  }
}

export async function getSetForConfig(seriesName: string, rooms: RoomConfig[]) {
  noStore();
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

    return {
      type: set.type, // 'SINGLE' or 'MULTI'
      outdoorModel: set.outdoor_model,
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
