"use server";

import { supabase } from "@/lib/supabaseClient";

interface RoomConfig {
  id: string;
  size: "S" | "M" | "L" | "XL";
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

function sizeToKw(size: "S" | "M" | "L" | "XL"): number {
  switch (size) {
    case "S": return 2.0;
    case "M": return 2.5;
    case "L": return 3.4;
    case "XL": return 5.0;
    default: return 2.5;
  }
}

export async function getSetForConfig(seriesName: string, rooms: RoomConfig[]) {
  try {
    const requiredCodes = rooms.map((r) => sizeToCode(r.size)).sort();
    const totalKw = rooms.reduce((acc, r) => acc + sizeToKw(r.size), 0);

    // Get the indoor units matching this series and these capacities
    const { data: indoors } = await supabase
      .from('indoor_units')
      .select('*')
      .eq('series_name', seriesName);

    if (!indoors || indoors.length === 0) {
        return null;
    }

    if (rooms.length === 1) {
      // Find a single set
      const requiredCode = requiredCodes[0];
      const targetIndoor = indoors.find((u) => u.model_code.includes(requiredCode));
      
      if (!targetIndoor) return null;

      const { data: set } = await supabase
        .from('single_split_sets')
        .select(`
          *,
          indoor_units!inner(*),
          outdoor_units!inner(*)
        `)
        .eq('indoor_unit_id', targetIndoor.id)
        .limit(1)
        .single();

      if (!set) return null;

      // Get install price
      const { data: cennik } = await supabase
        .from('cennik_uslug')
        .select('koszt_b2c_netto')
        .eq('nazwa_uslugi', 'Montaż wzorcowy')
        .single();
      const installNetto = cennik ? Number(cennik.koszt_b2c_netto) : 1500;

      const setPrice = Number(set.set_price_netto) > 0 
        ? Number(set.set_price_netto) 
        : (Number(targetIndoor.price_netto) + Number(set.outdoor_units.price_netto));

      return {
        type: 'SINGLE',
        outdoorModel: set.outdoor_units.model_code,
        capacity: Number(targetIndoor.cooling_capacity_kw).toFixed(1),
        priceNetto: setPrice,
        installPrice: installNetto,
        totalPrice: setPrice + installNetto
      };
    } else {
      // Multi split - find a combination that matches our codes
      const { data: multiSets } = await supabase
        .from('multi_split_sets')
        .select('*, outdoor_units!inner(*)')
        .eq('supported_rooms_count', rooms.length);

      if (!multiSets || multiSets.length === 0) return null;

      // Find best match based on indoor_units_json
      let bestMatch = null;
      for (const set of multiSets) {
        const setCodes = (set.indoor_units_json as any[]).map((i) => i.code).sort();
        // Check if codes match
        let isMatch = true;
        for (let i = 0; i < requiredCodes.length; i++) {
          if (setCodes[i] !== requiredCodes[i]) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) {
          bestMatch = set;
          break;
        }
      }

      if (!bestMatch) {
        // Fallback: get the first multi set for that room count
        bestMatch = multiSets[0];
      }

      // Calculate combined indoor units price
      let combinedPrice = 0;
      for (const code of requiredCodes) {
        const targetIndoor = indoors.find((u) => u.model_code.includes(code));
        if (targetIndoor) {
           combinedPrice += Number(targetIndoor.price_netto);
        }
      }
      
      const setPrice = Number(bestMatch.set_price_netto) > 0 ? Number(bestMatch.set_price_netto) : (combinedPrice + Number(bestMatch.outdoor_units.price_netto));

      const { data: cennik } = await supabase
        .from('cennik_uslug')
        .select('koszt_b2c_netto')
        .eq('nazwa_uslugi', 'Montaż wzorcowy')
        .single();
      const baseInstall = cennik ? Number(cennik.koszt_b2c_netto) : 1500;
      const installNetto = baseInstall * rooms.length;

      return {
        type: 'MULTI',
        outdoorModel: bestMatch.outdoor_units.model_code,
        capacity: Number(bestMatch.outdoor_units.cooling_capacity_kw || totalKw).toFixed(1),
        priceNetto: setPrice,
        installPrice: installNetto,
        totalPrice: setPrice + installNetto
      };
    }

  } catch (err) {
    console.error("Error in getSetForConfig:", err);
    return null;
  }
}
