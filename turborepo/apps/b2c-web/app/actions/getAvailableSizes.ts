"use server";

import { supabase } from "@/lib/supabaseClient";

export async function getAvailableSizes(seriesName: string): Promise<string[]> {
  try {
    const { data: indoors } = await supabase
      .from('indoor_units')
      .select('model_code, cooling_capacity_kw')
      .eq('series_name', seriesName);

    if (!indoors || indoors.length === 0) {
      return ['S', 'M', 'L', 'XL']; // Fallback
    }

    const availableSizes: Set<string> = new Set();
    
    // Zgodnie z zasadą 0.1 kW na 1 m2
    for (const unit of indoors) {
      const kw = Number(unit.cooling_capacity_kw);
      if (kw >= 2.0 && kw < 2.6) availableSizes.add('S'); // Do 25 m2 (2.0kW, 2.5kW)
      if (kw >= 2.6 && kw < 3.6) availableSizes.add('M'); // 26-35 m2 (np. 3.4kW)
      if (kw >= 3.6 && kw < 5.1) availableSizes.add('L'); // 36-50 m2 (np. 4.2kW, 5.0kW)
      if (kw >= 5.1) availableSizes.add('XL'); // Powyżej 50 m2 (np. 7.1kW)
    }

    // Jeśli nic nie dopasowano z kodów (np inna konwencja nazewnictwa), zwróć wszystko
    if (availableSizes.size === 0) {
       return ['S', 'M', 'L', 'XL'];
    }

    return Array.from(availableSizes);
  } catch (err) {
    console.error("Error fetching available sizes:", err);
    return ['S', 'M', 'L', 'XL']; // Fallback in case of error
  }
}
