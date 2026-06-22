"use server";

import { supabase } from "@/lib/supabaseClient";

export async function getAvailableSizes(seriesName: string): Promise<string[]> {
  try {
    const { data: indoors } = await supabase
      .from('indoor_units')
      .select('model_code')
      .eq('series_name', seriesName);

    if (!indoors || indoors.length === 0) {
      return ['S', 'M', 'L', 'XL']; // Fallback
    }

    const availableSizes: Set<string> = new Set();
    
    // Na podstawie kodów oceniamy dostępne wielkości
    for (const unit of indoors) {
      if (unit.model_code.includes('07')) availableSizes.add('S');
      if (unit.model_code.includes('09')) availableSizes.add('M');
      if (unit.model_code.includes('12')) availableSizes.add('L');
      if (unit.model_code.includes('14')) availableSizes.add('L'); // 14 to też często traktowane jako L
      if (unit.model_code.includes('18')) availableSizes.add('XL');
      if (unit.model_code.includes('24')) availableSizes.add('XL');
      if (unit.model_code.includes('30')) availableSizes.add('XL');
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
