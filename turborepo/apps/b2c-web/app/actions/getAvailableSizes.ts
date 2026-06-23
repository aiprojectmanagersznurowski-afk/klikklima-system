"use server";

import { supabase } from "@/lib/supabaseClient";

export async function getAvailableSizes(seriesName: string): Promise<{ sizes: string[], maxRooms: number }> {
  try {
    const { data: indoors } = await supabase
      .from('indoor_units')
      .select('model_code, cooling_capacity_kw, brand')
      .eq('series_name', seriesName);

    if (!indoors || indoors.length === 0) {
      return { sizes: ['S', 'M', 'L', 'XL'], maxRooms: 5 }; // Fallback
    }

    const availableSizes: Set<string> = new Set();
    
    // Zgodnie z zasadą 0.1 kW na 1 m2
    for (const unit of indoors) {
      const kw = Number(unit.cooling_capacity_kw);
      if (kw >= 2.0 && kw < 2.6) availableSizes.add('S');
      if (kw >= 2.6 && kw < 3.6) availableSizes.add('M');
      if (kw >= 3.6 && kw < 5.1) availableSizes.add('L');
      if (kw >= 5.1) availableSizes.add('XL');
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

    return { sizes, maxRooms };
  } catch (err) {
    console.error("Error fetching available sizes:", err);
    return { sizes: ['S', 'M', 'L', 'XL'], maxRooms: 5 }; // Fallback
  }
}
