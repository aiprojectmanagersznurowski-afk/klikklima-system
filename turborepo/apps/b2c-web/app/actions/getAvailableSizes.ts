"use server";

import { supabase } from "@/lib/supabaseClient";

export async function getAvailableSizes(seriesName: string): Promise<{ sizes: string[], maxRooms: number, powers: Record<string, string> }> {
  try {
    const { data: indoors } = await supabase
      .from('indoor_units')
      .select('model_code, cooling_capacity_kw, brand')
      .eq('series_name', seriesName);

    if (!indoors || indoors.length === 0) {
      return { sizes: ['S', 'M', 'L', 'XL'], maxRooms: 5, powers: { S: "2.0 kW", M: "2.5 kW", L: "3.5 kW", XL: "5.0 kW" } }; // Fallback
    }

    const availableSizes: Set<string> = new Set();
    const powers: Record<string, string> = {};
    
    // Sort to get the smallest capacity for each category
    indoors.sort((a, b) => Number(a.cooling_capacity_kw) - Number(b.cooling_capacity_kw));

    for (const unit of indoors) {
      const kw = Number(unit.cooling_capacity_kw);
      if (kw >= 2.0 && kw < 2.6) {
         availableSizes.add('S');
         if (!powers['S']) powers['S'] = `${kw.toFixed(1)} kW`;
      } else if (kw >= 2.6 && kw < 3.6) {
         availableSizes.add('M');
         if (!powers['M']) powers['M'] = `${kw.toFixed(1)} kW`;
      } else if (kw >= 3.6 && kw < 5.1) {
         availableSizes.add('L');
         if (!powers['L']) powers['L'] = `${kw.toFixed(1)} kW`;
      } else if (kw >= 5.1) {
         availableSizes.add('XL');
         if (!powers['XL']) powers['XL'] = `${kw.toFixed(1)} kW`;
      }
    }

    const brand = indoors[0].brand;

    const { data: outdoors } = await supabase
        .from('outdoor_units')
        .select('max_indoor_units')
        .eq('brand', brand)
        .order('max_indoor_units', { ascending: false })
        .limit(1)
        .single();

    const maxRooms = outdoors ? Number(outdoors.max_indoor_units) : 5;
    const sizes = availableSizes.size === 0 ? ['S', 'M', 'L', 'XL'] : Array.from(availableSizes);

    return { sizes, maxRooms, powers: Object.keys(powers).length > 0 ? powers : { S: "2.0 kW", M: "2.5 kW", L: "3.5 kW", XL: "5.0 kW" } };
  } catch (err) {
    console.error("Error fetching available sizes:", err);
    return { sizes: ['S', 'M', 'L', 'XL'], maxRooms: 5, powers: { S: "2.0 kW", M: "2.5 kW", L: "3.5 kW", XL: "5.0 kW" } }; // Fallback
  }
}
